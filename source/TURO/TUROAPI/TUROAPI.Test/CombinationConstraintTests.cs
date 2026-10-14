using System.Data.Common;

namespace TUROAPI.Test
{
    /// <summary>COMB-05 : au plus une action en attente — on ne rapproche que des tables séparées, on ne sépare que des tables collées</summary>
    [TestClass]
    public sealed class CombinationConstraintTests
    {
        private static async Task<Guid> DormantAsync()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("12", 4), ("13", 4));
            return await ReservationApi.AddCombinationAsync(zoneId, "12-13", 8, tables[0].Id, tables[1].Id);
        }

        [TestMethod]
        public async Task Glued_tables_cannot_wait_for_their_approach()
        {
            Guid id = await DormantAsync();

            await Assert.ThrowsAsync<DbException>(() => TestApi.WithDbAsync(db => db.Combinations.Where(c => c.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.IsActive, true).SetProperty(c => c.ActivateAt, DateTime.UtcNow))));
        }

        [TestMethod]
        public async Task Separated_tables_cannot_keep_a_separation_answer()
        {
            Guid id = await DormantAsync();

            await Assert.ThrowsAsync<DbException>(() => TestApi.WithDbAsync(db => db.Combinations.Where(c => c.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.SeparateAfterNoShowOf, Guid.NewGuid()))));
            await Assert.ThrowsAsync<DbException>(() => TestApi.WithDbAsync(db => db.Combinations.Where(c => c.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.KeepGluedFor, Guid.NewGuid()))));
        }

        [TestMethod]
        public async Task Each_state_keeps_its_own_pending_action()
        {
            Guid id = await DormantAsync();
            DateTime at = DateTime.UtcNow;

            await TestApi.WithDbAsync(db => db.Combinations.Where(c => c.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.ActivateAt, at).SetProperty(c => c.SnoozedUntil, at)));
            await TestApi.WithDbAsync(db => db.Combinations.Where(c => c.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.IsActive, true).SetProperty(c => c.ActivateAt, (DateTime?)null)
                    .SetProperty(c => c.DeactivateAt, at).SetProperty(c => c.KeepGluedFor, Guid.NewGuid())));

            Combination stored = await TestApi.WithDbAsync(db => db.Combinations.AsNoTracking().SingleAsync(c => c.Id == id));
            Assert.IsTrue(stored.IsActive);
            Assert.IsNotNull(stored.DeactivateAt);
        }
    }
}
