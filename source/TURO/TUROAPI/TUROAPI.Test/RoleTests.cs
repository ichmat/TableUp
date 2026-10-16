using System.Text;

namespace TUROAPI.Test
{
    /// <summary>Le serveur lit ce dont le service a besoin ; tout réglage est réservé à l'administrateur</summary>
    [TestClass]
    public sealed class RoleTests
    {
        private const string AnyId = "6f1c2c1e-0000-4000-8000-000000000001";

        [TestMethod]
        [DataRow("POST", "api/restaurant/settings/service")]
        [DataRow("PUT", "api/restaurant/settings/service/" + AnyId)]
        [DataRow("DELETE", "api/restaurant/settings/service/" + AnyId)]
        [DataRow("POST", "api/restaurant/closures")]
        [DataRow("POST", "api/restaurant/closures/impact")]
        [DataRow("PUT", "api/restaurant/closures/" + AnyId)]
        [DataRow("DELETE", "api/restaurant/closures/" + AnyId)]
        [DataRow("POST", "api/restaurant/floor-plan/zones")]
        [DataRow("PUT", "api/restaurant/floor-plan/zones/" + AnyId)]
        [DataRow("PUT", "api/restaurant/floor-plan/zones/order")]
        [DataRow("DELETE", "api/restaurant/floor-plan/zones/" + AnyId)]
        [DataRow("GET", "api/restaurant/floor-plan/draft")]
        [DataRow("PUT", "api/restaurant/floor-plan/draft")]
        [DataRow("DELETE", "api/restaurant/floor-plan/draft")]
        [DataRow("POST", "api/restaurant/floor-plan/publish")]
        [DataRow("PUT", "api/restaurant/settings/placement")]
        [DataRow("PUT", "api/restaurant/settings/booking-window")]
        [DataRow("GET", "api/restaurant/settings/placement/preview?covers=4&tolerance=2")]
        [DataRow("POST", "api/clients/" + AnyId + "/merge/" + AnyId)]
        [DataRow("DELETE", "api/clients/" + AnyId)]
        public async Task Staff_cannot_call_an_admin_endpoint(string method, string path)
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            var request = new HttpRequestMessage(new HttpMethod(method), path);
            if (method is "POST" or "PUT")
            {
                request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
            }

            await ApiAssert.ErrorAsync(await staff.SendAsync(request), HttpStatusCode.Forbidden, "NotAdmin");
        }

        [TestMethod]
        [DataRow("api/restaurant")]
        [DataRow("api/restaurant/closures")]
        [DataRow("api/restaurant/floor-plan")]
        [DataRow("api/clients")]
        [DataRow("api/clients/export")]
        [DataRow("api/reservations")]
        [DataRow("api/reservations?period=Past")]
        public async Task Staff_reads_what_the_service_needs(string path)
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();

            HttpResponseMessage response = await staff.GetAsync(path);

            Assert.AreEqual(HttpStatusCode.OK, response.StatusCode, await response.Content.ReadAsStringAsync());
        }

        [TestMethod]
        public async Task Refused_staff_write_changes_nothing()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();

            await ApiAssert.ErrorAsync(
                await staff.PostAsJsonAsync("api/restaurant/floor-plan/zones", new ZoneRequest { Name = "Salle", Width = 8, Height = 6 }, TestJson.Options),
                HttpStatusCode.Forbidden, "NotAdmin");

            int zones = await TestApi.WithDbAsync(db => db.Zones.CountAsync(z => z.RestaurantId == restaurant.Id));
            Assert.AreEqual(0, zones);
        }

        [TestMethod]
        public async Task Staff_creates_and_updates_clients()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();

            ClientResponse created = await ClientApi.CreateAsync(staff, ClientApi.Request(allergies: "Arachide", notes: "Habituée"));
            await ApiAssert.OkAsync<ClientResponse>(await ClientApi.PutAsync(staff, created.Id, ClientApi.Request(allergies: "Arachide, lait")));
        }

        [TestMethod]
        public async Task Staff_books_and_handles_reservations()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);

            ReservationActionResponse created = await ReservationApi.CreateAsync(staff, ReservationApi.Request());
            await ApiAssert.OkAsync<ReservationActionResponse>(await ReservationApi.PutAsync(staff, created.Reservation.Id, ReservationApi.Request(covers: 5)));
            ReservationActionResponse cancelled = await ReservationApi.DoAsync(staff, created.Reservation.Id, "cancel");
            await ApiAssert.OkAsync<ReservationResponse>(await ReservationApi.UndoAsync(staff, created.Reservation.Id, cancelled.EventId!.Value));
        }
    }
}
