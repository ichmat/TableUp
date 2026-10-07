namespace TUROAPI.Test
{
    /// <summary>
    /// Les notifications ne portent qu'un scope, et ne sortent jamais du restaurant (docs/TURO-stack-technique.md §5.6)
    /// </summary>
    [TestClass]
    public sealed class RealtimeTests
    {
        [TestMethod]
        public async Task Writes_notify_the_screens_of_the_restaurant_with_the_right_scope()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            await using Screen screen = await Screen.ConnectAsync(restaurant.StaffJwt());

            ZoneResponse zone = await PlanApi.AddZoneAsync(admin);
            Assert.AreEqual(DataScope.FloorPlan, await screen.NextAsync());

            await ApiAssert.OkAsync<ServiceResponse>(await admin.PostAsJsonAsync("api/restaurant/settings/service",
                Requests.Service(DayOfWeek.Monday, 19, 23), TestJson.Options));
            Assert.AreEqual(DataScope.Restaurant, await screen.NextAsync());

            DateOnly day = Dates.Today.AddDays(10);
            await ApiAssert.OkAsync<ClosureResponse>(await admin.PostAsJsonAsync("api/restaurant/closures",
                Requests.Closed(day, day), TestJson.Options));
            Assert.AreEqual(DataScope.Closures, await screen.NextAsync());

            await PlanApi.SaveAndPublishAsync(admin, new FloorPlanDraftContent { Tables = [PlanApi.Table(zone.Id, "T1")] });
            Assert.AreEqual(DataScope.FloorPlan, await screen.NextAsync());
        }

        [TestMethod]
        public async Task Notifications_never_reach_another_restaurant()
        {
            TestRestaurant a = await TestRestaurant.CreateAsync();
            TestRestaurant b = await TestRestaurant.CreateAsync();
            using HttpClient adminA = a.AdminClient();
            await using Screen screenA = await Screen.ConnectAsync(a.StaffJwt());
            await using Screen screenB = await Screen.ConnectAsync(b.StaffJwt());

            await PlanApi.AddZoneAsync(adminA);

            Assert.AreEqual(DataScope.FloorPlan, await screenA.NextAsync());
            // L'envoi a eu lieu : on laisse à un éventuel message égaré le temps d'arriver
            await Task.Delay(300);
            Assert.IsFalse(screenB.TryNext(out DataScope leaked), $"reçu chez B : {leaked}");
        }

        [TestMethod]
        public async Task Saving_a_draft_notifies_nobody()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            await using Screen screen = await Screen.ConnectAsync(restaurant.StaffJwt());
            ZoneResponse zone = await PlanApi.AddZoneAsync(admin, "Salle");
            Assert.AreEqual(DataScope.FloorPlan, await screen.NextAsync());

            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(admin,
                new FloorPlanDraftContent { Tables = [PlanApi.Table(zone.Id, "T1")] }));
            // Une écriture qui notifie, après le brouillon : un seul message doit arriver
            await PlanApi.AddZoneAsync(admin, "Terrasse");

            Assert.AreEqual(DataScope.FloorPlan, await screen.NextAsync());
            await Task.Delay(300);
            Assert.IsFalse(screen.TryNext(out _), "le brouillon a notifié");
        }

        [TestMethod]
        public async Task Hub_refuses_a_connection_without_token()
        {
            await Assert.ThrowsAsync<HttpRequestException>(() => Screen.ConnectAsync(null));
        }
    }
}
