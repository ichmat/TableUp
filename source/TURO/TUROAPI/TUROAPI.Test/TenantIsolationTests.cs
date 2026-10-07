using System.Text.Json;

namespace TUROAPI.Test
{
    /// <summary>
    /// La même image sert plusieurs restaurants en hébergé : aucune lecture ni écriture ne traverse la frontière d'un restaurant
    /// </summary>
    [TestClass]
    public sealed class TenantIsolationTests
    {
        [TestMethod]
        public async Task Reads_never_show_another_restaurants_data()
        {
            TestRestaurant a = await TestRestaurant.CreateAsync();
            TestRestaurant b = await TestRestaurant.CreateAsync();
            using HttpClient adminA = a.AdminClient();
            using HttpClient adminB = b.AdminClient();
            await ApiAssert.OkAsync<ServiceResponse>(await adminA.PostAsJsonAsync("api/restaurant/settings/service",
                Requests.Service(DayOfWeek.Monday, 19, 23), TestJson.Options));
            await ApiAssert.OkAsync<ClosureResponse>(await adminA.PostAsJsonAsync("api/restaurant/closures",
                Requests.Closed(Dates.Today.AddDays(10), Dates.Today.AddDays(10)), TestJson.Options));
            ZoneResponse zoneA = await PlanApi.AddZoneAsync(adminA);
            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await PlanApi.SaveDraftAsync(adminA,
                new FloorPlanDraftContent { Tables = [PlanApi.Table(zoneA.Id, "T1")] }));

            RestaurantReponses restaurantB = await ApiAssert.OkAsync<RestaurantReponses>(await adminB.GetAsync("api/restaurant"));
            Assert.AreEqual(0, restaurantB.Services.Count);
            Assert.AreEqual(0, restaurantB.Zones.Count);
            Assert.IsTrue(restaurantB.Users.All(u => u.RestaurantId == b.Id));
            Assert.AreEqual(0, (await ApiAssert.OkAsync<List<ClosureResponse>>(await adminB.GetAsync("api/restaurant/closures"))).Count);
            Assert.AreEqual(0, (await PlanApi.GetPlanAsync(adminB)).Count);
            Assert.AreEqual(HttpStatusCode.NoContent, (await adminB.GetAsync("api/restaurant/floor-plan/draft")).StatusCode);
        }

        [TestMethod]
        public async Task Another_restaurants_service_cannot_be_changed_or_deleted()
        {
            TestRestaurant a = await TestRestaurant.CreateAsync();
            TestRestaurant b = await TestRestaurant.CreateAsync();
            using HttpClient adminA = a.AdminClient();
            using HttpClient adminB = b.AdminClient();
            ServiceResponse service = await ApiAssert.OkAsync<ServiceResponse>(await adminA.PostAsJsonAsync(
                "api/restaurant/settings/service", Requests.Service(DayOfWeek.Monday, 19, 23), TestJson.Options));

            await ApiAssert.ErrorAsync(await adminB.PutAsJsonAsync($"api/restaurant/settings/service/{service.Id}",
                Requests.Service(DayOfWeek.Monday, 12, 14), TestJson.Options), HttpStatusCode.NotFound, "NotFound", "Service not found.");
            await ApiAssert.ErrorAsync(await adminB.DeleteAsync($"api/restaurant/settings/service/{service.Id}"),
                HttpStatusCode.NotFound, "NotFound", "Service not found.");

            Service stored = await TestApi.WithDbAsync(db => db.Services.AsNoTracking().SingleAsync(s => s.Id == service.Id));
            Assert.AreEqual(new TimeOnly(19, 0), stored.Opening);
        }

