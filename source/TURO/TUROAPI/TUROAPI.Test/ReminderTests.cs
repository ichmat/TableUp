namespace TUROAPI.Test
{
    /// <summary>COMB-06, COMB-07 : le logiciel sonne, l'utilisateur répond — rien n'expire, rien ne bascule seul</summary>
    [TestClass]
    public sealed class ReminderTests
    {
        private sealed record Arranged(TestRestaurant Restaurant, HttpClient Staff, Guid ZoneId, List<Table> Tables, Guid Combination, Reservation Nguyen) : IDisposable
        {
            public void Dispose() => Staff.Dispose();
        }

        /// <summary>Nguyen (8 p.) attendu depuis 10 min sur 12-13, en sommeil : le rappel de rapprochement est dû</summary>
        private static async Task<Arranged> ApproachDueAsync()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("12", 4), ("13", 4), ("14", 4));
            Guid combination = await ReservationApi.AddCombinationAsync(zoneId, "12-13", 8, tables[0].Id, tables[1].Id);
            Reservation nguyen = await restaurant.AddReservationAsync(Dates.Today, 20, covers: 8, clientName: "Nguyen");
            await CombinationApi.StartsAtAsync(nguyen.Id, DateTime.UtcNow.AddMinutes(-10));
            await ReservationApi.AssignAsync(nguyen.Id, combinationId: combination);
            await CombinationApi.RecomputeAsync(restaurant.Id);
            return new Arranged(restaurant, restaurant.StaffClient(), zoneId, tables, combination, nguyen);
        }

        [TestMethod]
        public async Task A_due_approach_names_its_tables_and_its_reservation()
        {
            using Arranged a = await ApproachDueAsync();

            CombinationReminderResponse reminder = (await CombinationApi.RemindersAsync(a.Staff)).Single();

            Assert.AreEqual(CombinationReminderKind.Approach, reminder.Kind);
            Assert.AreEqual("12-13", reminder.Name);
            CollectionAssert.AreEqual(new[] { "12", "13" }, reminder.TableNames);
            Assert.AreEqual("Nguyen", reminder.Reservation!.GuestName);
            Assert.AreEqual(8, reminder.Reservation.Covers);
            Assert.AreEqual(ReservationStatus.Confirmed, reminder.Reservation.Status);
            Assert.AreEqual(Dates.Today, reminder.Reservation.ServiceDay);
            Assert.IsNull(reminder.Reservation.ClaimedTable);
            Assert.IsTrue(reminder.DueAt <= DateTime.UtcNow);
        }

        [TestMethod]
        public async Task Done_glues_the_tables_and_undo_separates_them_again()
        {
            using Arranged a = await ApproachDueAsync();

            Guid undo = await CombinationApi.AnsweredAsync(a.Staff, a.Combination, CombinationReminderKind.Approach, ReminderAnswer.Done);
            Combination glued = await CombinationApi.StoredAsync(a.Combination);
            Assert.IsTrue(glued.IsActive);
            Assert.IsNull(glued.ActivateAt);
            Assert.IsEmpty(await CombinationApi.RemindersAsync(a.Staff));

            Assert.AreEqual(HttpStatusCode.NoContent, (await CombinationApi.UndoAsync(a.Staff, undo)).StatusCode);
            Combination back = await CombinationApi.StoredAsync(a.Combination);
            Assert.IsFalse(back.IsActive);
            Assert.IsNotNull(back.ActivateAt);
        }

        [TestMethod]
        public async Task Done_separates_the_glued_combination_that_shares_a_table()
        {
            using Arranged a = await ApproachDueAsync();
            Guid other = await ReservationApi.AddCombinationAsync(a.ZoneId, "13-14", 8, a.Tables[1].Id, a.Tables[2].Id);
            await PlacementApi.ActivateAsync(other);

            CollectionAssert.AreEqual(new[] { "13-14" }, (await CombinationApi.RemindersAsync(a.Staff)).Single(r => r.Name == "12-13").Separates);
            await CombinationApi.AnsweredAsync(a.Staff, a.Combination, CombinationReminderKind.Approach, ReminderAnswer.Done);

            Assert.IsFalse((await CombinationApi.StoredAsync(other)).IsActive);
            Assert.IsTrue((await CombinationApi.StoredAsync(a.Combination)).IsActive);
        }

        [TestMethod]
        public async Task Later_brings_the_reminder_back_in_ten_minutes()
        {
            using Arranged a = await ApproachDueAsync();

            await CombinationApi.AnsweredAsync(a.Staff, a.Combination, CombinationReminderKind.Approach, ReminderAnswer.Later);

            CombinationReminderResponse reminder = (await CombinationApi.RemindersAsync(a.Staff)).Single();
            Assert.IsTrue(reminder.DueAt > DateTime.UtcNow.AddMinutes(9));
            Assert.IsTrue(reminder.DueAt <= DateTime.UtcNow.AddMinutes(10));
        }

        [TestMethod]
        public async Task Undoing_Later_brings_the_reminder_back_as_due()
        {
            using Arranged a = await ApproachDueAsync();
            Guid undo = await CombinationApi.AnsweredAsync(a.Staff, a.Combination, CombinationReminderKind.Approach, ReminderAnswer.Later);

            Assert.AreEqual(HttpStatusCode.NoContent, (await CombinationApi.UndoAsync(a.Staff, undo)).StatusCode);

            Assert.IsNull((await CombinationApi.StoredAsync(a.Combination)).SnoozedUntil);
            Assert.IsLessThanOrEqualTo(DateTime.UtcNow, (await CombinationApi.RemindersAsync(a.Staff)).Single().DueAt);
        }

        [TestMethod]
        public async Task Abandon_leaves_another_reservation_of_the_combination_placed()
        {
            using Arranged a = await ApproachDueAsync();
            Reservation later = await a.Restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 8, clientName: "Legrand");
            await ReservationApi.AssignAsync(later.Id, combinationId: a.Combination);
            await CombinationApi.RecomputeAsync(a.Restaurant.Id);

            await CombinationApi.AnsweredAsync(a.Staff, a.Combination, CombinationReminderKind.Approach, ReminderAnswer.Abandon);

            Assert.IsNull((await ReservationApi.GetAsync(a.Staff, a.Nguyen.Id)).Place);
            Assert.AreEqual("12-13", (await ReservationApi.GetAsync(a.Staff, later.Id)).Place!.Name);
        }

        [TestMethod]
        public async Task Abandon_sends_the_reservation_back_to_place_and_undo_puts_it_back()
        {
            using Arranged a = await ApproachDueAsync();

            Guid undo = await CombinationApi.AnsweredAsync(a.Staff, a.Combination, CombinationReminderKind.Approach, ReminderAnswer.Abandon);

            ReservationResponse alone = await ReservationApi.GetAsync(a.Staff, a.Nguyen.Id);
            Assert.IsNull(alone.Place);
            Assert.AreEqual(ReservationStatus.Confirmed, alone.Status);
            Assert.AreEqual("Rapprochement 12-13 abandonné", alone.Events.Last().Details);
            Assert.IsNull((await CombinationApi.StoredAsync(a.Combination)).ActivateAt);

            Assert.AreEqual(HttpStatusCode.NoContent, (await CombinationApi.UndoAsync(a.Staff, undo)).StatusCode);
            ReservationResponse back = await ReservationApi.GetAsync(a.Staff, a.Nguyen.Id);
            Assert.AreEqual("12-13", back.Place!.Name);
            Assert.IsFalse(back.Events.Any(e => e.Details == "Rapprochement 12-13 abandonné"));
        }

        [TestMethod]
        public async Task Abandon_is_refused_once_the_guests_are_seated()
        {
            using Arranged a = await ApproachDueAsync();
            await ReservationApi.DoAsync(a.Staff, a.Nguyen.Id, "arrive");

            Assert.AreEqual(ReservationStatus.Seated, (await CombinationApi.RemindersAsync(a.Staff)).Single().Reservation!.Status);
            await ApiAssert.ErrorAsync(await CombinationApi.AnswerAsync(a.Staff, a.Combination, CombinationReminderKind.Approach, ReminderAnswer.Abandon),
                HttpStatusCode.Conflict, "ReservationActionNotAllowed");
            Assert.AreEqual("12-13", (await ReservationApi.GetAsync(a.Staff, a.Nguyen.Id)).Place!.Name);
        }

        [TestMethod]
        public async Task Two_tablets_gluing_combinations_that_share_a_table_leave_one_glued()
        {
            using Arranged a = await ApproachDueAsync();
            Guid other = await ReservationApi.AddCombinationAsync(a.ZoneId, "13-14", 8, a.Tables[1].Id, a.Tables[2].Id);
            Reservation legrand = await a.Restaurant.AddReservationAsync(Dates.Today, 20, covers: 8, clientName: "Legrand");
            await CombinationApi.StartsAtAsync(legrand.Id, DateTime.UtcNow.AddMinutes(-10));
            await ReservationApi.AssignAsync(legrand.Id, combinationId: other);
            await CombinationApi.RecomputeAsync(a.Restaurant.Id);
            using HttpClient second = a.Restaurant.StaffClient();

            HttpResponseMessage[] answers = await Task.WhenAll(
                CombinationApi.AnswerAsync(a.Staff, a.Combination, CombinationReminderKind.Approach, ReminderAnswer.Done),
                CombinationApi.AnswerAsync(second, other, CombinationReminderKind.Approach, ReminderAnswer.Done));

            foreach (HttpResponseMessage answer in answers)
            {
                // La seconde réponse trouve un rappel changé, ou passe et sépare la première (COMB-04)
                Assert.IsTrue(answer.StatusCode is HttpStatusCode.OK or HttpStatusCode.Conflict, $"{answer.StatusCode}");
            }
            bool[] glued = [(await CombinationApi.StoredAsync(a.Combination)).IsActive, (await CombinationApi.StoredAsync(other)).IsActive];
            Assert.AreEqual(1, glued.Count(g => g));
        }

        [TestMethod]
        public async Task Abandon_also_forgets_an_older_table()
        {
            using Arranged a = await ApproachDueAsync();
            // Nguyen était d'abord sur la 14 : retirer la seule affectation de 12-13 le renverrait sur la 14
            await TestApi.WithDbAsync(db =>
            {
                db.Assignments.Add(new Assignment { Id = Guid.NewGuid(), ReservationId = a.Nguyen.Id, TableId = a.Tables[2].Id, AssignedAt = DateTime.UtcNow.AddHours(-1) });
                return db.SaveChangesAsync();
            });

            await CombinationApi.AnsweredAsync(a.Staff, a.Combination, CombinationReminderKind.Approach, ReminderAnswer.Abandon);

            Assert.IsNull((await ReservationApi.GetAsync(a.Staff, a.Nguyen.Id)).Place);
        }

        [TestMethod]
        public async Task Keeping_tables_together_waits_for_another_claim()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("12", 4), ("13", 4));
            Guid combination = await ReservationApi.AddCombinationAsync(zoneId, "12-13", 8, tables[0].Id, tables[1].Id);
            await PlacementApi.ActivateAsync(combination);
            Reservation moreau = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 4, clientName: "Moreau");
            await ReservationApi.AssignAsync(moreau.Id, tableId: tables[0].Id);
            await CombinationApi.RecomputeAsync(restaurant.Id);

            CombinationReminderResponse separate = (await CombinationApi.RemindersAsync(staff)).Single();
            Assert.AreEqual(CombinationReminderKind.Separate, separate.Kind);
            Assert.AreEqual("Moreau", separate.Reservation!.GuestName);
            Assert.AreEqual("12", separate.Reservation.ClaimedTable);
            Assert.AreEqual(Dates.Today.AddDays(1), separate.Reservation.ServiceDay);

            await CombinationApi.AnsweredAsync(staff, combination, CombinationReminderKind.Separate, ReminderAnswer.KeepTogether);
            Assert.IsEmpty(await CombinationApi.RemindersAsync(staff));
            Assert.AreEqual(moreau.Id, (await CombinationApi.StoredAsync(combination)).KeepGluedFor);

            Reservation legrand = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 23, covers: 4, clientName: "Legrand");
            await ReservationApi.AssignAsync(legrand.Id, tableId: tables[1].Id);
            await CombinationApi.RecomputeAsync(restaurant.Id);

            Assert.AreEqual("Legrand", (await CombinationApi.RemindersAsync(staff)).Single().Reservation!.GuestName);
        }

        [TestMethod]
        public async Task Separate_puts_the_tables_back_to_sleep()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("12", 4), ("13", 4));
            Guid combination = await ReservationApi.AddCombinationAsync(zoneId, "12-13", 8, tables[0].Id, tables[1].Id);
            await PlacementApi.ActivateAsync(combination);
            Reservation moreau = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 4, clientName: "Moreau");
            await ReservationApi.AssignAsync(moreau.Id, tableId: tables[0].Id);
            await CombinationApi.RecomputeAsync(restaurant.Id);

            await CombinationApi.AnsweredAsync(staff, combination, CombinationReminderKind.Separate, ReminderAnswer.Separate);

            Combination stored = await CombinationApi.StoredAsync(combination);
            Assert.IsFalse(stored.IsActive);
            Assert.IsNull(stored.DeactivateAt);
        }

        [TestMethod]
        public async Task A_no_show_on_glued_tables_asks_to_separate()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("12", 4), ("13", 4));
            Guid combination = await ReservationApi.AddCombinationAsync(zoneId, "12-13", 8, tables[0].Id, tables[1].Id);
            await PlacementApi.ActivateAsync(combination);
            Reservation nguyen = await restaurant.AddReservationAsync(Dates.Today, 20, covers: 8, clientName: "Nguyen");
            await CombinationApi.StartsAtAsync(nguyen.Id, DateTime.UtcNow.AddMinutes(-30));
            await ReservationApi.AssignAsync(nguyen.Id, combinationId: combination);
            await ReservationApi.DoAsync(staff, nguyen.Id, "no-show");

            CombinationReminderResponse reminder = (await CombinationApi.RemindersAsync(staff)).Single();
            Assert.AreEqual(CombinationReminderKind.AfterNoShow, reminder.Kind);
            Assert.AreEqual("Nguyen", reminder.Reservation!.GuestName);

            await CombinationApi.AnsweredAsync(staff, combination, CombinationReminderKind.AfterNoShow, ReminderAnswer.KeepTogether);
            Assert.IsEmpty(await CombinationApi.RemindersAsync(staff));
            Assert.IsTrue((await CombinationApi.StoredAsync(combination)).IsActive);
        }

        [TestMethod]
        public async Task An_outdated_or_mismatched_answer_is_refused()
        {
            using Arranged a = await ApproachDueAsync();

            await ApiAssert.ErrorAsync(await CombinationApi.AnswerAsync(a.Staff, a.Combination, CombinationReminderKind.Separate, ReminderAnswer.Separate),
                HttpStatusCode.Conflict, "ReminderChanged");
            await ApiAssert.ErrorAsync(await CombinationApi.AnswerAsync(a.Staff, a.Combination, CombinationReminderKind.Approach, ReminderAnswer.KeepTogether),
                HttpStatusCode.BadRequest, "InvalidRequest");

            await CombinationApi.AnsweredAsync(a.Staff, a.Combination, CombinationReminderKind.Approach, ReminderAnswer.Done);
            // La seconde tablette répond au même rappel : il n'existe plus
            await ApiAssert.ErrorAsync(await CombinationApi.AnswerAsync(a.Staff, a.Combination, CombinationReminderKind.Approach, ReminderAnswer.Done),
                HttpStatusCode.Conflict, "ReminderChanged");
        }

        [TestMethod]
        public async Task Undo_is_refused_once_the_combination_changed_again()
        {
            using Arranged a = await ApproachDueAsync();
            Guid undo = await CombinationApi.AnsweredAsync(a.Staff, a.Combination, CombinationReminderKind.Approach, ReminderAnswer.Done);
            await TestApi.WithDbAsync(db => db.Combinations.Where(c => c.Id == a.Combination)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.IsActive, false)));

            await ApiAssert.ErrorAsync(await CombinationApi.UndoAsync(a.Staff, undo), HttpStatusCode.Conflict, "UndoExpired");
        }

        [TestMethod]
        public async Task Another_restaurant_neither_sees_nor_answers_my_reminders()
        {
            using Arranged a = await ApproachDueAsync();
            TestRestaurant other = await TestRestaurant.CreateAsync();
            using HttpClient intruder = other.StaffClient();

            Assert.IsEmpty(await CombinationApi.RemindersAsync(intruder));
            await ApiAssert.ErrorAsync(await CombinationApi.AnswerAsync(intruder, a.Combination, CombinationReminderKind.Approach, ReminderAnswer.Done),
                HttpStatusCode.NotFound, "NotFound");
            Guid undo = await CombinationApi.AnsweredAsync(a.Staff, a.Combination, CombinationReminderKind.Approach, ReminderAnswer.Later);
            await ApiAssert.ErrorAsync(await CombinationApi.UndoAsync(intruder, undo), HttpStatusCode.Conflict, "UndoExpired");
        }
    }
}
