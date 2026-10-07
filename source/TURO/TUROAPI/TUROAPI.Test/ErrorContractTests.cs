using System.Text;

namespace TUROAPI.Test
{
    /// <summary>Le front lit toute erreur au format ApiErrorResponse, et les enums par leur nom (CLAUDE.md)</summary>
    [TestClass]
    public sealed class ErrorContractTests
    {
        private static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

        [TestMethod]
        public async Task Unreadable_json_body_comes_back_as_an_api_error()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();

            await ApiAssert.ErrorAsync(await admin.PostAsync("api/restaurant/floor-plan/zones", Json("{ pas du json")),
                HttpStatusCode.BadRequest, "InvalidRequest", "Invalid request : ");
        }

        [TestMethod]
        public async Task Unknown_enum_name_comes_back_as_an_api_error()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            string body = """{"day":"Monday","opening":"19:00:00","closing":"23:00:00","slotStep":30,"occupancyMode":"Banane"}""";

            await ApiAssert.ErrorAsync(await admin.PostAsync("api/restaurant/settings/service", Json(body)),
                HttpStatusCode.BadRequest, "InvalidRequest", "occupancyMode");
        }

        [TestMethod]
        public async Task Missing_required_field_is_an_invalid_request()
        {
            using HttpClient client = TestApi.CreateClient();

            await ApiAssert.ErrorAsync(await client.PostAsync("api/auth/login", Json("""{"login":"quelqu'un"}""")),
                HttpStatusCode.BadRequest, "InvalidRequest");
        }

        [TestMethod]
        public async Task Unknown_api_route_is_a_json_404_even_without_token()
        {
            using HttpClient client = TestApi.CreateClient();

            await ApiAssert.ErrorAsync(await client.GetAsync("api/nothing/here"),
                HttpStatusCode.NotFound, "NotFound", "unknown API route GET /api/nothing/here.");
        }

        [TestMethod]
        public async Task Unexpected_failure_hides_its_details()
        {
            // Un fuseau inconnu fait échouer TimeZoneInfo.FindSystemTimeZoneById : une exception que l'API n'a pas prévue
            TestRestaurant restaurant = await TestRestaurant.CreateAsync(timeZone: "Nulle/Part");
            using HttpClient admin = restaurant.AdminClient();
            DateOnly day = Dates.Today.AddDays(10);

            ApiErrorBody error = await ApiAssert.ErrorAsync(
                await admin.PostAsJsonAsync("api/restaurant/closures/impact", Requests.Closed(day, day), TestJson.Options),
                HttpStatusCode.InternalServerError, "Unknown", "An unknown error occurred.");

            Assert.IsFalse(error.Message.Contains("Nulle"), error.Message);
        }

        [TestMethod]
        public async Task Enums_travel_by_name()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();

            string service = await (await admin.PostAsJsonAsync("api/restaurant/settings/service",
                Requests.Service(DayOfWeek.Monday, 19, 23), TestJson.Options)).Content.ReadAsStringAsync();
            string error = await (await admin.PostAsync("api/auth/login",
                Json("""{"login":"personne","password":"rien"}"""))).Content.ReadAsStringAsync();

            Assert.IsTrue(service.Contains("\"day\":\"Monday\""), service);
            Assert.IsTrue(service.Contains("\"occupancyMode\":\"Rotation\""), service);
            Assert.IsTrue(error.Contains("\"error\":\"InvalidLoginOrPassword\""), error);
        }
    }
}
