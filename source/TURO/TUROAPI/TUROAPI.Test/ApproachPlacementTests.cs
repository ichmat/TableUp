namespace TUROAPI.Test
{
    /// <summary>PLACE-08, RAPP-04 : placer sur des tables à rapprocher — une combinaison en sommeil, ou une paire qui naît au dépôt</summary>
    [TestClass]
    public sealed class ApproachPlacementTests
    {
        private sealed record Arranged(TestRestaurant Restaurant, HttpClient Staff, Guid ZoneId, List<Table> Tables, Reservation Nguyen);

        private static async Task<Arranged> ArrangeAsync()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("12", 4), ("13", 4), ("14", 4));
            Reservation nguyen = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 8, clientName: "Nguyen");
            return new Arranged(restaurant, restaurant.StaffClient(), zoneId, tables, nguyen);
        }

        [TestMethod]
        public async Task Placing_on_a_dormant_combination_plans_its_approach()
        {
            (_, HttpClient staff, Guid zoneId, List<Table> tables, Reservation nguyen) = await ArrangeAsync();
            Guid dormant = await ReservationApi.AddCombinationAsync(zoneId, "12-13", 8, tables[0].Id, tables[1].Id);

            ReservationActionResponse placed = await PlacementApi.PlacedAsync(staff, nguyen.Id, combinationId: dormant);

            Assert.AreEqual("12-13", placed.Reservation.Place!.Name);
            Combination stored = await CombinationApi.StoredAsync(dormant);
            Assert.IsFalse(stored.IsActive);
            Assert.AreEqual(nguyen.Start, stored.ActivateAt);
        }

        [TestMethod]
        public async Task Placing_on_a_new_pair_creates_it_dormant_and_plans_its_approach()
        {
            (TestRestaurant restaurant, HttpClient staff, _, List<Table> tables, Reservation nguyen) = await ArrangeAsync();

            ReservationActionResponse placed = await ApiAssert.OkAsync<ReservationActionResponse>(
                await PlacementApi.PlaceNewAsync(staff, nguyen.Id, [tables[0].Id, tables[1].Id], "Banquette", 8));

            Assert.AreEqual("Banquette", placed.Reservation.Place!.Name);
            Combination created = await TestApi.WithDbAsync(db => db.Combinations.Include(c => c.Tables).AsNoTracking().SingleAsync(c => c.Name == "Banquette" && c.Zone.RestaurantId == restaurant.Id));
            Assert.IsFalse(created.IsActive);
            Assert.AreEqual(8, created.Capacity);
            Assert.AreEqual(nguyen.Start, created.ActivateAt);
            CollectionAssert.AreEquivalent(new[] { tables[0].Id, tables[1].Id }, created.Tables.Select(t => t.Id).ToArray());
        }

        [TestMethod]
        public async Task The_new_combination_joins_the_open_draft()
        {
            (TestRestaurant restaurant, HttpClient staff, Guid zoneId, List<Table> tables, Reservation nguyen) = await ArrangeAsync();
            using HttpClient admin = restaurant.AdminClient();
            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent
            {
                Tables = [.. tables.Select(t => PlanApi.Table(zoneId, t.Name, x: t.X, y: t.Y, capacity: t.Capacity, id: t.Id))],
            }));

            await ApiAssert.OkAsync<ReservationActionResponse>(await PlacementApi.PlaceNewAsync(staff, nguyen.Id, [tables[1].Id, tables[2].Id], "13-14", 8));

            FloorPlanDraftResponse draft = await ApiAssert.OkAsync<FloorPlanDraftResponse>(await admin.GetAsync("api/restaurant/floor-plan/draft"));
            DraftCombinationItem joined = draft.Combinations.Single();
            Assert.AreEqual("13-14", joined.Name);
            Assert.IsFalse(joined.IsActive);
            CollectionAssert.AreEquivalent(new[] { tables[1].Id, tables[2].Id }, joined.TableIds);
        }

        [TestMethod]
        public async Task Undoing_the_placement_removes_the_combination_born_with_it()
        {
            (TestRestaurant restaurant, HttpClient staff, Guid zoneId, List<Table> tables, Reservation nguyen) = await ArrangeAsync();
            using HttpClient admin = restaurant.AdminClient();
            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent
            {
                Tables = [.. tables.Select(t => PlanApi.Table(zoneId, t.Name, x: t.X, y: t.Y, capacity: t.Capacity, id: t.Id))],
            }));
            ReservationActionResponse placed = await ApiAssert.OkAsync<ReservationActionResponse>(
                await PlacementApi.PlaceNewAsync(staff, nguyen.Id, [tables[0].Id, tables[1].Id], "12-13", 8));

            ReservationResponse back = await ApiAssert.OkAsync<ReservationResponse>(await ReservationApi.UndoAsync(staff, nguyen.Id, placed.EventId!.Value));

            Assert.IsNull(back.Place);
            Assert.AreEqual(0, await TestApi.WithDbAsync(db => db.Combinations.CountAsync(c => c.Zone.RestaurantId == restaurant.Id)));
            FloorPlanDraftResponse draft = await ApiAssert.OkAsync<FloorPlanDraftResponse>(await admin.GetAsync("api/restaurant/floor-plan/draft"));
            Assert.AreEqual(0, draft.Combinations.Count);
        }

        [TestMethod]
        public async Task A_new_pair_needs_a_free_name_and_two_tables_no_combination_joins()
        {
            (_, HttpClient staff, Guid zoneId, List<Table> tables, Reservation nguyen) = await ArrangeAsync();
            await ReservationApi.AddCombinationAsync(zoneId, "13-14", 8, tables[1].Id, tables[2].Id);

            await ApiAssert.ErrorAsync(await PlacementApi.PlaceNewAsync(staff, nguyen.Id, [tables[0].Id, tables[1].Id], "12", 8),
                HttpStatusCode.Forbidden, "InvalidModification");
            await ApiAssert.ErrorAsync(await PlacementApi.PlaceNewAsync(staff, nguyen.Id, [tables[0].Id, tables[0].Id], "12-12", 8),
                HttpStatusCode.BadRequest, "InvalidRequest");
            await ApiAssert.ErrorAsync(await PlacementApi.PlaceNewAsync(staff, nguyen.Id, [tables[1].Id, tables[2].Id], "Autre", 8),
                HttpStatusCode.BadRequest, "InvalidRequest");
            await ApiAssert.ErrorAsync(await PlacementApi.PlaceAsync(staff, nguyen.Id, tableId: tables[0].Id, combinationId: Guid.NewGuid()),
                HttpStatusCode.BadRequest, "InvalidRequest");
        }


        [TestMethod]
        public async Task A_placed_reservation_moves_onto_a_new_pair_containing_its_table()
        {
            (_, HttpClient staff, _, List<Table> tables, Reservation nguyen) = await ArrangeAsync();
            await ReservationApi.AssignAsync(nguyen.Id, tableId: tables[0].Id);

            ReservationActionResponse moved = await ApiAssert.OkAsync<ReservationActionResponse>(
                await PlacementApi.PlaceNewAsync(staff, nguyen.Id, [tables[0].Id, tables[1].Id], "12-13", 8));

            Assert.IsNotNull(moved.EventId);
            Assert.AreEqual("12-13", moved.Reservation.Place!.Name);
            Assert.AreEqual(1, await TestApi.WithDbAsync(db => db.Combinations.CountAsync(c => c.Name == "12-13" && c.Zone.RestaurantId == nguyen.RestaurantId)));
        }
        [TestMethod]
        public async Task A_pair_with_a_taken_table_is_refused()
        {
            (TestRestaurant restaurant, HttpClient staff, _, List<Table> tables, Reservation nguyen) = await ArrangeAsync();
            Reservation legrand = await restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 4, clientName: "Legrand");
            await ReservationApi.AssignAsync(legrand.Id, tableId: tables[0].Id);

            await ApiAssert.ErrorAsync(await PlacementApi.PlaceNewAsync(staff, nguyen.Id, [tables[0].Id, tables[1].Id], "12-13", 8),
                HttpStatusCode.Conflict, "PlacementUnavailable");
        }
    }
}