        [TestMethod]
        public async Task Another_restaurants_closure_cannot_be_changed_or_deleted()
        {
            TestRestaurant a = await TestRestaurant.CreateAsync();
            TestRestaurant b = await TestRestaurant.CreateAsync();
            using HttpClient adminA = a.AdminClient();
            using HttpClient adminB = b.AdminClient();
            DateOnly day = Dates.Today.AddDays(10);
            ClosureResponse closure = await ApiAssert.OkAsync<ClosureResponse>(await adminA.PostAsJsonAsync(
                "api/restaurant/closures", Requests.Closed(day, day), TestJson.Options));

            await ApiAssert.ErrorAsync(await adminB.PutAsJsonAsync($"api/restaurant/closures/{closure.Id}",
                Requests.Closed(day, day.AddDays(3)), TestJson.Options), HttpStatusCode.NotFound, "NotFound", "Closure not found.");
            await ApiAssert.ErrorAsync(await adminB.DeleteAsync($"api/restaurant/closures/{closure.Id}"),
                HttpStatusCode.NotFound, "NotFound", "Closure not found.");

            Closure stored = await TestApi.WithDbAsync(db => db.Closures.AsNoTracking().SingleAsync(c => c.Id == closure.Id));
            Assert.AreEqual(day, stored.To);
        }

        [TestMethod]
        public async Task Another_restaurants_room_cannot_be_changed_or_deleted()
        {
            TestRestaurant a = await TestRestaurant.CreateAsync();
            TestRestaurant b = await TestRestaurant.CreateAsync();
            using HttpClient adminA = a.AdminClient();
            using HttpClient adminB = b.AdminClient();
            ZoneResponse zone = await PlanApi.AddZoneAsync(adminA, "Salle");

            await ApiAssert.ErrorAsync(await PlanApi.UpdateZoneAsync(adminB, zone.Id, "Piratée", 8, 6),
                HttpStatusCode.NotFound, "NotFound", "Zone not found.");
            await ApiAssert.ErrorAsync(await adminB.DeleteAsync($"api/restaurant/floor-plan/zones/{zone.Id}"),
                HttpStatusCode.NotFound, "NotFound", "Zone not found.");

            Zone stored = await TestApi.WithDbAsync(db => db.Zones.AsNoTracking().SingleAsync(z => z.Id == zone.Id));
            Assert.AreEqual("Salle", stored.Name);
        }

        [TestMethod]
        public async Task Room_order_only_accepts_the_restaurants_own_rooms()
        {
            TestRestaurant a = await TestRestaurant.CreateAsync();
            TestRestaurant b = await TestRestaurant.CreateAsync();
            using HttpClient adminA = a.AdminClient();
            using HttpClient adminB = b.AdminClient();
            ZoneResponse zoneA = await PlanApi.AddZoneAsync(adminA);
            ZoneResponse zoneB = await PlanApi.AddZoneAsync(adminB);

            foreach (List<Guid> order in new List<Guid>[] { [zoneA.Id], [zoneB.Id, zoneA.Id] })
            {
                await ApiAssert.ErrorAsync(await adminB.PutAsJsonAsync("api/restaurant/floor-plan/zones/order",
                    new ZoneOrderRequest { ZoneIds = order }, TestJson.Options),
                    HttpStatusCode.Forbidden, "InvalidModification", "every room exactly once");
            }
        }

        [TestMethod]
        public async Task Draft_cannot_place_a_table_in_another_restaurants_room()
        {
            TestRestaurant a = await TestRestaurant.CreateAsync();
            TestRestaurant b = await TestRestaurant.CreateAsync();
            using HttpClient adminA = a.AdminClient();
            using HttpClient adminB = b.AdminClient();
            ZoneResponse zoneA = await PlanApi.AddZoneAsync(adminA);
            await PlanApi.AddZoneAsync(adminB);

            await ApiAssert.ErrorAsync(await PlanApi.SaveDraftAsync(adminB,
                new FloorPlanDraftContent { Tables = [PlanApi.Table(zoneA.Id, "T1")] }),
                HttpStatusCode.Forbidden, "InvalidModification", "table T1: unknown room.");
        }

