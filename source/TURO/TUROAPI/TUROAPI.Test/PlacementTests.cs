using TUROAPI.Services;

namespace TUROAPI.Test
{
    /// <summary>Le placement depuis le plan (§5.8, §3.5) : verdicts, dépôt, changement de table, annulation</summary>
    [TestClass]
    public sealed class PlacementTests
    {
        [TestMethod]
        public async Task Every_active_table_and_active_combination_gets_a_verdict()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("5", 4), ("12", 4), ("13", 4), ("6", 6));
            Guid glued = await ReservationApi.AddCombinationAsync(zoneId, "12-13", 8, tables[1].Id, tables[2].Id);
            await PlacementApi.ActivateAsync(glued);
            await ReservationApi.AddCombinationAsync(zoneId, "5-6", 10, tables[0].Id, tables[3].Id); // en sommeil : lot C
            Reservation moreau = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 4, clientName: "Moreau");
            Reservation legrand = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 21, covers: 2, clientName: "Legrand");
            await ReservationApi.AssignAsync(legrand.Id, tableId: tables[0].Id);

            PlacementResponse placement = await PlacementApi.VerdictsAsync(staff, moreau.Id);

            CollectionAssert.AreEquivalent(new[] { "5", "12", "13", "6", "12-13" }, placement.Entities.Select(e => e.Name).ToArray());
            Assert.AreEqual(PlacementLevel.Excluded, PlacementApi.Entity(placement, "5").Level);
            Assert.AreEqual(PlacementLevel.WithReserve, PlacementApi.Entity(placement, "12").Level);
            Assert.AreEqual(PlacementReasonKind.Glued, PlacementApi.Entity(placement, "12").Reasons.Single().Kind);
            Assert.AreEqual(PlacementLevel.WithReserve, PlacementApi.Entity(placement, "6").Level);
            Assert.AreEqual(glued, PlacementApi.Entity(placement, "12-13").CombinationId);
            Assert.AreEqual("Moreau", placement.GuestName);
            Assert.AreEqual(4, placement.Covers);
        }

        [TestMethod]
        public async Task The_next_booking_of_a_free_table_is_given_with_its_margin()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (_, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("5", 4));
            Reservation moreau = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 19, covers: 4, clientName: "Moreau");
            Reservation legrand = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 21, minute: 30, clientName: "Legrand");
            await ReservationApi.AssignAsync(legrand.Id, tableId: tables[0].Id);

            PlacementEntityResponse five = PlacementApi.Entity(await PlacementApi.VerdictsAsync(staff, moreau.Id), "5");

            Assert.AreEqual(PlacementLevel.Perfect, five.Level);
            Assert.AreEqual(30, five.Next!.Margin);
            Assert.AreEqual("Legrand", five.Next.Guest);
        }

        [TestMethod]
        public async Task A_closed_reservation_or_one_of_another_restaurant_cannot_be_placed()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            TestRestaurant other = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Reservation finished = await restaurant.AddReservationAsync(Dates.Today, 12, status: ReservationStatus.Finished);
            Reservation foreign = await other.AddReservationAsync(Dates.Today, 20);

            await ApiAssert.ErrorAsync(await PlacementApi.GetAsync(staff, finished.Id), HttpStatusCode.Conflict, "ReservationActionNotAllowed");
            await ApiAssert.ErrorAsync(await PlacementApi.GetAsync(staff, foreign.Id), HttpStatusCode.NotFound, "NotFound");
        }

        [TestMethod]
        public async Task The_snapshot_gives_the_default_duration_of_the_service()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23, duration: 105);

            ServiceSnapshotResponse snapshot = await ServiceApi.GetAsync(staff, $"?day={ReservationApi.Saturday:yyyy-MM-dd}");

            Assert.AreEqual(105, snapshot.Service!.DefaultDuration);
        }

        private static async Task<(TestRestaurant Restaurant, HttpClient Staff, List<Table> Tables)> SalleAsync(params (string, int)[] tables)
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            (_, List<Table> created) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", tables);
            return (restaurant, restaurant.StaffClient(), created);
        }

        [TestMethod]
        public async Task Placing_a_confirmed_reservation_assigns_the_table_and_writes_the_journal()
        {
            (TestRestaurant restaurant, HttpClient staff, List<Table> tables) = await SalleAsync(("5", 4));
            Reservation moreau = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 4, clientName: "Moreau");

            ReservationActionResponse placed = await PlacementApi.PlacedAsync(staff, moreau.Id, tableId: tables[0].Id);

            Assert.AreEqual("5", placed.Reservation.Place!.Name);
            ReservationEventResponse line = placed.Reservation.Events.Last();
            Assert.AreEqual(EventType.Placement, line.Type);
            Assert.AreEqual("5", line.Details);
            Assert.AreEqual(line.Id, placed.EventId);
        }

        [TestMethod]
        public async Task Dropping_a_request_accepts_and_places_it_and_undo_brings_it_back()
        {
            (TestRestaurant restaurant, HttpClient staff, List<Table> tables) = await SalleAsync(("5", 4));
            await ReservationApi.TrackCleaningAsync(restaurant.Id);
            await ServiceApi.MarkToCleanAsync(tables[0].Id, DateTime.UtcNow.AddMinutes(-20));
            Reservation request = await restaurant.AddReservationAsync(Dates.Today, 23, covers: 4, status: ReservationStatus.Pending);

            ReservationActionResponse placed = await PlacementApi.PlacedAsync(staff, request.Id, tableId: tables[0].Id);

            Assert.AreEqual(ReservationStatus.Confirmed, placed.Reservation.Status);
            CollectionAssert.AreEqual(new[] { EventType.Acceptance, EventType.Placement },
                placed.Reservation.Events.Select(e => e.Type).TakeLast(2).ToArray());
            // DISPO-02 : placer nettoie
            Assert.IsNull(await TestApi.WithDbAsync(db => db.Tables.Where(t => t.Id == tables[0].Id).Select(t => t.NeedsCleaningSince).SingleAsync()));

            ReservationResponse back = await ApiAssert.OkAsync<ReservationResponse>(
                await ReservationApi.UndoAsync(staff, request.Id, placed.EventId!.Value));

            Assert.AreEqual(ReservationStatus.Pending, back.Status);
            Assert.IsNull(back.Place);
            Assert.IsFalse(back.Events.Any(e => e.Type is EventType.Acceptance or EventType.Placement));
            Assert.IsNotNull(await TestApi.WithDbAsync(db => db.Tables.Where(t => t.Id == tables[0].Id).Select(t => t.NeedsCleaningSince).SingleAsync()));
        }

        [TestMethod]
        public async Task Changing_table_keeps_the_history_and_undo_puts_the_old_table_back()
        {
            (TestRestaurant restaurant, HttpClient staff, List<Table> tables) = await SalleAsync(("5", 4), ("7", 4));
            Reservation seated = await restaurant.AddReservationAsync(Dates.Today, 20, covers: 4, status: ReservationStatus.Seated);
            await ReservationApi.AssignAsync(seated.Id, tableId: tables[0].Id);

            ReservationActionResponse moved = await PlacementApi.PlacedAsync(staff, seated.Id, tableId: tables[1].Id);

            Assert.AreEqual("7", moved.Reservation.Place!.Name);
            Assert.AreEqual(EventType.Move, moved.Reservation.Events.Last().Type);
            Assert.AreEqual("5 → 7", moved.Reservation.Events.Last().Details);
            Assert.AreEqual(2, await TestApi.WithDbAsync(db => db.Assignments.CountAsync(a => a.ReservationId == seated.Id)));

            ReservationResponse back = await ApiAssert.OkAsync<ReservationResponse>(await ReservationApi.UndoAsync(staff, seated.Id, moved.EventId!.Value));
            Assert.AreEqual("5", back.Place!.Name);
            Assert.AreEqual(ReservationStatus.Seated, back.Status);
        }

        [TestMethod]
        public async Task Undoing_a_move_is_refused_when_the_old_table_was_taken_meanwhile()
        {
            (TestRestaurant restaurant, HttpClient staff, List<Table> tables) = await SalleAsync(("5", 4), ("7", 4));
            Reservation moreau = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 4, clientName: "Moreau");
            Reservation legrand = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 4, clientName: "Legrand");
            await ReservationApi.AssignAsync(moreau.Id, tableId: tables[0].Id);
            ReservationActionResponse moved = await PlacementApi.PlacedAsync(staff, moreau.Id, tableId: tables[1].Id);
            await PlacementApi.PlacedAsync(staff, legrand.Id, tableId: tables[0].Id);

            await ApiAssert.ErrorAsync(await ReservationApi.UndoAsync(staff, moreau.Id, moved.EventId!.Value), HttpStatusCode.Conflict, "PlacementUnavailable");

            Assert.AreEqual("7", (await ReservationApi.GetAsync(staff, moreau.Id)).Place!.Name);
        }

        [TestMethod]
        public async Task Dropping_back_on_the_current_table_changes_nothing()
        {
            (TestRestaurant restaurant, HttpClient staff, List<Table> tables) = await SalleAsync(("5", 4));
            Reservation moreau = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 4);
            await ReservationApi.AssignAsync(moreau.Id, tableId: tables[0].Id);

            ReservationActionResponse placed = await PlacementApi.PlacedAsync(staff, moreau.Id, tableId: tables[0].Id);

            Assert.IsNull(placed.EventId);
            Assert.AreEqual("5", placed.Reservation.Place!.Name);
            Assert.AreEqual(1, await TestApi.WithDbAsync(db => db.Assignments.CountAsync(a => a.ReservationId == moreau.Id)));
            Assert.IsFalse(placed.Reservation.Events.Any(e => e.Type is EventType.Move or EventType.Placement));
        }

        [TestMethod]
        public async Task Moving_seated_guests_leaves_the_old_table_to_clean_and_undo_restores_it()
        {
            (TestRestaurant restaurant, HttpClient staff, List<Table> tables) = await SalleAsync(("5", 4), ("7", 4));
            await ReservationApi.TrackCleaningAsync(restaurant.Id);
            Reservation seated = await restaurant.AddReservationAsync(Dates.Today, 23, covers: 4, status: ReservationStatus.Seated);
            await ReservationApi.AssignAsync(seated.Id, tableId: tables[0].Id);
            Task<DateTime?> DirtySince(Guid tableId) => TestApi.WithDbAsync(db => db.Tables.Where(t => t.Id == tableId).Select(t => t.NeedsCleaningSince).SingleAsync());

            ReservationActionResponse moved = await PlacementApi.PlacedAsync(staff, seated.Id, tableId: tables[1].Id);
            Assert.IsNotNull(await DirtySince(tables[0].Id));

            await ApiAssert.OkAsync<ReservationResponse>(await ReservationApi.UndoAsync(staff, seated.Id, moved.EventId!.Value));
            Assert.IsNull(await DirtySince(tables[0].Id));
        }

        [TestMethod]
        public async Task Placing_another_day_leaves_a_table_dirty_now_as_it_is()
        {
            (TestRestaurant restaurant, HttpClient staff, List<Table> tables) = await SalleAsync(("5", 4));
            await ReservationApi.TrackCleaningAsync(restaurant.Id);
            await ServiceApi.MarkToCleanAsync(tables[0].Id, DateTime.UtcNow.AddMinutes(-20));
            Reservation tomorrow = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 4);

            Assert.AreEqual(PlacementLevel.Perfect, PlacementApi.Entity(await PlacementApi.VerdictsAsync(staff, tomorrow.Id), "5").Level);
            await PlacementApi.PlacedAsync(staff, tomorrow.Id, tableId: tables[0].Id);

            Assert.IsNotNull(await TestApi.WithDbAsync(db => db.Tables.Where(t => t.Id == tables[0].Id).Select(t => t.NeedsCleaningSince).SingleAsync()));
        }

        [TestMethod]
        public async Task A_combination_with_an_inactive_table_is_not_offered()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("12", 4), ("13", 4));
            await PlacementApi.ActivateAsync(await ReservationApi.AddCombinationAsync(zoneId, "12-13", 8, tables[0].Id, tables[1].Id));
            await TestApi.WithDbAsync(db => db.Tables.Where(t => t.Id == tables[1].Id).ExecuteUpdateAsync(s => s.SetProperty(t => t.IsActive, false)));
            Reservation nguyen = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 4);

            PlacementResponse placement = await PlacementApi.VerdictsAsync(staff, nguyen.Id);

            CollectionAssert.AreEqual(new[] { "12" }, placement.Entities.Select(e => e.Name).ToArray());
            Assert.AreEqual(PlacementLevel.Perfect, placement.Entities.Single().Level);
        }

        [TestMethod]
        public async Task A_table_and_its_combination_dropped_on_at_once_place_only_one()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("12", 4), ("13", 4));
            Guid combination = await ReservationApi.AddCombinationAsync(zoneId, "12-13", 8, tables[0].Id, tables[1].Id);
            await PlacementApi.ActivateAsync(combination);
            for (int round = 0; round < 5; round++)
            {
                DateOnly day = Dates.Today.AddDays(1 + round);
                Reservation a = await restaurant.AddReservationAsync(day, 20, covers: 4);
                Reservation b = await restaurant.AddReservationAsync(day, 20, minute: 30, covers: 8);

                HttpResponseMessage[] responses = await Task.WhenAll(
                    Task.Run(() => PlacementApi.PlaceAsync(staff, a.Id, tableId: tables[0].Id)),
                    Task.Run(() => PlacementApi.PlaceAsync(staff, b.Id, combinationId: combination)));

                Assert.AreEqual(1, responses.Count(r => r.StatusCode == HttpStatusCode.OK), string.Join(", ", responses.Select(r => (int)r.StatusCode)));
                Assert.AreEqual(1, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
            }
        }

        [TestMethod]
        public async Task An_active_combination_can_be_placed_on()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("12", 4), ("13", 4));
            Guid combination = await ReservationApi.AddCombinationAsync(zoneId, "12-13", 8, tables[0].Id, tables[1].Id);
            await PlacementApi.ActivateAsync(combination);
            Reservation nguyen = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 8);

            ReservationActionResponse placed = await PlacementApi.PlacedAsync(staff, nguyen.Id, combinationId: combination);

            Assert.AreEqual("12-13", placed.Reservation.Place!.Name);
        }

        [TestMethod]
        public async Task A_table_taken_in_the_meantime_is_refused()
        {
            (TestRestaurant restaurant, HttpClient staff, List<Table> tables) = await SalleAsync(("5", 4));
            Reservation first = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 4);
            Reservation second = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 21, covers: 4);
            await PlacementApi.PlacedAsync(staff, first.Id, tableId: tables[0].Id);

            await ApiAssert.ErrorAsync(await PlacementApi.PlaceAsync(staff, second.Id, tableId: tables[0].Id), HttpStatusCode.Conflict, "PlacementUnavailable");
        }

        [TestMethod]
        public async Task Two_tablets_dropping_on_the_same_table_at_once_place_only_one()
        {
            (TestRestaurant restaurant, HttpClient staff, List<Table> tables) = await SalleAsync(("5", 4));
            for (int round = 0; round < 5; round++)
            {
                DateOnly day = Dates.Today.AddDays(1 + round);
                Reservation a = await restaurant.AddReservationAsync(day, 20, covers: 4);
                Reservation b = await restaurant.AddReservationAsync(day, 20, minute: 30, covers: 4);

                HttpResponseMessage[] responses = await Task.WhenAll(
                    Task.Run(() => PlacementApi.PlaceAsync(staff, a.Id, tableId: tables[0].Id)),
                    Task.Run(() => PlacementApi.PlaceAsync(staff, b.Id, tableId: tables[0].Id)));

                Assert.AreEqual(1, responses.Count(r => r.StatusCode == HttpStatusCode.OK), string.Join(", ", responses.Select(r => (int)r.StatusCode)));
                Assert.AreEqual(1, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
            }
        }

        [TestMethod]
        public async Task A_target_must_be_exactly_one_table_or_one_combination_of_this_restaurant()
        {
            (TestRestaurant restaurant, HttpClient staff, List<Table> tables) = await SalleAsync(("5", 4));
            (TestRestaurant other, _, List<Table> foreign) = await SalleAsync(("9", 4));
            Reservation moreau = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 4);

            await ApiAssert.ErrorAsync(await PlacementApi.PlaceAsync(staff, moreau.Id), HttpStatusCode.BadRequest, "InvalidRequest");
            await ApiAssert.ErrorAsync(await PlacementApi.PlaceAsync(staff, moreau.Id, tableId: tables[0].Id, combinationId: Guid.NewGuid()),
                HttpStatusCode.BadRequest, "InvalidRequest");
            await ApiAssert.ErrorAsync(await PlacementApi.PlaceAsync(staff, moreau.Id, tableId: foreign[0].Id), HttpStatusCode.NotFound, "NotFound");
        }

        [TestMethod]
        public async Task Placing_notifies_the_screens()
        {
            (TestRestaurant restaurant, HttpClient staff, List<Table> tables) = await SalleAsync(("5", 4));
            Reservation moreau = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 4);
            await using Screen screen = await Screen.ConnectAsync(restaurant.StaffJwt());

            await PlacementApi.PlacedAsync(staff, moreau.Id, tableId: tables[0].Id);

            Assert.AreEqual(DataScope.Reservations, await screen.NextAsync());
        }
    }
}
