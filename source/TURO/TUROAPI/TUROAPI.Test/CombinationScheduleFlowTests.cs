namespace TUROAPI.Test
{
    /// <summary>COMB-01 : les dates sont recalculées à chaque geste, dans la transaction du geste</summary>
    [TestClass]
    public sealed class CombinationScheduleFlowTests
    {
        private sealed record Arranged(TestRestaurant Restaurant, HttpClient Staff, List<Table> Tables, Guid Combination);

        private static async Task<Arranged> ArrangeAsync()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("12", 4), ("13", 4), ("14", 4));
            Guid combination = await ReservationApi.AddCombinationAsync(zoneId, "12-13", 8, tables[0].Id, tables[1].Id);
            return new Arranged(restaurant, restaurant.StaffClient(), tables, combination);
        }

        [TestMethod]
        public async Task Cancelling_the_reservation_drops_the_planned_approach()
        {
            (TestRestaurant restaurant, HttpClient staff, _, Guid combination) = await ArrangeAsync();
            Reservation nguyen = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 8, clientName: "Nguyen");
            await ReservationApi.AssignAsync(nguyen.Id, combinationId: combination);
            await CombinationApi.RecomputeAsync(restaurant.Id);
            Assert.AreEqual(nguyen.Start, (await CombinationApi.StoredAsync(combination)).ActivateAt);

            await ReservationApi.DoAsync(staff, nguyen.Id, "cancel");

            Assert.IsNull((await CombinationApi.StoredAsync(combination)).ActivateAt);
        }

        [TestMethod]
        public async Task Placing_a_member_table_alone_plans_the_separation()
        {
            (TestRestaurant restaurant, HttpClient staff, List<Table> tables, Guid combination) = await ArrangeAsync();
            await PlacementApi.ActivateAsync(combination);
            Reservation moreau = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 4, clientName: "Moreau");

            await PlacementApi.PlacedAsync(staff, moreau.Id, tableId: tables[0].Id);

            Combination stored = await CombinationApi.StoredAsync(combination);
            Assert.IsTrue(stored.IsActive);
            Assert.IsNotNull(stored.DeactivateAt);
        }

        [TestMethod]
        public async Task A_no_show_on_glued_tables_asks_to_separate_until_it_is_undone()
        {
            (TestRestaurant restaurant, HttpClient staff, _, Guid combination) = await ArrangeAsync();
            await PlacementApi.ActivateAsync(combination);
            Reservation nguyen = await restaurant.AddReservationAsync(Dates.Today, 20, covers: 8, clientName: "Nguyen");
            await CombinationApi.StartsAtAsync(nguyen.Id, DateTime.UtcNow.AddMinutes(-30));
            await ReservationApi.AssignAsync(nguyen.Id, combinationId: combination);

            ReservationActionResponse noShow = await ReservationApi.DoAsync(staff, nguyen.Id, "no-show");
            Assert.AreEqual(nguyen.Id, (await CombinationApi.StoredAsync(combination)).SeparateAfterNoShowOf);

            await ApiAssert.OkAsync<ReservationResponse>(await ReservationApi.UndoAsync(staff, nguyen.Id, noShow.EventId!.Value));
            Assert.IsNull((await CombinationApi.StoredAsync(combination)).SeparateAfterNoShowOf);
        }

        [TestMethod]
        public async Task A_no_show_followed_by_another_reservation_on_the_same_tables_asks_nothing()
        {
            (TestRestaurant restaurant, HttpClient staff, _, Guid combination) = await ArrangeAsync();
            await PlacementApi.ActivateAsync(combination);
            Reservation nguyen = await restaurant.AddReservationAsync(Dates.Today, 20, covers: 8, clientName: "Nguyen");
            await CombinationApi.StartsAtAsync(nguyen.Id, DateTime.UtcNow.AddMinutes(-30));
            await ReservationApi.AssignAsync(nguyen.Id, combinationId: combination);
            Reservation chen = await restaurant.AddReservationAsync(Dates.Today, 22, covers: 7, clientName: "Chen");
            await CombinationApi.StartsAtAsync(chen.Id, DateTime.UtcNow.AddMinutes(90));
            await ReservationApi.AssignAsync(chen.Id, combinationId: combination);

            await ReservationApi.DoAsync(staff, nguyen.Id, "no-show");

            Assert.IsNull((await CombinationApi.StoredAsync(combination)).SeparateAfterNoShowOf);
        }

        [TestMethod]
        public async Task Publishing_the_plan_recomputes_the_dates()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ZoneResponse salle = await PlanApi.AddZoneAsync(admin);
            DraftTableItem t12 = PlanApi.Table(salle.Id, "12", x: 1);
            DraftTableItem t13 = PlanApi.Table(salle.Id, "13", x: 3);
            DraftCombinationItem pair = PlanApi.Combination("12-13", 8, false, t12.Id, t13.Id);
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t12, t13], Combinations = [pair] });
            Reservation nguyen = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 8, clientName: "Nguyen");
            await ReservationApi.AssignAsync(nguyen.Id, combinationId: pair.Id);

            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t12, t13], Combinations = [pair] });
            Assert.AreEqual(nguyen.Start, (await CombinationApi.StoredAsync(pair.Id)).ActivateAt);

            // Collée dans l'éditeur : la date de rapprochement n'a plus lieu d'être, la contrainte le garantit
            pair.IsActive = true;
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t12, t13], Combinations = [pair] });
            Combination glued = await CombinationApi.StoredAsync(pair.Id);
            Assert.IsTrue(glued.IsActive);
            Assert.IsNull(glued.ActivateAt);
        }
    }
}
