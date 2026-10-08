namespace TUROAPI.Test
{
    /// <summary>Les gestes (§6.4, §6.5) : une transition vérifiée, journalisée, qui tient les compteurs du client (§7.4)</summary>
    [TestClass]
    public sealed class ReservationActionsTests
    {
        [TestMethod]
        public async Task A_request_is_accepted_or_refused_by_the_restaurant()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Reservation first = await restaurant.AddReservationAsync(ReservationApi.Saturday, 20, status: ReservationStatus.Pending);
            Reservation second = await restaurant.AddReservationAsync(ReservationApi.Saturday, 21, status: ReservationStatus.Pending);

            ReservationActionResponse accepted = await ReservationApi.DoAsync(staff, first.Id, "accept");
            ReservationActionResponse refused = await ReservationApi.DoAsync(staff, second.Id, "refuse");

            Assert.AreEqual(ReservationStatus.Confirmed, accepted.Reservation.Status);
            Assert.AreEqual(EventType.Acceptance, accepted.Reservation.Events.Single().Type);
            Assert.AreEqual(accepted.EventId, accepted.Reservation.Events.Single().Id);
            Assert.AreEqual(ReservationStatus.Cancelled, refused.Reservation.Status);
            // Un refus est un geste du restaurant : il ne touche pas la fiabilité du client
            Assert.AreEqual(CancelledBy.Restaurant, refused.Reservation.CancelledBy);
            Assert.AreEqual(EventType.Refusal, refused.Reservation.Events.Single().Type);
            Assert.IsNotNull((await ReservationApi.StoredAsync(second.Id)).CancelledAt);
        }

        [TestMethod]
        public async Task Arrival_needs_a_table_then_seats_the_guests_and_counts_a_visit()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (_, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("T4", 4));
            Client sophie = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0612345678", visits: 2);
            Reservation reservation = await restaurant.AddReservationAsync(Dates.Today, 20, clientId: sophie.Id);

            await ApiAssert.ErrorAsync(await ReservationApi.ActAsync(staff, reservation.Id, "arrive"),
                HttpStatusCode.Conflict, "ReservationActionNotAllowed", "not placed");
            await ReservationApi.AssignAsync(reservation.Id, tableId: tables[0].Id);
            ReservationActionResponse seated = await ReservationApi.DoAsync(staff, reservation.Id, "arrive");

            Assert.AreEqual(ReservationStatus.Seated, seated.Reservation.Status);
            Assert.IsNotNull((await ReservationApi.StoredAsync(reservation.Id)).SeatedAt);
            Assert.AreEqual(3, seated.Reservation.Client!.VisitCount);
            Assert.AreEqual(EventType.Arrival, seated.Reservation.Events.Single().Type);
        }

        [TestMethod]
        public async Task Release_closes_the_meal_and_marks_every_table_of_the_group_to_clean()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("T12", 4), ("T13", 4), ("T14", 4));
            Guid combination = await ReservationApi.AddCombinationAsync(zoneId, "12-13", 8, tables[0].Id, tables[1].Id);
            Reservation group = await restaurant.AddReservationAsync(Dates.Today, 20, covers: 8, status: ReservationStatus.Seated);
            await ReservationApi.AssignAsync(group.Id, combinationId: combination);

            ReservationActionResponse released = await ReservationApi.DoAsync(staff, group.Id, "release");

            Assert.AreEqual(ReservationStatus.Finished, released.Reservation.Status);
            Assert.IsNotNull((await ReservationApi.StoredAsync(group.Id)).FinishedAt);
            Dictionary<string, DateTime?> cleaning = await TestApi.WithDbAsync(db =>
                db.Tables.Where(t => t.ZoneId == zoneId).ToDictionaryAsync(t => t.Name, t => t.NeedsCleaningSince));
            Assert.IsNotNull(cleaning["T12"]);
            Assert.IsNotNull(cleaning["T13"]);
            Assert.IsNull(cleaning["T14"]);
        }

        [TestMethod]
        public async Task A_no_show_exists_only_after_the_grace_and_counts_for_the_client()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Client roux = await ClientApi.AddAsync(restaurant.Id, "Roux", phone: "0611111111", noShows: 1);
            Reservation tooEarly = await restaurant.AddReservationAsync(ReservationApi.Saturday, 20, clientId: roux.Id);
            Reservation late = await restaurant.AddReservationAsync(Dates.Today.AddDays(-1), 20, clientId: roux.Id);

            await ApiAssert.ErrorAsync(await ReservationApi.ActAsync(staff, tooEarly.Id, "no-show"),
                HttpStatusCode.Conflict, "ReservationActionNotAllowed", "grace");
            ReservationActionResponse noShow = await ReservationApi.DoAsync(staff, late.Id, "no-show");

            Assert.AreEqual(ReservationStatus.NoShow, noShow.Reservation.Status);
            Assert.AreEqual(2, noShow.Reservation.Client!.NoShowCount);
            Assert.AreEqual(2, (await ClientApi.StoredAsync(roux.Id))!.NoShowCount);
        }

        [TestMethod]
        public async Task Cancelling_says_who_cancelled_and_a_seated_table_cannot_be_cancelled()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Reservation byClient = await restaurant.AddReservationAsync(ReservationApi.Saturday, 20);
            Reservation byRestaurant = await restaurant.AddReservationAsync(ReservationApi.Saturday, 20, status: ReservationStatus.Pending);
            Reservation seated = await restaurant.AddReservationAsync(Dates.Today, 20, status: ReservationStatus.Seated);

            ReservationActionResponse first = await ReservationApi.DoAsync(staff, byClient.Id, "cancel", CancelledBy.Client);
            ReservationActionResponse second = await ReservationApi.DoAsync(staff, byRestaurant.Id, "cancel", CancelledBy.Restaurant);

            Assert.AreEqual(CancelledBy.Client, first.Reservation.CancelledBy);
            Assert.AreEqual("par le client", first.Reservation.Events.Single().Details);
            Assert.AreEqual(CancelledBy.Restaurant, second.Reservation.CancelledBy);
            Assert.AreEqual("par le restaurant", second.Reservation.Events.Single().Details);
            await ApiAssert.ErrorAsync(await ReservationApi.ActAsync(staff, seated.Id, "cancel"),
                HttpStatusCode.Conflict, "ReservationActionNotAllowed");
        }

        [TestMethod]
        public async Task Reopening_gives_back_the_status_before_the_closing_and_its_counters()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (_, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("T4", 4));
            Client roux = await ClientApi.AddAsync(restaurant.Id, "Roux", phone: "0611111111");
            Reservation noShow = await restaurant.AddReservationAsync(Dates.Today.AddDays(-1), 20, clientId: roux.Id);
            Reservation finished = await restaurant.AddReservationAsync(Dates.Today, 19, clientId: roux.Id);
            await ReservationApi.AssignAsync(finished.Id, tableId: tables[0].Id);
            Reservation refused = await restaurant.AddReservationAsync(ReservationApi.Saturday, 20, status: ReservationStatus.Pending);
            Reservation cancelled = await restaurant.AddReservationAsync(ReservationApi.Saturday, 21);

            await ReservationApi.DoAsync(staff, noShow.Id, "no-show");
            await ReservationApi.DoAsync(staff, finished.Id, "arrive");
            await ReservationApi.DoAsync(staff, finished.Id, "release");
            await ReservationApi.DoAsync(staff, refused.Id, "refuse");
            await ReservationApi.DoAsync(staff, cancelled.Id, "cancel");

            ReservationActionResponse confirmedAgain = await ReservationApi.DoAsync(staff, noShow.Id, "reopen");
            ReservationActionResponse seatedAgain = await ReservationApi.DoAsync(staff, finished.Id, "reopen");
            ReservationActionResponse requestAgain = await ReservationApi.DoAsync(staff, refused.Id, "reopen");
            ReservationActionResponse bookedAgain = await ReservationApi.DoAsync(staff, cancelled.Id, "reopen");

            Assert.AreEqual(ReservationStatus.Confirmed, confirmedAgain.Reservation.Status);
            Assert.AreEqual(ReservationStatus.Seated, seatedAgain.Reservation.Status);
            Assert.IsNull((await ReservationApi.StoredAsync(finished.Id)).FinishedAt);
            Assert.AreEqual(ReservationStatus.Pending, requestAgain.Reservation.Status);
            Assert.AreEqual(ReservationStatus.Confirmed, bookedAgain.Reservation.Status);
            Assert.IsNull(bookedAgain.Reservation.CancelledBy);
            Assert.AreEqual(EventType.Reopening, bookedAgain.Reservation.Events.Last().Type);
            // Le no-show rouvert ne compte plus ; la terminée rouverte reste une visite (assise)
            Client stored = (await ClientApi.StoredAsync(roux.Id))!;
            Assert.AreEqual(0, stored.NoShowCount);
            Assert.AreEqual(1, stored.VisitCount);
            await ApiAssert.ErrorAsync(await ReservationApi.ActAsync(staff, bookedAgain.Reservation.Id, "reopen"),
                HttpStatusCode.Conflict, "ReservationActionNotAllowed");
        }

        [TestMethod]
        public async Task A_gesture_on_a_client_reservation_reloads_the_client_screens_a_walk_in_does_not()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Reservation pending = await restaurant.AddReservationAsync(ReservationApi.Saturday, 20, status: ReservationStatus.Pending);
            Reservation walkIn = await restaurant.AddReservationAsync(ReservationApi.Saturday, 21, clientName: null);
            await using Screen screen = await Screen.ConnectAsync(restaurant.StaffJwt());

            // La fiche client montre l'historique de ses réservations : sans compteur qui bouge, elle change quand même
            await ReservationApi.DoAsync(staff, pending.Id, "accept");
            Assert.AreEqual(DataScope.Reservations, await screen.NextAsync());
            Assert.AreEqual(DataScope.Clients, await screen.NextAsync());
            await ReservationApi.DoAsync(staff, walkIn.Id, "cancel");
            Assert.AreEqual(DataScope.Reservations, await screen.NextAsync());
            Assert.IsFalse(screen.TryNext(out _));
        }

        [TestMethod]
        public async Task Reopening_onto_another_reservation_of_the_same_client_is_refused()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Client sophie = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0612345678");
            Reservation cancelled = await restaurant.AddReservationAsync(ReservationApi.Saturday, 20, status: ReservationStatus.Cancelled, clientId: sophie.Id);
            await restaurant.AddReservationAsync(ReservationApi.Saturday, 20, 30, clientId: sophie.Id);
            // Deux clients de passage peuvent bien tomber en même temps
            Reservation walkIn = await restaurant.AddReservationAsync(ReservationApi.Saturday, 20, status: ReservationStatus.Cancelled, clientName: null);
            await restaurant.AddReservationAsync(ReservationApi.Saturday, 20, clientName: null);

            await ApiAssert.ErrorAsync(await ReservationApi.ActAsync(staff, cancelled.Id, "reopen"), HttpStatusCode.Conflict, "ClientAlreadyBooked");
            await ReservationApi.DoAsync(staff, walkIn.Id, "reopen");
        }

        [TestMethod]
        public async Task A_walk_in_lives_through_every_gesture_without_a_client()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (_, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("T4", 4));
            Reservation walkIn = await restaurant.AddReservationAsync(Dates.Today.AddDays(-1), 20, clientName: null);
            await ReservationApi.AssignAsync(walkIn.Id, tableId: tables[0].Id);

            foreach (string gesture in new[] { "arrive", "release", "reopen", "release" })
            {
                ReservationActionResponse done = await ReservationApi.DoAsync(staff, walkIn.Id, gesture);
                Assert.IsNull(done.Reservation.Client);
            }
            Assert.AreEqual(ReservationStatus.Finished, (await ReservationApi.StoredAsync(walkIn.Id)).Status);
        }

        [TestMethod]
        public async Task Another_restaurant_reservation_cannot_be_touched()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            TestRestaurant other = await TestRestaurant.CreateAsync();
            Reservation theirs = await other.AddReservationAsync(ReservationApi.Saturday, 20, status: ReservationStatus.Pending);
            using HttpClient staff = restaurant.StaffClient();

            await ApiAssert.ErrorAsync(await ReservationApi.ActAsync(staff, theirs.Id, "accept"), HttpStatusCode.NotFound, "NotFound");
            Assert.AreEqual(ReservationStatus.Pending, (await ReservationApi.StoredAsync(theirs.Id)).Status);
        }
    }
}