        [TestMethod]
        public async Task Draft_cannot_take_over_another_restaurants_table_decor_or_combination()
        {
            TestRestaurant a = await TestRestaurant.CreateAsync();
            TestRestaurant b = await TestRestaurant.CreateAsync();
            using HttpClient adminA = a.AdminClient();
            using HttpClient adminB = b.AdminClient();
            ZoneResponse zoneA = await PlanApi.AddZoneAsync(adminA);
            DraftTableItem t1 = PlanApi.Table(zoneA.Id, "T1", x: 1);
            DraftTableItem t2 = PlanApi.Table(zoneA.Id, "T2", x: 3);
            DraftDecorItem pillar = PlanApi.Decor(zoneA.Id);
            DraftCombinationItem combination = PlanApi.Combination("T1-T2", 8, t1.Id, t2.Id);
            await PlanApi.SaveAndPublishAsync(adminA,
                new FloorPlanDraftContent { Tables = [t1, t2], Decors = [pillar], Combinations = [combination] });
            ZoneResponse zoneB = await PlanApi.AddZoneAsync(adminB);

            await ApiAssert.ErrorAsync(await PlanApi.SaveDraftAsync(adminB,
                new FloorPlanDraftContent { Tables = [PlanApi.Table(zoneB.Id, "T1", id: t1.Id)] }),
                HttpStatusCode.Forbidden, "InvalidModification", "the draft uses a table id that belongs elsewhere.");
            await ApiAssert.ErrorAsync(await PlanApi.SaveDraftAsync(adminB,
                new FloorPlanDraftContent { Decors = [PlanApi.Decor(zoneB.Id, id: pillar.Id)] }),
                HttpStatusCode.Forbidden, "InvalidModification", "the draft uses a decor id that belongs elsewhere.");
            DraftTableItem b1 = PlanApi.Table(zoneB.Id, "B1", x: 1);
            DraftTableItem b2 = PlanApi.Table(zoneB.Id, "B2", x: 3);
            await ApiAssert.ErrorAsync(await PlanApi.SaveDraftAsync(adminB, new FloorPlanDraftContent
            {
                Tables = [b1, b2],
                Combinations = [PlanApi.Combination("B1-B2", 8, b1.Id, b2.Id, id: combination.Id)],
            }), HttpStatusCode.Forbidden, "InvalidModification", "the draft uses a combination id that belongs elsewhere.");

            TableResponse stillA = (await PlanApi.GetPlanAsync(adminA)).Single().Tables.Single(t => t.Id == t1.Id);
            Assert.AreEqual(zoneA.Id, stillA.ZoneId);
        }

        [TestMethod]
        public async Task Closure_ignores_another_restaurants_reservations()
        {
            TestRestaurant a = await TestRestaurant.CreateAsync();
            TestRestaurant b = await TestRestaurant.CreateAsync();
            using HttpClient adminB = b.AdminClient();
            DateOnly day = Dates.Today.AddDays(10);
            Reservation reservationA = await a.AddReservationAsync(day, 20);

            List<ImpactedReservationResponse> impact = await ApiAssert.OkAsync<List<ImpactedReservationResponse>>(
                await adminB.PostAsJsonAsync("api/restaurant/closures/impact", Requests.Closed(day, day), TestJson.Options));
            Assert.AreEqual(0, impact.Count);
            await ApiAssert.OkAsync<ClosureResponse>(
                await adminB.PostAsJsonAsync("api/restaurant/closures", Requests.Closed(day, day), TestJson.Options));

            Assert.AreEqual(ReservationStatus.Confirmed, (await TestRestaurant.ReservationAsync(reservationA.Id)).Status);
        }

        [TestMethod]
        public async Task Restaurant_payload_never_exposes_password_hashes()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            string hash = await TestApi.WithDbAsync(db => db.UserStaffs
                .Where(u => u.Id == restaurant.Admin.Id)
                .Select(u => u.PasswordHash)
                .SingleAsync());

            string json = await (await admin.GetAsync("api/restaurant")).Content.ReadAsStringAsync();

            Assert.IsFalse(json.Contains("passwordHash", StringComparison.OrdinalIgnoreCase), json);
            // Le JSON échappe « + » : on compare les valeurs lues, pas le texte brut
            using JsonDocument document = JsonDocument.Parse(json);
            Assert.IsFalse(Strings(document.RootElement).Contains(hash));
        }

        private static IEnumerable<string> Strings(JsonElement element) => element.ValueKind switch
        {
            JsonValueKind.String => [element.GetString()!],
            JsonValueKind.Object => element.EnumerateObject().SelectMany(p => Strings(p.Value)),
            JsonValueKind.Array => element.EnumerateArray().SelectMany(Strings),
            _ => [],
        };
    }
}
