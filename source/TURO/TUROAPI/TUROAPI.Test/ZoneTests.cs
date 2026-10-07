namespace TUROAPI.Test
{
    /// <summary>Les salles changent tout de suite (§13.1) ; une salle qui a porté une table reste (MOD-01)</summary>
    [TestClass]
    public sealed class ZoneTests
    {
        private static Task<HttpResponseMessage> DeleteAsync(HttpClient admin, Guid id) =>
            admin.DeleteAsync($"api/restaurant/floor-plan/zones/{id}");

        [TestMethod]
        public async Task New_rooms_are_appended_with_a_trimmed_name()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();

            ZoneResponse first = await PlanApi.AddZoneAsync(admin, "  Salle  ");
            ZoneResponse second = await PlanApi.AddZoneAsync(admin, "Terrasse");

            Assert.AreEqual("Salle", first.Name);
            Assert.AreEqual(0, first.Order);
            Assert.AreEqual(1, second.Order);
        }

        [TestMethod]
        public async Task Room_fields_are_validated()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            (string Name, double Width, double Height, string Message)[] cases =
            [
                ("", 8, 6, "a room needs a name."),
                ("   ", 8, 6, "a room needs a name."),
                (new string('S', 41), 8, 6, "name cannot exceed 40 characters."),
                ("Salle", 1.9, 6, "width and depth must be between 2 and 100 m."),
                ("Salle", 8, 100.5, "width and depth must be between 2 and 100 m."),
            ];

            foreach ((string name, double width, double height, string message) in cases)
            {
                await ApiAssert.ErrorAsync(await PlanApi.PostZoneAsync(admin, name, width, height),
                    HttpStatusCode.Forbidden, "InvalidModification", message);
            }
            await PlanApi.AddZoneAsync(admin, "Salle", 2, 100);
            await ApiAssert.ErrorAsync(await PlanApi.PostZoneAsync(admin, "SALLE", 8, 6),
                HttpStatusCode.Forbidden, "InvalidModification", "room SALLE: another room already has this name.");
        }

        [TestMethod]
        public async Task Room_is_renamed_and_resized()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ZoneResponse zone = await PlanApi.AddZoneAsync(admin, "Salle", 8, 6);

            // Garder son propre nom n'est pas un doublon
            ZoneResponse resized = await ApiAssert.OkAsync<ZoneResponse>(await PlanApi.UpdateZoneAsync(admin, zone.Id, "Salle", 10, 7));
            ZoneResponse renamed = await ApiAssert.OkAsync<ZoneResponse>(await PlanApi.UpdateZoneAsync(admin, zone.Id, "Grande salle", 10, 7));

            Assert.AreEqual(10, resized.Width);
            Assert.AreEqual("Grande salle", renamed.Name);
        }

        [TestMethod]
        public async Task Shrinking_is_refused_while_a_published_table_would_be_left_outside()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ZoneResponse zone = await PlanApi.AddZoneAsync(admin, "Salle", 8, 6);
            // Bord droit à 7,3 m
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [PlanApi.Table(zone.Id, "T1", x: 6.5)] });

            await ApiAssert.ErrorAsync(await PlanApi.UpdateZoneAsync(admin, zone.Id, "Salle", 7, 6),
                HttpStatusCode.Forbidden, "InvalidModification", "these items would end up outside the room: table T1.");
            await ApiAssert.OkAsync<ZoneResponse>(await PlanApi.UpdateZoneAsync(admin, zone.Id, "Salle", 7.5, 6));
        }

        [TestMethod]
        public async Task Shrinking_also_protects_the_draft()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ZoneResponse zone = await PlanApi.AddZoneAsync(admin, "Salle", 8, 6);
            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin, new FloorPlanDraftContent
            {
                Tables = [PlanApi.Table(zone.Id, "T1", x: 6.5)],
                Decors = [PlanApi.Decor(zone.Id, DecorType.Bar, x: 6, width: 1.5, height: 0.5)],
            }));

            ApiErrorBody error = await ApiAssert.ErrorAsync(await PlanApi.UpdateZoneAsync(admin, zone.Id, "Salle", 7, 6),
                HttpStatusCode.Forbidden, "InvalidModification", "table T1 (draft)");
            Assert.IsTrue(error.Message.Contains("decor Bar (draft)"), error.Message);
        }

        [TestMethod]
        public async Task Shrinking_ignores_deactivated_tables()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ZoneResponse zone = await PlanApi.AddZoneAsync(admin, "Salle", 8, 6);
            DraftTableItem outside = PlanApi.Table(zone.Id, "T1", x: 6.5);
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [outside, PlanApi.Table(zone.Id, "T2", x: 1)] });
            await PlanApi.DeactivateTableAsync(outside.Id);

            await ApiAssert.OkAsync<ZoneResponse>(await PlanApi.UpdateZoneAsync(admin, zone.Id, "Salle", 7, 6));
        }

        [TestMethod]
        public async Task Rooms_are_reordered_only_as_a_whole()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ZoneResponse a = await PlanApi.AddZoneAsync(admin, "A");
            ZoneResponse b = await PlanApi.AddZoneAsync(admin, "B");
            ZoneResponse c = await PlanApi.AddZoneAsync(admin, "C");

            List<ZoneResponse> plan = await ApiAssert.OkAsync<List<ZoneResponse>>(await admin.PutAsJsonAsync(
                "api/restaurant/floor-plan/zones/order", new ZoneOrderRequest { ZoneIds = [c.Id, a.Id, b.Id] }, TestJson.Options));

            CollectionAssert.AreEqual(new[] { c.Id, a.Id, b.Id }, plan.Select(z => z.Id).ToArray());
            CollectionAssert.AreEqual(new[] { 0, 1, 2 }, plan.Select(z => z.Order).ToArray());
            foreach (List<Guid> partial in new List<Guid>[] { [c.Id, a.Id], [c.Id, a.Id, a.Id] })
            {
                await ApiAssert.ErrorAsync(await admin.PutAsJsonAsync("api/restaurant/floor-plan/zones/order",
                    new ZoneOrderRequest { ZoneIds = partial }, TestJson.Options),
                    HttpStatusCode.Forbidden, "InvalidModification", "the new order must list every room exactly once.");
            }
        }

        [TestMethod]
        public async Task Empty_room_is_deleted()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ZoneResponse zone = await PlanApi.AddZoneAsync(admin);

            await ApiAssert.OkAsync<ZoneResponse>(await DeleteAsync(admin, zone.Id));

            Assert.AreEqual(0, (await PlanApi.GetPlanAsync(admin)).Count);
        }

        [TestMethod]
        public async Task Room_that_holds_a_table_cannot_be_deleted_even_deactivated_or_in_the_draft()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ZoneResponse published = await PlanApi.AddZoneAsync(admin, "Salle");
            ZoneResponse draftOnly = await PlanApi.AddZoneAsync(admin, "Terrasse");
            DraftTableItem t1 = PlanApi.Table(published.Id, "T1");
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [t1] });
            await PlanApi.DeactivateTableAsync(t1.Id);

            await ApiAssert.ErrorAsync(await DeleteAsync(admin, published.Id),
                HttpStatusCode.Forbidden, "InvalidModification", "a room that has held a table cannot be deleted.");

            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin,
                new FloorPlanDraftContent { Tables = [PlanApi.Table(draftOnly.Id, "T2")] }));
            await ApiAssert.ErrorAsync(await DeleteAsync(admin, draftOnly.Id),
                HttpStatusCode.Forbidden, "InvalidModification", "a room that has held a table cannot be deleted.");
        }

        [TestMethod]
        public async Task Room_asked_for_by_a_reservation_cannot_be_deleted()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ZoneResponse zone = await PlanApi.AddZoneAsync(admin);
            // Même ancienne et annulée, la préférence doit rester lisible
            await restaurant.AddReservationAsync(Dates.Previous(DayOfWeek.Monday), 20,
                status: ReservationStatus.Cancelled, preferredZoneId: zone.Id);

            await ApiAssert.ErrorAsync(await DeleteAsync(admin, zone.Id),
                HttpStatusCode.Forbidden, "InvalidModification", "some reservations ask for this room, it cannot be deleted.");
        }

        [TestMethod]
        public async Task Deleting_a_room_takes_its_decor_along_published_and_draft()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ZoneResponse salle = await PlanApi.AddZoneAsync(admin, "Salle");
            ZoneResponse cour = await PlanApi.AddZoneAsync(admin, "Cour");
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Decors = [PlanApi.Decor(cour.Id)] });
            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin,
                new FloorPlanDraftContent { Decors = [PlanApi.Decor(cour.Id), PlanApi.Decor(salle.Id)] }));

            await ApiAssert.OkAsync<ZoneResponse>(await DeleteAsync(admin, cour.Id));

            FloorPlanDraftResponse draft = await ApiAssert.OkAsync<FloorPlanDraftResponse>(await admin.GetAsync("api/restaurant/floor-plan/draft"));
            Assert.AreEqual(salle.Id, draft.Decors.Single().ZoneId);
            int left = await TestApi.WithDbAsync(db => db.Decors.CountAsync(d => d.ZoneId == cour.Id));
            Assert.AreEqual(0, left);
        }

        [TestMethod]
        public async Task Unknown_room_is_not_found()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            Guid unknown = Guid.NewGuid();

            await ApiAssert.ErrorAsync(await PlanApi.UpdateZoneAsync(admin, unknown, "Salle", 8, 6),
                HttpStatusCode.NotFound, "NotFound", "Zone not found.");
            await ApiAssert.ErrorAsync(await DeleteAsync(admin, unknown), HttpStatusCode.NotFound, "NotFound", "Zone not found.");
        }
    }
}
