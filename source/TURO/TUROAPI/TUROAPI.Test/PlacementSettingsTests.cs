namespace TUROAPI.Test
{
    /// <summary>Paramètres › Placement et Règles de réservation (§13.4) : des réglages bornés, sans effet sur l'existant</summary>
    [TestClass]
    public sealed class PlacementSettingsTests
    {
        private static PlacementSettingsRequest Placement(int rotation = 105, int tolerance = 3, int grace = 10, bool suggest = false, bool track = false) => new()
        {
            DefaultRotation = rotation,
            SeatTolerance = tolerance,
            LateGrace = grace,
            SuggestCombinations = suggest,
            TrackTableCleaning = track,
        };

        private static Task<HttpResponseMessage> PutPlacementAsync(HttpClient admin, PlacementSettingsRequest request) =>
            admin.PutAsJsonAsync("api/restaurant/settings/placement", request, TestJson.Options);

        private static Task<HttpResponseMessage> PutWindowAsync(HttpClient admin, int notice, int horizon) =>
            admin.PutAsJsonAsync("api/restaurant/settings/booking-window",
                new BookingWindowRequest { MinNoticeMinutes = notice, HorizonDays = horizon }, TestJson.Options);

        private static Task<Restaurant> StoredAsync(Guid id) =>
            TestApi.WithDbAsync(db => db.Restaurants.AsNoTracking().SingleAsync(r => r.Id == id));

        [TestMethod]
        public async Task Admin_saves_the_placement_settings()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ZoneResponse zone = await PlanApi.AddZoneAsync(admin);

            RestaurantReponses saved = await ApiAssert.OkAsync<RestaurantReponses>(await PutPlacementAsync(admin, Placement()));

            Assert.AreEqual(105, saved.DefaultRotation);
            Assert.AreEqual(3, saved.SeatTolerance);
            Assert.AreEqual(10, saved.LateGrace);
            Assert.IsFalse(saved.SuggestCombinations);
            // La réponse est celle de GET /api/restaurant, salles comprises
            Assert.AreEqual(zone.Id, saved.Zones.Single().Id);
            Restaurant stored = await StoredAsync(restaurant.Id);
            Assert.AreEqual(105, stored.DefaultRotation);
            Assert.IsFalse(stored.SuggestCombinations);
        }

        [TestMethod]
        public async Task Table_cleaning_is_not_tracked_until_turned_on()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            Assert.IsFalse((await StoredAsync(restaurant.Id)).TrackTableCleaning);

            RestaurantReponses saved = await ApiAssert.OkAsync<RestaurantReponses>(await PutPlacementAsync(admin, Placement(track: true)));

            Assert.IsTrue(saved.TrackTableCleaning);
            Assert.IsTrue((await StoredAsync(restaurant.Id)).TrackTableCleaning);
        }

        [TestMethod]
        [DataRow(15, 2, 15, "default rotation")]
        [DataRow(375, 2, 15, "default rotation")]
        [DataRow(100, 2, 15, "multiple of 15")]
        [DataRow(120, 0, 15, "seat tolerance")]
        [DataRow(120, 21, 15, "seat tolerance")]
        [DataRow(120, 2, -1, "late grace")]
        [DataRow(120, 2, 121, "late grace")]
        public async Task Placement_setting_out_of_bounds_is_refused(int rotation, int tolerance, int grace, string message)
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();

            await ApiAssert.ErrorAsync(await PutPlacementAsync(admin, Placement(rotation, tolerance, grace)),
                HttpStatusCode.BadRequest, "InvalidRequest", message);

            Restaurant stored = await StoredAsync(restaurant.Id);
            Assert.AreEqual(120, stored.DefaultRotation);
            Assert.AreEqual(2, stored.SeatTolerance);
            Assert.AreEqual(15, stored.LateGrace);
        }

        [TestMethod]
        [DataRow(30, 2, 0)]
        [DataRow(360, 20, 120)]
        public async Task Placement_bounds_are_included(int rotation, int tolerance, int grace)
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();

            await ApiAssert.OkAsync<RestaurantReponses>(await PutPlacementAsync(admin, Placement(rotation, tolerance, grace)));
        }

        [TestMethod]
        public async Task Changing_the_default_rotation_leaves_reservations_and_services_untouched()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            AddOrUpdateServiceRequest lunch = Requests.Service(DayOfWeek.Monday, 12, 15);
            lunch.ExpectedDuration = 90;
            ServiceResponse service = await ApiAssert.OkAsync<ServiceResponse>(await admin.PostAsJsonAsync(
                "api/restaurant/settings/service", lunch, TestJson.Options));
            Reservation reservation = await restaurant.AddReservationAsync(Dates.Today.AddDays(3), 20);

            await ApiAssert.OkAsync<RestaurantReponses>(await PutPlacementAsync(admin, Placement(rotation: 150)));

            Assert.AreEqual(120, (await TestRestaurant.ReservationAsync(reservation.Id)).Duration);
            Assert.AreEqual(90, await TestApi.WithDbAsync(db =>
                db.Services.Where(s => s.Id == service.Id).Select(s => s.ExpectedDuration).SingleAsync()));
        }

        [TestMethod]
        public async Task Admin_saves_the_booking_window()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();

            RestaurantReponses saved = await ApiAssert.OkAsync<RestaurantReponses>(await PutWindowAsync(admin, 120, 90));

            Assert.AreEqual(120, saved.MinBookingNoticeMinutes);
            Assert.AreEqual(90, saved.BookingHorizonDays);
            Restaurant stored = await StoredAsync(restaurant.Id);
            Assert.AreEqual(120, stored.MinBookingNoticeMinutes);
            Assert.AreEqual(90, stored.BookingHorizonDays);
        }

        [TestMethod]
        [DataRow(-1, 60, "minimum notice")]
        [DataRow(2881, 60, "minimum notice")]
        [DataRow(60, 0, "booking horizon")]
        [DataRow(60, 366, "booking horizon")]
        public async Task Booking_window_out_of_bounds_is_refused(int notice, int horizon, string message)
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();

            await ApiAssert.ErrorAsync(await PutWindowAsync(admin, notice, horizon),
                HttpStatusCode.BadRequest, "InvalidRequest", message);

            Restaurant stored = await StoredAsync(restaurant.Id);
            Assert.AreEqual(60, stored.MinBookingNoticeMinutes);
            Assert.AreEqual(60, stored.BookingHorizonDays);
        }

        [TestMethod]
        [DataRow(0, 1)]
        [DataRow(2880, 365)]
        public async Task Booking_window_bounds_are_included(int notice, int horizon)
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();

            await ApiAssert.OkAsync<RestaurantReponses>(await PutWindowAsync(admin, notice, horizon));
        }

        private static async Task<List<PlacementPreviewItemResponse>> PreviewAsync(HttpClient admin, int covers, int tolerance) =>
            await ApiAssert.OkAsync<List<PlacementPreviewItemResponse>>(
                await admin.GetAsync($"api/restaurant/settings/placement/preview?covers={covers}&tolerance={tolerance}"));

        /// <summary>
        /// T1 (2), T4 (4), T6 (6), T7 (7), T10 (10), T9 (9, désactivée), T12 + T13 (4 + 4) collées en « 12-13 » (8, active),
        /// T4 + T6 mémorisées en « 4-6 » (10, en sommeil)
        /// </summary>
        private static async Task<HttpClient> ArrangeRoomAsync(TestRestaurant restaurant)
        {
            HttpClient admin = restaurant.AdminClient();
            ZoneResponse salle = await PlanApi.AddZoneAsync(admin, "Salle", 20, 10);
            DraftTableItem t1 = PlanApi.Table(salle.Id, "T1", x: 1, capacity: 2);
            DraftTableItem t4 = PlanApi.Table(salle.Id, "T4", x: 3, capacity: 4);
            DraftTableItem t6 = PlanApi.Table(salle.Id, "T6", x: 3.8, capacity: 6);
            DraftTableItem t7 = PlanApi.Table(salle.Id, "T7", x: 6, capacity: 7);
            DraftTableItem t9 = PlanApi.Table(salle.Id, "T9", x: 8, capacity: 9);
            DraftTableItem t10 = PlanApi.Table(salle.Id, "T10", x: 10, capacity: 10);
            DraftTableItem t12 = PlanApi.Table(salle.Id, "T12", x: 12, capacity: 4);
            DraftTableItem t13 = PlanApi.Table(salle.Id, "T13", x: 12.8, capacity: 4);
            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent
            {
                Tables = [t1, t4, t6, t7, t9, t10, t12, t13],
                Combinations =
                [
                    PlanApi.Combination("12-13", 8, true, t12.Id, t13.Id),
                    PlanApi.Combination("4-6", 10, false, t4.Id, t6.Id),
                ],
            });
            await PlanApi.DeactivateTableAsync(t9.Id);
            return admin;
        }

        [TestMethod]
        public async Task Preview_rates_active_tables_and_active_combinations()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = await ArrangeRoomAsync(restaurant);

            List<PlacementPreviewItemResponse> preview = await PreviewAsync(admin, 4, 2);

            CollectionAssert.AreEqual(
                new[] { "T1", "T12", "T13", "T4", "T6", "T7", "12-13", "T10" },
                preview.Select(p => p.Name).ToArray());
            CollectionAssert.AreEqual(
                new[] { PlacementFit.TooSmall, PlacementFit.Perfect, PlacementFit.Perfect, PlacementFit.Perfect,
                    PlacementFit.WithinTolerance, PlacementFit.NotAdvised, PlacementFit.NotAdvised, PlacementFit.NotAdvised },
                preview.Select(p => p.Fit).ToArray());
            Assert.AreEqual(PlacementEntityKind.Combination, preview.Single(p => p.Name == "12-13").Kind);
            Assert.AreEqual(8, preview.Single(p => p.Name == "12-13").Capacity);
            Assert.IsTrue(preview.Where(p => p.Name != "12-13").All(p => p.Kind == PlacementEntityKind.Table));
        }

        [TestMethod]
        public async Task Preview_applies_the_tolerance_it_is_given_not_the_saved_one()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = await ArrangeRoomAsync(restaurant);

            List<PlacementPreviewItemResponse> preview = await PreviewAsync(admin, 4, 6);

            Assert.AreEqual(PlacementFit.WithinTolerance, preview.Single(p => p.Name == "T7").Fit);
            Assert.AreEqual(PlacementFit.WithinTolerance, preview.Single(p => p.Name == "T10").Fit);
            Assert.AreEqual(2, (await StoredAsync(restaurant.Id)).SeatTolerance);
        }

        [TestMethod]
        public async Task Preview_never_shows_another_restaurant()
        {
            TestRestaurant other = await TestRestaurant.CreateAsync();
            using HttpClient otherAdmin = await ArrangeRoomAsync(other);
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();

            Assert.AreEqual(0, (await PreviewAsync(admin, 4, 2)).Count);
        }

        [TestMethod]
        [DataRow("covers=0&tolerance=2", "covers")]
        [DataRow("covers=51&tolerance=2", "covers")]
        [DataRow("covers=4&tolerance=0", "seat tolerance")]
        [DataRow("covers=4&tolerance=21", "seat tolerance")]
        [DataRow("", "covers")]
        public async Task Preview_out_of_bounds_is_refused(string query, string message)
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();

            await ApiAssert.ErrorAsync(await admin.GetAsync($"api/restaurant/settings/placement/preview?{query}"),
                HttpStatusCode.BadRequest, "InvalidRequest", message);
        }

        [TestMethod]
        public async Task Saving_settings_notifies_the_restaurant_screens()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            await using Screen screen = await Screen.ConnectAsync(restaurant.StaffJwt());

            await ApiAssert.OkAsync<RestaurantReponses>(await PutPlacementAsync(admin, Placement()));
            Assert.AreEqual(DataScope.Restaurant, await screen.NextAsync());

            await ApiAssert.OkAsync<RestaurantReponses>(await PutWindowAsync(admin, 30, 30));
            Assert.AreEqual(DataScope.Restaurant, await screen.NextAsync());
        }
    }
}
