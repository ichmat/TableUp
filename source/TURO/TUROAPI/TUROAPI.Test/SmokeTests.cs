using System.Diagnostics;

namespace TUROAPI.Test
{
    [TestClass]
    public sealed class SmokeTests
    {
        [TestMethod]
        public async Task Admin_reads_its_own_restaurant()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();

            RestaurantReponses body = await ApiAssert.OkAsync<RestaurantReponses>(await admin.GetAsync("api/restaurant"));

            Assert.AreEqual(restaurant.Id, body.Id);
            Assert.AreEqual(restaurant.Name, body.Name);
        }

        // L'API reçoit Relational par EntityFrameworkCore.Design (PrivateAssets) : sans référence directe,
        // les tests tourneraient avec la version tirée par Npgsql, que l'API n'utilise jamais
        [TestMethod]
        public void Ef_core_and_relational_run_the_same_version_as_the_api()
        {
            string core = FileVersionInfo.GetVersionInfo(typeof(DbContext).Assembly.Location).FileVersion!;
            string relational = FileVersionInfo.GetVersionInfo(typeof(RelationalDatabaseFacadeExtensions).Assembly.Location).FileVersion!;

            Assert.AreEqual(core, relational);
        }

        [TestMethod]
        public async Task Every_migration_is_applied_to_the_test_database()
        {
            List<string> pending = await TestApi.WithDbAsync(async db => (await db.Database.GetPendingMigrationsAsync()).ToList());
            Assert.AreEqual(0, pending.Count, string.Join(", ", pending));
        }
    }
}
