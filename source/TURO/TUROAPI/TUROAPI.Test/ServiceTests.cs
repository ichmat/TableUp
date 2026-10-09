namespace TUROAPI.Test
{
    /// <summary>Services de la semaine (§9.4) : pas de chevauchement, et aucune réservation laissée hors service</summary>
    [TestClass]
    public sealed class ServiceTests
    {
        private static Task<HttpResponseMessage> AddAsync(HttpClient admin, AddOrUpdateServiceRequest request) =>
            admin.PostAsJsonAsync("api/restaurant/settings/service", request, TestJson.Options);

        private static Task<HttpResponseMessage> UpdateAsync(HttpClient admin, Guid id, AddOrUpdateServiceRequest request) =>
            admin.PutAsJsonAsync($"api/restaurant/settings/service/{id}", request, TestJson.Options);

        private static Task<Service> StoredAsync(Guid id) =>
            TestApi.WithDbAsync(db => db.Services.AsNoTracking().SingleAsync(s => s.Id == id));

        [TestMethod]
        public async Task Admin_creates_a_service_with_its_slot_settings()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            AddOrUpdateServiceRequest request = Requests.Service(DayOfWeek.Monday, 19, 23, slotStep: 15);
            request.ExpectedDuration = 90;
            request.MaxCadence = 10;
            request.CoverCap = 40;

            ServiceResponse service = await ApiAssert.OkAsync<ServiceResponse>(await AddAsync(admin, request));

            Assert.AreEqual(DayOfWeek.Monday, service.Day);
            Assert.AreEqual(15, service.SlotStep);
            Assert.AreEqual(90, service.ExpectedDuration);
            Assert.AreEqual(40, service.CoverCap);
            RestaurantReponses info = await ApiAssert.OkAsync<RestaurantReponses>(await admin.GetAsync("api/restaurant"));
            Assert.AreEqual(service.Id, info.Services.Single().Id);
        }

        [TestMethod]
        public async Task Overlapping_service_on_the_same_day_is_refused()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            await ApiAssert.OkAsync<ServiceResponse>(await AddAsync(admin, Requests.Service(DayOfWeek.Monday, 12, 14)));

            foreach (AddOrUpdateServiceRequest overlapping in new[] { Requests.Service(DayOfWeek.Monday, 13, 15), Requests.Service(DayOfWeek.Monday, 11, 15) })
            {
                await ApiAssert.ErrorAsync(await AddAsync(admin, overlapping),
                    HttpStatusCode.Forbidden, "InvalidModification", "service time conflicts with existing service.");
            }
            // Bord à bord, ou un autre jour : accepté
            await ApiAssert.OkAsync<ServiceResponse>(await AddAsync(admin, Requests.Service(DayOfWeek.Monday, 14, 16)));
            await ApiAssert.OkAsync<ServiceResponse>(await AddAsync(admin, Requests.Service(DayOfWeek.Tuesday, 12, 14)));
        }

        [TestMethod]
        public async Task Overnight_service_overlap_is_detected()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            await ApiAssert.OkAsync<ServiceResponse>(await AddAsync(admin, Requests.Service(DayOfWeek.Friday, 19, 1)));

            await ApiAssert.ErrorAsync(await AddAsync(admin, Requests.Service(DayOfWeek.Friday, 20, 22)),
                HttpStatusCode.Forbidden, "InvalidModification", "service time conflicts with existing service.");
        }

        [TestMethod]
        public async Task A_service_past_midnight_overlaps_the_next_morning_and_the_week_wraps()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            await ApiAssert.OkAsync<ServiceResponse>(await AddAsync(admin, Requests.Service(DayOfWeek.Friday, 19, 2)));
            await ApiAssert.OkAsync<ServiceResponse>(await AddAsync(admin, Requests.Service(DayOfWeek.Sunday, 22, 3)));

            // Le vendredi soir dure jusqu'à samedi 02:00 ; le dimanche soir, jusqu'à lundi 03:00
            await ApiAssert.ErrorAsync(await AddAsync(admin, Requests.Service(DayOfWeek.Saturday, 1, 4)),
                HttpStatusCode.Forbidden, "InvalidModification", "service time conflicts with existing service.");
            await ApiAssert.ErrorAsync(await AddAsync(admin, Requests.Service(DayOfWeek.Monday, 2, 5)),
                HttpStatusCode.Forbidden, "InvalidModification", "service time conflicts with existing service.");
            // Bord à bord après minuit : accepté
            await ApiAssert.OkAsync<ServiceResponse>(await AddAsync(admin, Requests.Service(DayOfWeek.Saturday, 2, 4)));
        }

        [TestMethod]
        public async Task Slot_settings_are_validated()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            (Action<AddOrUpdateServiceRequest> Change, string Message)[] cases =
            [
                (s => s.SlotStep = 20, "slot step must be 15 or 30 minutes."),
                (s => s.OccupancyMode = (OccupancyMode)9, "unknown occupancy mode."),
                (s => s.ExpectedDuration = 0, "expected duration must be between 1 and 1440 minutes."),
                (s => s.ExpectedDuration = 1441, "expected duration must be between 1 and 1440 minutes."),
                (s => s.MaxCadence = 0, "kitchen warning thresholds must be positive."),
                (s => s.CoverCap = -1, "kitchen warning thresholds must be positive."),
            ];

            foreach ((Action<AddOrUpdateServiceRequest> change, string message) in cases)
            {
                AddOrUpdateServiceRequest request = Requests.Service(DayOfWeek.Monday, 19, 23);
                change(request);
                await ApiAssert.ErrorAsync(await AddAsync(admin, request), HttpStatusCode.Forbidden, "InvalidModification", message);
            }
            // Bornes acceptées
            AddOrUpdateServiceRequest edges = Requests.Service(DayOfWeek.Monday, 19, 23, slotStep: 15);
            edges.ExpectedDuration = 1440;
            edges.MaxCadence = 1;
            edges.CoverCap = 1;
            await ApiAssert.OkAsync<ServiceResponse>(await AddAsync(admin, edges));
        }

        [TestMethod]
        public async Task Narrowing_hours_that_would_strand_a_reservation_is_refused()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ServiceResponse service = await ApiAssert.OkAsync<ServiceResponse>(await AddAsync(admin, Requests.Service(DayOfWeek.Monday, 19, 23)));
            await restaurant.AddReservationAsync(Dates.Next(DayOfWeek.Monday), 22, covers: 3);

            await ApiAssert.ErrorAsync(await UpdateAsync(admin, service.Id, Requests.Service(DayOfWeek.Monday, 19, 22)),
                HttpStatusCode.Conflict, "ReservationsImpacted", "1 active reservation(s) (3 covers)");

            Assert.AreEqual(new TimeOnly(23, 0), (await StoredAsync(service.Id)).Closing);
        }

        [TestMethod]
        public async Task Narrowing_that_keeps_every_reservation_is_accepted()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ServiceResponse service = await ApiAssert.OkAsync<ServiceResponse>(await AddAsync(admin, Requests.Service(DayOfWeek.Monday, 19, 23)));
            await restaurant.AddReservationAsync(Dates.Next(DayOfWeek.Monday), 20);

            ServiceResponse narrowed = await ApiAssert.OkAsync<ServiceResponse>(
                await UpdateAsync(admin, service.Id, Requests.Service(DayOfWeek.Monday, 19, 22)));

            Assert.AreEqual(new TimeOnly(22, 0), narrowed.Closing);
        }

        [TestMethod]
        public async Task Deleting_a_service_with_a_coming_reservation_is_refused()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ServiceResponse service = await ApiAssert.OkAsync<ServiceResponse>(await AddAsync(admin, Requests.Service(DayOfWeek.Monday, 19, 23)));
            await restaurant.AddReservationAsync(Dates.Next(DayOfWeek.Monday), 20, covers: 2);

            await ApiAssert.ErrorAsync(await admin.DeleteAsync($"api/restaurant/settings/service/{service.Id}"),
                HttpStatusCode.Conflict, "ReservationsImpacted", "1 active reservation(s) (2 covers)");

            Assert.AreEqual(service.Id, (await StoredAsync(service.Id)).Id);
        }

        [TestMethod]
        public async Task Past_inactive_and_other_day_reservations_do_not_block_deletion()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ServiceResponse service = await ApiAssert.OkAsync<ServiceResponse>(await AddAsync(admin, Requests.Service(DayOfWeek.Monday, 19, 23)));
            DateOnly monday = Dates.Next(DayOfWeek.Monday);
            await restaurant.AddReservationAsync(Dates.Previous(DayOfWeek.Monday), 20);
            await restaurant.AddReservationAsync(monday, 20, status: ReservationStatus.Cancelled);
            await restaurant.AddReservationAsync(monday, 20, status: ReservationStatus.NoShow);
            await restaurant.AddReservationAsync(monday.AddDays(1), 20);

            await ApiAssert.OkAsync<ServiceResponse>(await admin.DeleteAsync($"api/restaurant/settings/service/{service.Id}"));
        }

        [TestMethod]
        public async Task Overnight_service_protects_its_after_midnight_reservations()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ServiceResponse service = await ApiAssert.OkAsync<ServiceResponse>(await AddAsync(admin, Requests.Service(DayOfWeek.Friday, 19, 1)));
            DateOnly friday = Dates.Next(DayOfWeek.Friday);
            // 00:30 le samedi matin, rattachée au service du vendredi (RES-02)
            await restaurant.AddReservationAsync(friday, 0, 30, startDay: friday.AddDays(1));

            await ApiAssert.ErrorAsync(await UpdateAsync(admin, service.Id, Requests.Service(DayOfWeek.Friday, 19, 0)),
                HttpStatusCode.Conflict, "ReservationsImpacted");
            AddOrUpdateServiceRequest later = Requests.Service(DayOfWeek.Friday, 18, 1);
            later.Closing = new TimeOnly(1, 30);
            await ApiAssert.OkAsync<ServiceResponse>(await UpdateAsync(admin, service.Id, later));
        }

        [TestMethod]
        public async Task Day_of_an_existing_service_does_not_change()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ServiceResponse service = await ApiAssert.OkAsync<ServiceResponse>(await AddAsync(admin, Requests.Service(DayOfWeek.Monday, 19, 23)));

            ServiceResponse updated = await ApiAssert.OkAsync<ServiceResponse>(
                await UpdateAsync(admin, service.Id, Requests.Service(DayOfWeek.Tuesday, 19, 23)));

            Assert.AreEqual(DayOfWeek.Monday, updated.Day);
        }

        [TestMethod]
        public async Task Unknown_service_is_not_found()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            Guid unknown = Guid.NewGuid();

            await ApiAssert.ErrorAsync(await UpdateAsync(admin, unknown, Requests.Service(DayOfWeek.Monday, 19, 23)),
                HttpStatusCode.NotFound, "NotFound", "Service not found.");
            await ApiAssert.ErrorAsync(await admin.DeleteAsync($"api/restaurant/settings/service/{unknown}"),
                HttpStatusCode.NotFound, "NotFound", "Service not found.");
        }
    }
}
