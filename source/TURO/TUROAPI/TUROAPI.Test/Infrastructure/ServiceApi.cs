namespace TUROAPI.Test.Infrastructure
{
    /// <summary>L'écran Service : l'instantané, le calendrier, le nettoyage</summary>
    public static class ServiceApi
    {
        public static async Task<ServiceSnapshotResponse> GetAsync(HttpClient client, string query = "") =>
            await ApiAssert.OkAsync<ServiceSnapshotResponse>(await client.GetAsync($"api/service{query}"));

        /// <summary>Arrivée et libération posées en base : le geste est testé ailleurs, ici seule compte l'occupation</summary>
        public static Task SetTimesAsync(Guid reservationId, DateTime? seatedAt, DateTime? finishedAt) =>
            TestApi.WithDbAsync(db => db.Reservations.Where(r => r.Id == reservationId).ExecuteUpdateAsync(s => s
                .SetProperty(r => r.SeatedAt, seatedAt)
                .SetProperty(r => r.FinishedAt, finishedAt)));

        public static Task SetAllergiesAsync(Guid clientId, string allergies) =>
            TestApi.WithDbAsync(db => db.Clients.Where(c => c.Id == clientId).ExecuteUpdateAsync(s => s.SetProperty(c => c.Allergies, allergies)));

        public static Task<HttpResponseMessage> CleanAsync(HttpClient client, Guid tableId) =>
            client.PostAsync($"api/service/tables/{tableId}/clean", null);

        public static Task<HttpResponseMessage> UndoCleanAsync(HttpClient client, Guid tableId, DateTime since) =>
            client.PostAsJsonAsync($"api/service/tables/{tableId}/clean/undo", new CleanUndoRequest { Since = since }, TestJson.Options);

        /// <summary>PostgreSQL garde la microseconde, `DateTime` la centaine de nanosecondes : une milliseconde d'écart suffit</summary>
        public static void AssertSameInstant(DateTime expected, DateTime actual) =>
            Assert.IsTrue(Math.Abs((expected - actual).TotalMilliseconds) < 1, $"Attendu {expected:O}, reçu {actual:O}");

        public static Task MarkToCleanAsync(Guid tableId, DateTime since) =>
            TestApi.WithDbAsync(db => db.Tables.Where(t => t.Id == tableId).ExecuteUpdateAsync(s => s.SetProperty(t => t.NeedsCleaningSince, since)));
    }
}
