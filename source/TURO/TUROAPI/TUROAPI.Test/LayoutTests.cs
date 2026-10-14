namespace TUROAPI.Test
{
    /// <summary>« Éditer le plan » en service : déplacer, coller, séparer — pour les deux rôles, tout de suite, et défaisable</summary>
    [TestClass]
    public sealed class LayoutTests
    {
        private sealed record Arranged(TestRestaurant Restaurant, HttpClient Staff, Guid ZoneId, List<Table> Tables);

        private static async Task<Arranged> ArrangeAsync()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("12", 4), ("13", 4), ("14", 4));
            return new Arranged(restaurant, restaurant.StaffClient(), zoneId, tables);
        }

        private static async Task SaveDraftAsync(Arranged a, HttpClient admin) =>
            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent
            {
                Tables = [.. a.Tables.Select(t => PlanApi.Table(a.ZoneId, t.Name, x: t.X, y: t.Y, capacity: t.Capacity, id: t.Id))],
            }));

        [TestMethod]
        public async Task Moving_a_table_writes_the_published_plan_and_undo_puts_it_back()
        {
            Arranged a = await ArrangeAsync();

            Guid undo = await CombinationApi.LaidOutAsync(a.Staff, new LayoutRequest { Moves = [CombinationApi.Move(a.Tables[0], 3, 4)] });

            Table moved = await CombinationApi.TableAsync(a.Tables[0].Id);
            Assert.AreEqual(3, moved.X);
            Assert.AreEqual(4, moved.Y);

            Assert.AreEqual(HttpStatusCode.NoContent, (await CombinationApi.UndoAsync(a.Staff, undo)).StatusCode);
            Assert.AreEqual(a.Tables[0].X, (await CombinationApi.TableAsync(a.Tables[0].Id)).X);
        }

        [TestMethod]
        public async Task A_table_stays_in_its_room_and_in_its_restaurant()
        {
            Arranged a = await ArrangeAsync();
            Arranged other = await ArrangeAsync();

            await ApiAssert.ErrorAsync(await CombinationApi.LayoutAsync(a.Staff, new LayoutRequest { Moves = [CombinationApi.Move(a.Tables[0], 7.5, 1)] }),
                HttpStatusCode.Forbidden, "InvalidModification");
            await ApiAssert.ErrorAsync(await CombinationApi.LayoutAsync(a.Staff, new LayoutRequest { Moves = [CombinationApi.Move(other.Tables[0], 2, 2)] }),
                HttpStatusCode.NotFound, "NotFound");
            await ApiAssert.ErrorAsync(await CombinationApi.LayoutAsync(a.Staff, new LayoutRequest()),
                HttpStatusCode.BadRequest, "InvalidRequest");
        }

        [TestMethod]
        public async Task Gluing_an_existing_combination_separates_the_one_sharing_a_table()
        {
            Arranged a = await ArrangeAsync();
            Guid pair = await ReservationApi.AddCombinationAsync(a.ZoneId, "12-13", 8, a.Tables[0].Id, a.Tables[1].Id);
            Guid other = await ReservationApi.AddCombinationAsync(a.ZoneId, "13-14", 8, a.Tables[1].Id, a.Tables[2].Id);
            await PlacementApi.ActivateAsync(other);

            await CombinationApi.LaidOutAsync(a.Staff, new LayoutRequest
            {
                Moves = [CombinationApi.Move(a.Tables[0], a.Tables[1].X - 0.8, a.Tables[1].Y)],
                Glue = new GlueRequest { CombinationId = pair },
            });

            Assert.IsTrue((await CombinationApi.StoredAsync(pair)).IsActive);
            Assert.IsFalse((await CombinationApi.StoredAsync(other)).IsActive);
        }

        [TestMethod]
        public async Task Gluing_new_tables_creates_an_active_combination()
        {
            Arranged a = await ArrangeAsync();

            Guid undo = await CombinationApi.LaidOutAsync(a.Staff, new LayoutRequest
            {
                Moves = [CombinationApi.Move(a.Tables[0], a.Tables[1].X - 0.8, a.Tables[1].Y)],
                Glue = new GlueRequest { TableIds = [a.Tables[0].Id, a.Tables[1].Id], Name = "12-13", Capacity = 8 },
            });

            Combination created = await TestApi.WithDbAsync(db => db.Combinations.AsNoTracking().SingleAsync(c => c.ZoneId == a.ZoneId && c.Name == "12-13"));
            Assert.IsTrue(created.IsActive);

            await CombinationApi.UndoAsync(a.Staff, undo);
            Assert.AreEqual(0, await TestApi.WithDbAsync(db => db.Combinations.CountAsync(c => c.ZoneId == a.ZoneId)));
        }

        [TestMethod]
        public async Task Separating_reactivates_the_tables_left_glued()
        {
            Arranged a = await ArrangeAsync();
            Guid chain = await ReservationApi.AddCombinationAsync(a.ZoneId, "12-13-14", 12, a.Tables[0].Id, a.Tables[1].Id, a.Tables[2].Id);
            Guid pair = await ReservationApi.AddCombinationAsync(a.ZoneId, "12-13", 8, a.Tables[0].Id, a.Tables[1].Id);
            await PlacementApi.ActivateAsync(chain);

            await CombinationApi.LaidOutAsync(a.Staff, new LayoutRequest
            {
                Moves = [CombinationApi.Move(a.Tables[2], 6, 4)],
                Separate = new SeparateRequest { CombinationId = chain, ReactivateId = pair },
            });

            Assert.IsFalse((await CombinationApi.StoredAsync(chain)).IsActive);
            Assert.IsTrue((await CombinationApi.StoredAsync(pair)).IsActive);
        }

        [TestMethod]
        public async Task The_open_draft_follows_the_service()
        {
            Arranged a = await ArrangeAsync();
            using HttpClient admin = a.Restaurant.AdminClient();
            await SaveDraftAsync(a, admin);

            await CombinationApi.LaidOutAsync(a.Staff, new LayoutRequest
            {
                Moves = [CombinationApi.Move(a.Tables[0], a.Tables[1].X - 0.8, a.Tables[1].Y)],
                Glue = new GlueRequest { TableIds = [a.Tables[0].Id, a.Tables[1].Id], Name = "12-13", Capacity = 8 },
            });

            FloorPlanDraftResponse draft = await ApiAssert.OkAsync<FloorPlanDraftResponse>(await admin.GetAsync("api/restaurant/floor-plan/draft"));
            Assert.AreEqual(a.Tables[1].X - 0.8, draft.Tables.Single(t => t.Id == a.Tables[0].Id).X, 1e-6);
            Assert.IsTrue(draft.Combinations.Single().IsActive);

            // Publier ce brouillon ne défait pas le service
            await ApiAssert.OkAsync<List<ZoneResponse>>(await PlanApi.PublishAsync(admin));
            Assert.AreEqual(a.Tables[1].X - 0.8, (await CombinationApi.TableAsync(a.Tables[0].Id)).X, 1e-6);
        }

        [TestMethod]
        public async Task Gluing_plans_the_separation_for_a_member_booked_alone()
        {
            Arranged a = await ArrangeAsync();
            Reservation moreau = await a.Restaurant.AddReservationAsync(Dates.Today.AddDays(1), 20, covers: 4, clientName: "Moreau");
            await ReservationApi.AssignAsync(moreau.Id, tableId: a.Tables[0].Id);

            await CombinationApi.LaidOutAsync(a.Staff, new LayoutRequest
            {
                Glue = new GlueRequest { TableIds = [a.Tables[0].Id, a.Tables[1].Id], Name = "12-13", Capacity = 8 },
            });

            Combination created = await TestApi.WithDbAsync(db => db.Combinations.AsNoTracking().SingleAsync(c => c.ZoneId == a.ZoneId && c.Name == "12-13"));
            Assert.IsNotNull(created.DeactivateAt);
        }

        [TestMethod]
        public async Task Undo_is_refused_once_the_table_moved_again()
        {
            Arranged a = await ArrangeAsync();
            Guid first = await CombinationApi.LaidOutAsync(a.Staff, new LayoutRequest { Moves = [CombinationApi.Move(a.Tables[0], 3, 4)] });
            await CombinationApi.LaidOutAsync(a.Staff, new LayoutRequest { Moves = [CombinationApi.Move(a.Tables[0], 5, 4)] });

            await ApiAssert.ErrorAsync(await CombinationApi.UndoAsync(a.Staff, first), HttpStatusCode.Conflict, "UndoExpired");
        }

        [TestMethod]
        public async Task Undo_is_refused_when_it_would_glue_a_table_twice()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("12", 4), ("13", 4), ("14", 4), ("15", 4));
            Guid first = await ReservationApi.AddCombinationAsync(zoneId, "12-13", 8, tables[0].Id, tables[1].Id);
            Guid asleep = await ReservationApi.AddCombinationAsync(zoneId, "13-14", 8, tables[1].Id, tables[2].Id);
            Guid then = await ReservationApi.AddCombinationAsync(zoneId, "14-15", 8, tables[2].Id, tables[3].Id);
            await PlacementApi.ActivateAsync(asleep);

            Guid undo = await CombinationApi.LaidOutAsync(staff, new LayoutRequest { Glue = new GlueRequest { CombinationId = first } });
            Assert.IsFalse((await CombinationApi.StoredAsync(asleep)).IsActive);
            await CombinationApi.LaidOutAsync(staff, new LayoutRequest { Glue = new GlueRequest { CombinationId = then } });

            // 13-14 recollée reprendrait la 14 que tient 14-15 (COMB-04)
            await ApiAssert.ErrorAsync(await CombinationApi.UndoAsync(staff, undo), HttpStatusCode.Conflict, "UndoExpired");
            Assert.IsFalse((await CombinationApi.StoredAsync(asleep)).IsActive);
            Assert.IsTrue((await CombinationApi.StoredAsync(first)).IsActive);
            Assert.IsTrue((await CombinationApi.StoredAsync(then)).IsActive);
        }

        [TestMethod]
        public async Task Moving_notifies_the_floor_plan()
        {
            Arranged a = await ArrangeAsync();
            await using Screen screen = await Screen.ConnectAsync(a.Restaurant.AdminJwt());

            await CombinationApi.LaidOutAsync(a.Staff, new LayoutRequest { Moves = [CombinationApi.Move(a.Tables[0], 3, 4)] });

            Assert.AreEqual(DataScope.FloorPlan, await screen.NextAsync());
        }
    }
}
