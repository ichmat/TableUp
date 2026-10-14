using TUROAPI.Services;

namespace TUROAPI.Test
{
    /// <summary>GET /api/service : quel service, et qui occupe quelle table, à quelle heure (§5, §3.2, §3.3)</summary>
    [TestClass]
    public sealed class ServiceScreenTests
    {
        private static readonly DateOnly Saturday = ReservationApi.Saturday;
        private static string Day(DateOnly day) => day.ToString("yyyy-MM-dd");

        /// <summary>Déjeuner 12:00–14:30 et dîner 19:00–23:00 le samedi</summary>
        private static async Task<TestRestaurant> SaturdayRestaurantAsync()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 12, 14);
            await TestApi.WithDbAsync(db => db.Services.Where(s => s.RestaurantId == restaurant.Id && s.Opening == new TimeOnly(12, 0))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Closing, new TimeOnly(14, 30))));
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);
            return restaurant;
        }

        [TestMethod]
        public async Task Without_any_service_there_is_nothing_to_show()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();

            ServiceSnapshotResponse snapshot = await ServiceApi.GetAsync(staff);

            Assert.IsNull(snapshot.Service);
            Assert.IsTrue(snapshot.IsDefault);
            Assert.AreEqual(Dates.Today, snapshot.Day);
            Assert.AreEqual(0, snapshot.Slots.Count);
        }

        [TestMethod]
        public async Task A_service_in_progress_is_shown_by_default()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            DateTime local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(Dates.TimeZoneId));
            if (local.Minute == 59)
            {
                Assert.Inconclusive("Trop près de la fin de l'heure pour une plage d'une heure");
            }
            // Une plage qui contient maintenant ; à 23 h elle passe minuit, ce qui reste le service d'aujourd'hui
            await ReservationApi.AddServiceAsync(restaurant.Id, local.DayOfWeek, local.Hour, (local.Hour + 1) % 24);

            ServiceSnapshotResponse snapshot = await ServiceApi.GetAsync(staff);

            Assert.AreEqual(Dates.Today, snapshot.Day);
            Assert.AreEqual(ServiceState.InProgress, snapshot.Service!.State);
            Assert.AreEqual(new TimeOnly(local.Hour, 0), snapshot.Service.Opening);
            Assert.IsTrue(snapshot.IsDefault);
        }

        [TestMethod]
        public async Task A_late_service_opened_yesterday_and_still_running_is_the_default_with_its_after_midnight_reservations()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            DateTime local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(Dates.TimeZoneId));
            if (local.Hour >= 22)
            {
                Assert.Inconclusive("La plage d'hier doit passer minuit et contenir maintenant : impossible après 22 h");
            }
            DateOnly yesterday = Dates.Today.AddDays(-1);
            // Hier de h+2 à aujourd'hui h+1 : comme à 00:30 le dîner de la veille, la plage a passé minuit et dure encore
            await ReservationApi.AddServiceAsync(restaurant.Id, yesterday.DayOfWeek, local.Hour + 2, local.Hour + 1);
            Reservation afterMidnight = await restaurant.AddReservationAsync(yesterday, local.Hour, startDay: Dates.Today);

            ServiceSnapshotResponse snapshot = await ServiceApi.GetAsync(staff);

            Assert.AreEqual(yesterday, snapshot.Day);
            Assert.AreEqual(ServiceState.InProgress, snapshot.Service!.State);
            Assert.IsTrue(snapshot.IsDefault);
            Assert.AreEqual(afterMidnight.Id, snapshot.ToPlace.Single().Id);
            // Les créneaux continuent après minuit, sur la date réelle du lendemain
            ServiceSlotResponse midnight = snapshot.Slots.Single(s => s.Time == new TimeOnly(0, 0));
            Assert.AreEqual(Dates.ToUtc(Dates.Today, new TimeOnly(0, 0)), midnight.At);
            Assert.IsTrue(snapshot.Slots.Single(s => s.Time == new TimeOnly(local.Hour, 0)).HasUnplaced);
        }

        [TestMethod]
        public async Task A_modified_hours_day_shows_its_replacement_hours_instead_of_its_services()
        {
            TestRestaurant restaurant = await SaturdayRestaurantAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddClosureAsync(restaurant.Id, Saturday, (12, 16));
            Reservation lunch = await restaurant.AddReservationAsync(Saturday, 15, 30);
            await restaurant.AddReservationAsync(Saturday, 20);

            ServiceSnapshotResponse snapshot = await ServiceApi.GetAsync(staff, $"?day={Day(Saturday)}");

            Assert.AreEqual(new TimeOnly(12, 0), snapshot.Service!.Opening);
            Assert.AreEqual(new TimeOnly(16, 0), snapshot.Service.Closing);
            // Le pas le plus fin des services du jour, sur la plage de remplacement
            Assert.AreEqual(30, snapshot.Service.SlotStep);
            Assert.AreEqual(8, snapshot.Slots.Count);
            Assert.AreEqual(new TimeOnly(12, 0), snapshot.Windows.Single().Opening);
            // La réservation de 20:00 tombe hors de toute plage : elle n'est d'aucun service
            Assert.AreEqual(lunch.Id, snapshot.ToPlace.Single().Id);
            await ApiAssert.ErrorAsync(await staff.GetAsync($"api/service?day={Day(Saturday)}&opening=19:00"), HttpStatusCode.NotFound, "NotFound");
        }

        [TestMethod]
        public async Task A_closed_today_shows_the_next_open_day()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.OpenEveryEveningAsync(restaurant.Id);
            await ReservationApi.AddClosureAsync(restaurant.Id, Dates.Today);

            ServiceSnapshotResponse snapshot = await ServiceApi.GetAsync(staff);

            Assert.AreEqual(Dates.Today.AddDays(1), snapshot.Day);
            Assert.AreEqual(ServiceState.Upcoming, snapshot.Service!.State);
            Assert.IsTrue(snapshot.IsDefault);
        }

        [TestMethod]
        public async Task A_chosen_day_opens_on_its_first_service_and_lists_every_service_of_the_day()
        {
            TestRestaurant restaurant = await SaturdayRestaurantAsync();
            using HttpClient staff = restaurant.StaffClient();
            await restaurant.AddReservationAsync(Saturday, 12, 30, covers: 3);
            await restaurant.AddReservationAsync(Saturday, 20, covers: 4);
            await restaurant.AddReservationAsync(Saturday, 20, 30, covers: 5, status: ReservationStatus.Cancelled);

            ServiceSnapshotResponse snapshot = await ServiceApi.GetAsync(staff, $"?day={Day(Saturday)}");

            Assert.AreEqual(new TimeOnly(12, 0), snapshot.Service!.Opening);
            Assert.AreEqual(ServiceState.Upcoming, snapshot.Service.State);
            Assert.IsFalse(snapshot.IsDefault);
            CollectionAssert.AreEqual(new[] { new TimeOnly(12, 0), new TimeOnly(19, 0) }, snapshot.Windows.Select(w => w.Opening).ToArray());
            CollectionAssert.AreEqual(new[] { 3, 4 }, snapshot.Windows.Select(w => w.ExpectedCovers).ToArray());
        }

        [TestMethod]
        public async Task A_service_is_chosen_by_its_day_and_opening()
        {
            TestRestaurant restaurant = await SaturdayRestaurantAsync();
            using HttpClient staff = restaurant.StaffClient();

            ServiceSnapshotResponse snapshot = await ServiceApi.GetAsync(staff, $"?day={Day(Saturday)}&opening=19:00");

            Assert.AreEqual(new TimeOnly(19, 0), snapshot.Service!.Opening);
            Assert.AreEqual(new TimeOnly(23, 0), snapshot.Service.Closing);
            Assert.AreEqual(30, snapshot.Service.SlotStep);
            Assert.AreEqual(8, snapshot.Slots.Count);
            Assert.AreEqual(Dates.ToUtc(Saturday, new TimeOnly(19, 30)), snapshot.Slots[1].At);
            await ApiAssert.ErrorAsync(await staff.GetAsync($"api/service?day={Day(Saturday)}&opening=18:00"), HttpStatusCode.NotFound, "NotFound");
        }

        [TestMethod]
        public async Task A_closed_day_has_no_service_but_still_shows_the_rooms()
        {
            TestRestaurant restaurant = await SaturdayRestaurantAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("T1", 4));
            await ReservationApi.AddClosureAsync(restaurant.Id, Saturday);

            ServiceSnapshotResponse snapshot = await ServiceApi.GetAsync(staff, $"?day={Day(Saturday)}");

            Assert.IsNull(snapshot.Service);
            Assert.AreEqual(Saturday, snapshot.Day);
            Assert.AreEqual(0, snapshot.Windows.Count);
            Assert.AreEqual("T1", snapshot.Zones.Single().Tables.Single().Name);
        }

        [TestMethod]
        public async Task A_reservation_in_focus_opens_its_own_service()
        {
            TestRestaurant restaurant = await SaturdayRestaurantAsync();
            using HttpClient staff = restaurant.StaffClient();
            Reservation lunch = await restaurant.AddReservationAsync(Saturday, 13);

            // « Placer » depuis l'écran Réservations ne connaît que le jour : le déjeuner, pas le premier service du jour par hasard
            ServiceSnapshotResponse snapshot = await ServiceApi.GetAsync(staff, $"?day={Day(Saturday.AddDays(7))}&focus={lunch.Id}");

            Assert.AreEqual(Saturday, snapshot.Day);
            Assert.AreEqual(new TimeOnly(12, 0), snapshot.Service!.Opening);
            Assert.AreEqual(lunch.Id, snapshot.ToPlace.Single().Id);
        }

        [TestMethod]
        public async Task Each_table_carries_what_occupies_it_and_a_group_occupies_every_table_of_its_combination()
        {
            TestRestaurant restaurant = await SaturdayRestaurantAsync();
            using HttpClient staff = restaurant.StaffClient();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("T1", 4), ("T12", 4), ("T13", 4), ("T9", 2));
            Guid combination = await ReservationApi.AddCombinationAsync(zoneId, "12-13", 8, tables[1].Id, tables[2].Id);
            await PlanApi.DeactivateTableAsync(tables[3].Id);
            Reservation confirmed = await restaurant.AddReservationAsync(Saturday, 20, covers: 4, clientName: "Moreau");
            Reservation group = await restaurant.AddReservationAsync(Saturday, 21, covers: 8, clientName: "Nguyen");
            Reservation noShow = await restaurant.AddReservationAsync(Saturday, 19, status: ReservationStatus.NoShow);
            Reservation walkIn = await restaurant.AddReservationAsync(Saturday, 19, 30, clientName: null);
            await ReservationApi.AssignAsync(confirmed.Id, tableId: tables[0].Id);
            await ReservationApi.AssignAsync(group.Id, combinationId: combination);
            await ReservationApi.AssignAsync(noShow.Id, tableId: tables[0].Id);
            await ReservationApi.AssignAsync(walkIn.Id, tableId: tables[1].Id);

            ServiceSnapshotResponse snapshot = await ServiceApi.GetAsync(staff, $"?day={Day(Saturday)}&opening=19:00");

            Dictionary<string, ServiceTableResponse> byName = snapshot.Zones.Single().Tables.ToDictionary(t => t.Name);
            CollectionAssert.AreEquivalent(new[] { "T1", "T12", "T13" }, byName.Keys.ToArray());
            ServiceOccupationResponse moreau = byName["T1"].Occupations.Single();
            Assert.AreEqual(confirmed.Id, moreau.ReservationId);
            Assert.AreEqual(Dates.ToUtc(Saturday, new TimeOnly(20, 0)), moreau.Start);
            Assert.AreEqual(Dates.ToUtc(Saturday, new TimeOnly(22, 0)), moreau.End);
            Assert.AreEqual(Dates.ToUtc(Saturday, new TimeOnly(20, 15)), moreau.LateFrom);
            Assert.AreEqual("Moreau", moreau.GuestName);
            Assert.AreEqual("T1", moreau.PlaceName);
            Assert.AreEqual(group.Id, byName["T13"].Occupations.Single().ReservationId);
            Assert.AreEqual("12-13", byName["T13"].Occupations.Single().PlaceName);
            CollectionAssert.AreEquivalent(new[] { walkIn.Id, group.Id }, byName["T12"].Occupations.Select(o => o.ReservationId).ToArray());
            Assert.IsNull(byName["T12"].Occupations.Single(o => o.ReservationId == walkIn.Id).GuestName);
        }

        [TestMethod]
        public async Task An_overrunning_seated_table_stays_occupied_until_released_and_a_finished_one_until_it_was()
        {
            TestRestaurant restaurant = await SaturdayRestaurantAsync();
            using HttpClient staff = restaurant.StaffClient();
            DateOnly lastSaturday = Dates.Previous(DayOfWeek.Saturday);
            (_, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("T1", 4), ("T2", 4), ("T3", 4));
            Reservation seated = await restaurant.AddReservationAsync(lastSaturday, 20, status: ReservationStatus.Seated);
            Reservation released = await restaurant.AddReservationAsync(lastSaturday, 19, status: ReservationStatus.Finished);
            Reservation autoClosed = await restaurant.AddReservationAsync(lastSaturday, 19, 30, status: ReservationStatus.Finished);
            await ServiceApi.SetTimesAsync(seated.Id, Dates.ToUtc(lastSaturday, new TimeOnly(19, 50)), null);
            await ServiceApi.SetTimesAsync(released.Id, Dates.ToUtc(lastSaturday, new TimeOnly(19, 0)), Dates.ToUtc(lastSaturday, new TimeOnly(20, 10)));
            await ServiceApi.SetTimesAsync(autoClosed.Id, Dates.ToUtc(lastSaturday, new TimeOnly(19, 30)), null);
            await ReservationApi.AssignAsync(seated.Id, tableId: tables[0].Id);
            await ReservationApi.AssignAsync(released.Id, tableId: tables[1].Id);
            await ReservationApi.AssignAsync(autoClosed.Id, tableId: tables[2].Id);

            ServiceSnapshotResponse snapshot = await ServiceApi.GetAsync(staff, $"?day={Day(lastSaturday)}&opening=19:00");

            Assert.AreEqual(ServiceState.Finished, snapshot.Service!.State);
            Dictionary<string, ServiceOccupationResponse> byTable = snapshot.Zones.Single().Tables.ToDictionary(t => t.Name, t => t.Occupations.Single());
            Assert.AreEqual(Dates.ToUtc(lastSaturday, new TimeOnly(19, 50)), byTable["T1"].Start);
            Assert.AreEqual(ServiceView.Unreleased, byTable["T1"].End);
            Assert.IsNull(byTable["T1"].LateFrom);
            Assert.AreEqual(Dates.ToUtc(lastSaturday, new TimeOnly(20, 10)), byTable["T2"].End);
            Assert.AreEqual(Dates.ToUtc(lastSaturday, new TimeOnly(21, 30)), byTable["T3"].End);
            // 22:30 : la table assise déborde, les deux autres sont libres
            ServiceSlotResponse late = snapshot.Slots.Single(s => s.Time == new TimeOnly(22, 30));
            Assert.AreEqual(1, late.TakenTables);
        }

        [TestMethod]
        public async Task The_screen_lists_what_is_left_to_place_the_requests_and_the_allergies()
        {
            TestRestaurant restaurant = await SaturdayRestaurantAsync();
            using HttpClient staff = restaurant.StaffClient();
            (_, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("T1", 4), ("T2", 6));
            Reservation placed = await restaurant.AddReservationAsync(Saturday, 19, covers: 4, clientName: "Bekkali");
            Reservation chen = await restaurant.AddReservationAsync(Saturday, 21, covers: 6, clientName: "Chen");
            Reservation moreau = await restaurant.AddReservationAsync(Saturday, 20, 30, covers: 4, clientName: "Moreau");
            Reservation bouvier = await restaurant.AddReservationAsync(Saturday, 20, covers: 7, status: ReservationStatus.Pending, clientName: "Bouvier");
            await restaurant.AddReservationAsync(Saturday, 12, 30, clientName: "Déjeuner");
            await ReservationApi.AssignAsync(placed.Id, tableId: tables[0].Id);
            await ServiceApi.SetAllergiesAsync(placed.ClientId!.Value, "Arachide");
            await ServiceApi.SetAllergiesAsync(moreau.ClientId!.Value, "Gluten");

            ServiceSnapshotResponse snapshot = await ServiceApi.GetAsync(staff, $"?day={Day(Saturday)}&opening=19:00");

            CollectionAssert.AreEqual(new[] { moreau.Id, chen.Id }, snapshot.ToPlace.Select(r => r.Id).ToArray());
            Assert.AreEqual(bouvier.Id, snapshot.Pending.Single().Id);
            Assert.AreEqual("Bouvier", snapshot.Pending.Single().Client!.Name);
            Assert.IsTrue(snapshot.ToPlace[0].Client!.HasAllergy);
            Assert.AreEqual(14, snapshot.Service!.ExpectedCovers);
            Assert.AreEqual(10, snapshot.Service.Capacity);
            CollectionAssert.AreEqual(new[] { "Bekkali", "Moreau" }, snapshot.Allergies.Select(a => a.GuestName).ToArray());
            Assert.AreEqual("T1", snapshot.Allergies[0].PlaceName);
            Assert.AreEqual("Arachide", snapshot.Allergies[0].Allergies);
            Assert.IsNull(snapshot.Allergies[1].PlaceName);
            Assert.IsTrue(snapshot.Slots.Single(s => s.Time == new TimeOnly(20, 30)).HasUnplaced);
            Assert.IsFalse(snapshot.Slots.Single(s => s.Time == new TimeOnly(19, 0)).HasUnplaced);
            Assert.AreEqual(4, snapshot.Slots.Single(s => s.Time == new TimeOnly(19, 0)).Covers);
        }

        [TestMethod]
        public async Task The_snapshot_carries_the_cleaning_setting_and_each_table_cleaning_date()
        {
            TestRestaurant restaurant = await SaturdayRestaurantAsync();
            using HttpClient staff = restaurant.StaffClient();
            (_, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("T1", 4));
            DateTime since = DateTime.UtcNow.AddMinutes(-20);
            await ServiceApi.MarkToCleanAsync(tables[0].Id, since);
            await ReservationApi.TrackCleaningAsync(restaurant.Id);

            ServiceSnapshotResponse snapshot = await ServiceApi.GetAsync(staff, $"?day={Day(Saturday)}");

            Assert.IsTrue(snapshot.TrackTableCleaning);
            Assert.AreEqual(15, snapshot.LateGrace);
            ServiceApi.AssertSameInstant(since, snapshot.Zones.Single().Tables.Single().NeedsCleaningSince!.Value);
        }

        [TestMethod]
        public async Task Another_restaurant_never_sees_my_service()
        {
            TestRestaurant mine = await SaturdayRestaurantAsync();
            TestRestaurant other = await TestRestaurant.CreateAsync();
            using HttpClient intruder = other.StaffClient();
            await ReservationApi.AddTablesAsync(mine.Id, "Salle", ("T1", 4));
            Reservation lunch = await mine.AddReservationAsync(Saturday, 13);

            ServiceSnapshotResponse snapshot = await ServiceApi.GetAsync(intruder, $"?day={Day(Saturday)}&focus={lunch.Id}");

            Assert.IsNull(snapshot.Service);
            Assert.AreEqual(0, snapshot.Zones.Count);
            Assert.AreEqual(0, snapshot.ToPlace.Count);
        }

        [TestMethod]
        public async Task The_calendar_marks_the_days_that_carry_reservations()
        {
            TestRestaurant mine = await SaturdayRestaurantAsync();
            TestRestaurant other = await TestRestaurant.CreateAsync();
            using HttpClient staff = mine.StaffClient();
            DateOnly first = new(Saturday.Year, Saturday.Month, 1);
            await mine.AddReservationAsync(Saturday, 20);
            await mine.AddReservationAsync(Saturday, 21);
            await mine.AddReservationAsync(first, 20, status: ReservationStatus.Cancelled);
            await other.AddReservationAsync(first, 20);

            List<DateOnly> days = await ApiAssert.OkAsync<List<DateOnly>>(await staff.GetAsync($"api/service/calendar?month={Saturday:yyyy-MM}"));

            CollectionAssert.AreEqual(new[] { Saturday }, days);
            await ApiAssert.ErrorAsync(await staff.GetAsync("api/service/calendar?month=2026-13"), HttpStatusCode.BadRequest, "InvalidRequest");
            await ApiAssert.ErrorAsync(await staff.GetAsync("api/service/calendar"), HttpStatusCode.BadRequest, "InvalidRequest");
        }
    }
}
