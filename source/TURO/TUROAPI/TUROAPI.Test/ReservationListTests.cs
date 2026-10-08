namespace TUROAPI.Test
{
    /// <summary>L'écran Réservations (§6.1) : des jours entiers, groupés, filtrés, et la file des demandes</summary>
    [TestClass]
    public sealed class ReservationListTests
    {
        private static Task SetAsync(Guid id, ReservationSource? source = null, DateTime? createdAt = null) =>
            TestApi.WithDbAsync(async db =>
            {
                Reservation stored = await db.Reservations.SingleAsync(r => r.Id == id);
                stored.Source = source ?? stored.Source;
                stored.CreatedAt = createdAt ?? stored.CreatedAt;
                await db.SaveChangesAsync();
            });

        [TestMethod]
        public async Task Periods_split_today_upcoming_and_past_in_reading_order()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            DateOnly today = Dates.Today;
            Reservation late = await restaurant.AddReservationAsync(today, 21);
            Reservation early = await restaurant.AddReservationAsync(today, 19);
            await restaurant.AddReservationAsync(today.AddDays(3), 20);
            await restaurant.AddReservationAsync(today.AddDays(1), 19);
            await restaurant.AddReservationAsync(today.AddDays(-5), 21);
            await restaurant.AddReservationAsync(today.AddDays(-2), 20);

            ReservationPageResponse upcoming = await ReservationApi.ListAsync(staff);
            ReservationPageResponse todayOnly = await ReservationApi.ListAsync(staff, "?period=Today");
            ReservationPageResponse past = await ReservationApi.ListAsync(staff, "?period=Past");

            CollectionAssert.AreEqual(new[] { today, today.AddDays(1), today.AddDays(3) }, upcoming.Days.Select(d => d.ServiceDay).ToArray());
            CollectionAssert.AreEqual(new[] { early.Id, late.Id }, upcoming.Days[0].Items.Select(i => i.Id).ToArray());
            CollectionAssert.AreEqual(new[] { today }, todayOnly.Days.Select(d => d.ServiceDay).ToArray());
            // Les passées, de la plus récente à la plus ancienne
            CollectionAssert.AreEqual(new[] { today.AddDays(-2), today.AddDays(-5) }, past.Days.Select(d => d.ServiceDay).ToArray());
        }

        [TestMethod]
        public async Task A_day_header_counts_the_covers_that_hold_a_table_and_those_left_to_place()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            DateOnly day = ReservationApi.Saturday;
            (_, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("T1", 4));
            await restaurant.AddReservationAsync(day, 19, covers: 4);
            Reservation placed = await restaurant.AddReservationAsync(day, 19, 30, covers: 2);
            await ReservationApi.AssignAsync(placed.Id, tableId: tables[0].Id);
            await restaurant.AddReservationAsync(day, 20, covers: 3, status: ReservationStatus.Seated);
            await restaurant.AddReservationAsync(day, 20, covers: 2, status: ReservationStatus.Finished);
            await restaurant.AddReservationAsync(day, 21, covers: 6, status: ReservationStatus.Pending);
            await restaurant.AddReservationAsync(day, 21, covers: 5, status: ReservationStatus.Cancelled);
            await restaurant.AddReservationAsync(day, 21, covers: 1, status: ReservationStatus.NoShow);

            ReservationDayResponse header = (await ReservationApi.ListAsync(staff)).Days.Single();

            // 4 + 2 + 3 + 2 : une demande, une annulation et un no-show n'occupent aucune table
            Assert.AreEqual(11, header.Covers);
            Assert.AreEqual(1, header.ToPlace);
            Assert.AreEqual(7, header.Items.Count);
            Assert.AreEqual("T1", header.Items.Single(i => i.Id == placed.Id).PlaceName);
        }

        [TestMethod]
        public async Task Filters_take_the_status_the_source_and_the_zone_of_the_latest_table_or_the_wish()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            DateOnly day = ReservationApi.Saturday;
            (Guid salle, List<Table> inSalle) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("T1", 4));
            (Guid terrasse, List<Table> inTerrasse) = await ReservationApi.AddTablesAsync(restaurant.Id, "Terrasse", ("T2", 4));
            Reservation wished = await restaurant.AddReservationAsync(day, 19, preferredZoneId: terrasse);
            Reservation seatedOutside = await restaurant.AddReservationAsync(day, 19);
            await ReservationApi.AssignAsync(seatedOutside.Id, tableId: inTerrasse[0].Id);
            Reservation movedInside = await restaurant.AddReservationAsync(day, 20);
            await ReservationApi.AssignAsync(movedInside.Id, tableId: inTerrasse[0].Id);
            await ReservationApi.AssignAsync(movedInside.Id, tableId: inSalle[0].Id);
            Reservation cancelled = await restaurant.AddReservationAsync(day, 20, status: ReservationStatus.Cancelled);
            Reservation walkIn = await restaurant.AddReservationAsync(day, 21);
            await SetAsync(walkIn.Id, source: ReservationSource.WalkIn);

            static Guid[] Ids(ReservationPageResponse page) => page.Days.SelectMany(d => d.Items).Select(i => i.Id).OrderBy(i => i).ToArray();

            // Déplacée en salle : c'est la dernière affectation qui compte
            CollectionAssert.AreEqual(new[] { wished.Id, seatedOutside.Id }.OrderBy(i => i).ToArray(),
                Ids(await ReservationApi.ListAsync(staff, $"?zoneId={terrasse}")));
            CollectionAssert.AreEqual(new[] { movedInside.Id }, Ids(await ReservationApi.ListAsync(staff, $"?zoneId={salle}")));
            CollectionAssert.AreEqual(new[] { cancelled.Id }, Ids(await ReservationApi.ListAsync(staff, "?status=Cancelled")));
            CollectionAssert.AreEqual(new[] { walkIn.Id }, Ids(await ReservationApi.ListAsync(staff, "?source=WalkIn")));
        }

        [TestMethod]
        public async Task Search_finds_a_name_or_any_piece_of_a_number_and_never_a_walk_in()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            DateOnly day = ReservationApi.Saturday;
            Client sophie = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0612345678");
            Reservation hers = await restaurant.AddReservationAsync(day, 20, clientId: sophie.Id);
            Reservation walkIn = await restaurant.AddReservationAsync(day, 21, clientName: null);

            static Guid[] Ids(ReservationPageResponse page) => page.Days.SelectMany(d => d.Items).Select(i => i.Id).ToArray();

            CollectionAssert.AreEqual(new[] { hers.Id }, Ids(await ReservationApi.ListAsync(staff, "?search=march")));
            CollectionAssert.AreEqual(new[] { hers.Id }, Ids(await ReservationApi.ListAsync(staff, "?search=06.12.34")));
            Assert.AreEqual(0, Ids(await ReservationApi.ListAsync(staff, "?search=passage")).Length);
            ReservationPageResponse all = await ReservationApi.ListAsync(staff);
            Assert.AreEqual(2, Ids(all).Length);
            Assert.IsNull(all.Days.Single().Items.Single(i => i.Id == walkIn.Id).Client);
        }

        [TestMethod]
        public async Task Each_line_carries_what_its_marks_need()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Client roux = await ClientApi.AddAsync(restaurant.Id, "Roux", phone: "0611111111", visits: 3, noShows: 2,
                allergies: "Arachide", tags: [ClientTag.Vip]);
            Reservation reservation = await restaurant.AddReservationAsync(ReservationApi.Saturday, 20, covers: 5, clientId: roux.Id);

            ReservationListItemResponse line = (await ReservationApi.ListAsync(staff)).Days.Single().Items.Single();

            Assert.AreEqual(reservation.Start, line.Start);
            Assert.AreEqual(5, line.Covers);
            Assert.AreEqual(ReservationSource.Phone, line.Source);
            Assert.AreEqual(reservation.Start.AddMinutes(15), line.NoShowFrom);
            Assert.AreEqual("Roux", line.Client!.Name);
            Assert.AreEqual("0611111111", line.Client.Phone);
            Assert.IsTrue(line.Client.HasAllergy);
            Assert.IsTrue(line.Client.AtRisk);
            CollectionAssert.AreEqual(new[] { ClientTag.Vip }, line.Client.Tags);
        }

        [TestMethod]
        public async Task The_banner_counts_every_upcoming_request_whatever_the_filters()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            DateTime fourHoursAgo = DateTime.UtcNow.AddHours(-4);
            Reservation oldest = await restaurant.AddReservationAsync(ReservationApi.Saturday, 20, status: ReservationStatus.Pending);
            await SetAsync(oldest.Id, createdAt: fourHoursAgo);
            await restaurant.AddReservationAsync(ReservationApi.Saturday.AddDays(1), 20, status: ReservationStatus.Pending);
            // Une demande d'hier ne se traite plus
            await restaurant.AddReservationAsync(Dates.Today.AddDays(-1), 20, status: ReservationStatus.Pending);

            ReservationPageResponse filtered = await ReservationApi.ListAsync(staff, "?status=Cancelled&period=Past");

            Assert.AreEqual(2, filtered.Pending.Count);
            Assert.IsTrue(Math.Abs((filtered.Pending.OldestCreatedAt!.Value - fourHoursAgo).TotalSeconds) < 1, $"{filtered.Pending.OldestCreatedAt}");
        }

        [TestMethod]
        public async Task Days_come_in_pages_and_say_when_more_remain()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            DateOnly day = ReservationApi.Saturday;
            await restaurant.AddReservationAsync(day, 20);
            await restaurant.AddReservationAsync(day, 21);
            await restaurant.AddReservationAsync(day.AddDays(1), 20);
            await restaurant.AddReservationAsync(day.AddDays(2), 20);

            ReservationPageResponse two = await ReservationApi.ListAsync(staff, "?days=2");
            ReservationPageResponse three = await ReservationApi.ListAsync(staff, "?days=3");

            Assert.AreEqual(2, two.Days.Count);
            Assert.AreEqual(2, two.Days[0].Items.Count);
            Assert.IsTrue(two.HasMore);
            Assert.IsFalse(three.HasMore);
            await ApiAssert.ErrorAsync(await staff.GetAsync("api/reservations?days=0"), HttpStatusCode.BadRequest, "InvalidRequest", "days");
            await ApiAssert.ErrorAsync(await staff.GetAsync("api/reservations?days=367"), HttpStatusCode.BadRequest, "InvalidRequest", "days");
        }

        [TestMethod]
        public async Task Another_restaurant_reservations_never_show()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            TestRestaurant other = await TestRestaurant.CreateAsync();
            await other.AddReservationAsync(ReservationApi.Saturday, 20);
            await other.AddReservationAsync(ReservationApi.Saturday, 20, status: ReservationStatus.Pending);
            using HttpClient staff = restaurant.StaffClient();

            ReservationPageResponse page = await ReservationApi.ListAsync(staff);

            Assert.AreEqual(0, page.Days.Count);
            Assert.AreEqual(0, page.Pending.Count);
        }
    }
}
