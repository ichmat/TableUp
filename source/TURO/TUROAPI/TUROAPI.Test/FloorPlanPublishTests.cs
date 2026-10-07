namespace TUROAPI.Test
{
    /// <summary>
    /// Les tables passent par un brouillon (EDIT-15 à EDIT-17). Publier applique tout ou rien ; une table publiée ne quitte jamais le plan (MOD-01)
    /// </summary>
    [TestClass]
    public sealed class FloorPlanPublishTests
    {
        private static async Task<(TestRestaurant Restaurant, HttpClient Admin, ZoneResponse Zone)> ArrangeAsync()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            HttpClient admin = restaurant.AdminClient();
            ZoneResponse zone = await PlanApi.AddZoneAsync(admin, "Salle", 8, 6);
            return (restaurant, admin, zone);
        }

        [TestMethod]
        public async Task Draft_is_saved_read_back_and_discarded_without_touching_the_plan()
        {
            (_, HttpClient admin, ZoneResponse zone) = await ArrangeAsync();
            Assert.AreEqual(HttpStatusCode.NoContent, (await admin.GetAsync("api/restaurant/floor-plan/draft")).StatusCode);
            DraftTableItem t1 = PlanApi.Table(zone.Id, "T1");

            FloorPlanDraftResponse saved = await ApiAssert.OkAsync<FloorPlanDraftResponse>(
                await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent { Tables = [t1], Decors = [PlanApi.Decor(zone.Id)] }));
            Assert.IsTrue(saved.UpdatedAt > DateTime.UtcNow.AddMinutes(-1));

            FloorPlanDraftResponse read = await ApiAssert.OkAsync<FloorPlanDraftResponse>(await admin.GetAsync("api/restaurant/floor-plan/draft"));
            Assert.AreEqual(t1.Id, read.Tables.Single().Id);
            Assert.AreEqual(1, read.Decors.Count);
            Assert.AreEqual(0, read.Combinations.Count);
            Assert.AreEqual(0, (await PlanApi.GetPlanAsync(admin)).Single().Tables.Count);

            Assert.AreEqual(HttpStatusCode.NoContent, (await admin.DeleteAsync("api/restaurant/floor-plan/draft")).StatusCode);
            Assert.AreEqual(HttpStatusCode.NoContent, (await admin.GetAsync("api/restaurant/floor-plan/draft")).StatusCode);
        }

        [TestMethod]
        public async Task Publish_applies_the_draft_and_removes_it()
        {
            (_, HttpClient admin, ZoneResponse zone) = await ArrangeAsync();
            DraftTableItem t1 = PlanApi.Table(zone.Id, "  T1 ", x: 1.13, y: 2.07, capacity: 2, shape: TableShape.Round, width: 0.7, height: 0.7);
            DraftTableItem t2 = PlanApi.Table(zone.Id, "T2", x: 3, shape: TableShape.Rectangular, width: 1.6, height: 0.8, rotation: 90);
            DraftDecorItem bar = PlanApi.Decor(zone.Id, DecorType.Bar, x: 0, y: 5, width: 3, height: 0.6, label: "   ");

            List<ZoneResponse> plan = await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t1, t2], Decors = [bar] });

            TableResponse published = plan.Single().Tables.Single(t => t.Id == t1.Id);
            Assert.AreEqual("T1", published.Name);
            // Pas de grille imposée : l'éditeur colle aussi un objet au bord de son voisin
            Assert.AreEqual(1.13, published.X, 1e-9);
            Assert.IsTrue(published.IsActive);
            Assert.AreEqual(90, plan.Single().Tables.Single(t => t.Id == t2.Id).Rotation);
            Assert.IsNull(plan.Single().Decors.Single().Label);
            Assert.AreEqual(HttpStatusCode.NoContent, (await admin.GetAsync("api/restaurant/floor-plan/draft")).StatusCode);
        }

        [TestMethod]
        public async Task Publishing_without_a_draft_is_not_found()
        {
            (_, HttpClient admin, _) = await ArrangeAsync();

            await ApiAssert.ErrorAsync(await PlanApi.PublishAsync(admin), HttpStatusCode.NotFound, "NotFound", "no floor plan draft to publish.");
        }

        [TestMethod]
        public async Task Published_table_cannot_leave_the_plan()
        {
            (_, HttpClient admin, ZoneResponse zone) = await ArrangeAsync();
            DraftTableItem t1 = PlanApi.Table(zone.Id, "T1", x: 1);
            DraftTableItem t2 = PlanApi.Table(zone.Id, "T2", x: 3);
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t1, t2] });

            await ApiAssert.ErrorAsync(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent { Tables = [t1] }),
                HttpStatusCode.Forbidden, "InvalidModification", "table T2: a published table cannot be removed from the plan.");
        }

        [TestMethod]
        public async Task Draft_listing_an_item_twice_is_refused()
        {
            (_, HttpClient admin, ZoneResponse zone) = await ArrangeAsync();
            DraftTableItem t1 = PlanApi.Table(zone.Id, "T1");
            DraftDecorItem pillar = PlanApi.Decor(zone.Id);

            await ApiAssert.ErrorAsync(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent { Tables = [t1, t1] }),
                HttpStatusCode.Forbidden, "InvalidModification", "the draft lists the same table twice.");
            await ApiAssert.ErrorAsync(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent { Decors = [pillar, pillar] }),
                HttpStatusCode.Forbidden, "InvalidModification", "the draft lists the same decor twice.");
        }

        [TestMethod]
        public async Task Deactivated_table_is_frozen_but_stays_on_the_plan()
        {
            (_, HttpClient admin, ZoneResponse zone) = await ArrangeAsync();
            DraftTableItem t1 = PlanApi.Table(zone.Id, "T1", x: 1);
            DraftTableItem t2 = PlanApi.Table(zone.Id, "T2", x: 3);
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t1, t2] });
            await PlanApi.DeactivateTableAsync(t1.Id);

            await ApiAssert.ErrorAsync(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent { Tables = [t1, t2] }),
                HttpStatusCode.Forbidden, "InvalidModification", "table T1: a deactivated table cannot be edited.");
            // Une table désactivée n'a pas à figurer au brouillon
            List<ZoneResponse> plan = await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t2] });

            Assert.IsFalse(plan.Single().Tables.Single(t => t.Id == t1.Id).IsActive);
        }

        [TestMethod]
        public async Task Half_done_draft_is_saved_but_not_published()
        {
            (_, HttpClient admin, ZoneResponse zone) = await ArrangeAsync();

            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin,
                new FloorPlanDraftContent { Tables = [PlanApi.Table(zone.Id, "", capacity: 0)] }));

            await ApiAssert.ErrorAsync(await PlanApi.PublishAsync(admin),
                HttpStatusCode.Forbidden, "InvalidModification", "table sans nom: a table needs a name.");
            Assert.AreEqual(HttpStatusCode.OK, (await admin.GetAsync("api/restaurant/floor-plan/draft")).StatusCode);
            Assert.AreEqual(0, (await PlanApi.GetPlanAsync(admin)).Single().Tables.Count);
        }

        [TestMethod]
        public async Task Publish_refuses_an_invalid_table()
        {
            (_, HttpClient admin, ZoneResponse zone) = await ArrangeAsync();
            // Les messages formatent les décimaux selon la culture du serveur : on n'en vérifie que la partie fixe
            (DraftTableItem Table, string Message)[] cases =
            [
                (PlanApi.Table(zone.Id, new string('T', 21)), "name cannot exceed 20 characters."),
                (PlanApi.Table(zone.Id, "T1", shape: (TableShape)9), "table T1: unknown shape."),
                (PlanApi.Table(zone.Id, "T1", capacity: 0), "table T1: seats must be between 1 and 50."),
                (PlanApi.Table(zone.Id, "T1", capacity: 51), "table T1: seats must be between 1 and 50."),
                (PlanApi.Table(zone.Id, "T1", width: 0.29), "table T1: width and depth must be between"),
                (PlanApi.Table(zone.Id, "T1", height: 4.01), "table T1: width and depth must be between"),
                (PlanApi.Table(zone.Id, "T1", shape: TableShape.Round, width: 0.8, height: 1), "table T1: a round table must be as wide as it is deep."),
                (PlanApi.Table(zone.Id, "T1", rotation: 10), "table T1: rotation must be a multiple of 15 degrees"),
                (PlanApi.Table(zone.Id, "T1", rotation: 360), "table T1: rotation must be a multiple of 15 degrees"),
                (PlanApi.Table(zone.Id, "T1", x: 7.5), "table T1: the table goes beyond room Salle."),
                (PlanApi.Table(zone.Id, "T1", x: -0.01), "table T1: the table goes beyond room Salle."),
                // Tient à plat, déborde une fois tournée : on juge la boîte englobante
                (PlanApi.Table(zone.Id, "T1", shape: TableShape.Rectangular, x: 0, y: 0.1, width: 2, height: 0.4, rotation: 90),
                    "table T1: the table goes beyond room Salle."),
            ];

            foreach ((DraftTableItem table, string message) in cases)
            {
                await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent { Tables = [table] }));
                await ApiAssert.ErrorAsync(await PlanApi.PublishAsync(admin), HttpStatusCode.Forbidden, "InvalidModification", message);
            }
            Assert.AreEqual(0, (await PlanApi.GetPlanAsync(admin)).Single().Tables.Count);
        }

        [TestMethod]
        public async Task Turned_table_that_fits_is_published()
        {
            (_, HttpClient admin, ZoneResponse zone) = await ArrangeAsync();

            List<ZoneResponse> plan = await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent
            {
                Tables = [PlanApi.Table(zone.Id, "T1", shape: TableShape.Rectangular, x: 0, y: 0.9, width: 2, height: 0.4, rotation: 90)],
            });

            Assert.AreEqual(1, plan.Single().Tables.Count);
        }

        [TestMethod]
        public async Task Names_are_unique_across_the_plan_ignoring_case_and_spaces()
        {
            (_, HttpClient admin, ZoneResponse zone) = await ArrangeAsync();
            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent
            {
                Tables = [PlanApi.Table(zone.Id, "T1", x: 1), PlanApi.Table(zone.Id, " t1 ", x: 3)],
            }));

            await ApiAssert.ErrorAsync(await PlanApi.PublishAsync(admin),
                HttpStatusCode.Forbidden, "InvalidModification", "another table or combination already has this name.");
        }

        [TestMethod]
        public async Task Publish_refuses_an_invalid_decor()
        {
            (_, HttpClient admin, ZoneResponse zone) = await ArrangeAsync();
            (DraftDecorItem Decor, string Message)[] cases =
            [
                (PlanApi.Decor(zone.Id, type: (DecorType)42), "unknown decor type."),
                (PlanApi.Decor(zone.Id, label: new string('L', 31)), "label cannot exceed 30 characters."),
                (PlanApi.Decor(zone.Id, width: 0.05), "size must be between"),
                (PlanApi.Decor(zone.Id, x: 0, width: 8.5), "size must be between"),
                (PlanApi.Decor(zone.Id, rotation: 7), "rotation must be a multiple of 15 degrees"),
                (PlanApi.Decor(zone.Id, x: 7.8), "the decor goes beyond room Salle."),
            ];

            foreach ((DraftDecorItem decor, string message) in cases)
            {
                await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent { Decors = [decor] }));
                await ApiAssert.ErrorAsync(await PlanApi.PublishAsync(admin), HttpStatusCode.Forbidden, "InvalidModification", message);
            }
            Assert.AreEqual(0, (await PlanApi.GetPlanAsync(admin)).Single().Decors.Count);
        }

        [TestMethod]
        public async Task Publish_is_all_or_nothing()
        {
            (_, HttpClient admin, ZoneResponse zone) = await ArrangeAsync();
            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent
            {
                Tables = [PlanApi.Table(zone.Id, "T1", x: 1), PlanApi.Table(zone.Id, "T2", x: 3, capacity: 0)],
                Decors = [PlanApi.Decor(zone.Id)],
            }));

            await ApiAssert.ErrorAsync(await PlanApi.PublishAsync(admin), HttpStatusCode.Forbidden, "InvalidModification", "table T2");

            ZoneResponse unchanged = (await PlanApi.GetPlanAsync(admin)).Single();
            Assert.AreEqual(0, unchanged.Tables.Count);
            Assert.AreEqual(0, unchanged.Decors.Count);
        }

        [TestMethod]
        public async Task Published_table_keeps_its_id_when_moved_renamed_and_resized()
        {
            (TestRestaurant restaurant, HttpClient admin, ZoneResponse salle) = await ArrangeAsync();
            ZoneResponse terrasse = await PlanApi.AddZoneAsync(admin, "Terrasse", 6, 4);
            DraftTableItem t1 = PlanApi.Table(salle.Id, "T1");
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t1] });

            t1.ZoneId = terrasse.Id;
            t1.Name = "T9";
            t1.Width = 1.2;
            List<ZoneResponse> plan = await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t1] });

            Assert.AreEqual(0, plan.Single(z => z.Id == salle.Id).Tables.Count);
            TableResponse moved = plan.Single(z => z.Id == terrasse.Id).Tables.Single();
            Assert.AreEqual(t1.Id, moved.Id);
            Assert.AreEqual("T9", moved.Name);
            Assert.AreEqual(1.2, moved.Width, 1e-9);
            int rows = await TestApi.WithDbAsync(db => db.Tables.CountAsync(t => t.Zone.RestaurantId == restaurant.Id));
            Assert.AreEqual(1, rows);
        }

        [TestMethod]
        public async Task Decor_left_out_of_the_draft_is_deleted()
        {
            (_, HttpClient admin, ZoneResponse zone) = await ArrangeAsync();
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Decors = [PlanApi.Decor(zone.Id)] });

            List<ZoneResponse> plan = await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent());

            Assert.AreEqual(0, plan.Single().Decors.Count);
            int rows = await TestApi.WithDbAsync(db => db.Decors.CountAsync(d => d.ZoneId == zone.Id));
            Assert.AreEqual(0, rows);
        }

        [TestMethod]
        public async Task Draft_drops_the_decor_of_an_unknown_room_but_refuses_a_table_there()
        {
            (_, HttpClient admin, _) = await ArrangeAsync();
            Guid deletedRoom = Guid.NewGuid();

            FloorPlanDraftResponse saved = await ApiAssert.OkAsync<FloorPlanDraftResponse>(
                await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent { Decors = [PlanApi.Decor(deletedRoom)] }));
            Assert.AreEqual(0, saved.Decors.Count);

            await ApiAssert.ErrorAsync(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent { Tables = [PlanApi.Table(deletedRoom, "T1")] }),
                HttpStatusCode.Forbidden, "InvalidModification", "table T1: unknown room.");
        }
    }
}
