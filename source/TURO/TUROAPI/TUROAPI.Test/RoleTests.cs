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
    }
}
