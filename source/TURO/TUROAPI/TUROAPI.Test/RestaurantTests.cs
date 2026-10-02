using Microsoft.Extensions.DependencyInjection;
using TUROAPI.Services;

namespace TUROAPI.Test
{
    /// <summary>GET /api/restaurant : réglages, services, salles et équipe du restaurant courant</summary>
    [TestClass]
    public sealed class RestaurantTests
    {
        [TestMethod]
        public async Task Restaurant_info_gathers_settings_services_rooms_and_team()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            ServiceResponse service = await ApiAssert.OkAsync<ServiceResponse>(await admin.PostAsJsonAsync(
                "api/restaurant/settings/service", Requests.Service(DayOfWeek.Monday, 19, 23), TestJson.Options));
            ZoneResponse zone = await PlanApi.AddZoneAsync(admin);

            RestaurantReponses info = await ApiAssert.OkAsync<RestaurantReponses>(await admin.GetAsync("api/restaurant"));

            Assert.AreEqual(Dates.TimeZoneId, info.TimeZone);
            Assert.AreEqual(120, info.DefaultRotation);
            Assert.AreEqual(2, info.SeatTolerance);
            Assert.AreEqual(15, info.LateGrace);
            Assert.AreEqual(service.Id, info.Services.Single().Id);
            Assert.AreEqual(zone.Id, info.Zones.Single().Id);
            CollectionAssert.AreEquivalent(new[] { UserRole.Admin, UserRole.Staff }, info.Users.Select(u => u.Role).ToArray());
        }

        [TestMethod]
        public async Task Token_of_a_vanished_restaurant_is_a_critical_error()
        {
            var ghost = new UserStaff { Id = Guid.NewGuid(), RestaurantId = Guid.NewGuid(), Role = UserRole.Admin, Login = "fantome" };
            string jwt = TestApi.Factory.Services.GetRequiredService<TokenService>().GenerateJWT(ghost);
            using HttpClient client = TestApi.CreateClient(jwt);

            await ApiAssert.ErrorAsync(await client.GetAsync("api/restaurant"),
                HttpStatusCode.InternalServerError, "CriticalDataInternalError", $"Restaurant of user {ghost.Id} not found");
        }
    }
}
