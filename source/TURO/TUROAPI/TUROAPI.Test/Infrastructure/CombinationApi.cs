using TUROAPI.Services;

namespace TUROAPI.Test.Infrastructure
{
    /// <summary>Les combinaisons en service (§3.4) : dates recalculées, rappels, mode édition</summary>
    public static class CombinationApi
    {
        /// <summary>Le recalcul que ferait un geste : pour une affectation posée en base par le test</summary>
        public static Task RecomputeAsync(Guid restaurantId) =>
            TestApi.WithDbAsync(async db =>
            {
                await CombinationFloor.ApplyAsync(db, restaurantId, DateTime.UtcNow);
                await db.SaveChangesAsync();
            });

        public static Task<Combination> StoredAsync(Guid id) =>
            TestApi.WithDbAsync(db => db.Combinations.AsNoTracking().SingleAsync(c => c.Id == id));

        /// <summary>Une réservation commencée ou à venir à un instant précis, au lieu d'une heure ronde</summary>
        public static Task StartsAtAsync(Guid reservationId, DateTime start) =>
            TestApi.WithDbAsync(db => db.Reservations.Where(r => r.Id == reservationId)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Start, start)));

        public static async Task<List<CombinationReminderResponse>> RemindersAsync(HttpClient client) =>
            await ApiAssert.OkAsync<List<CombinationReminderResponse>>(await client.GetAsync("api/service/reminders"));

        public static Task<HttpResponseMessage> AnswerAsync(HttpClient client, Guid combinationId, CombinationReminderKind kind, ReminderAnswer answer) =>
            client.PostAsJsonAsync($"api/service/combinations/{combinationId}/reminder",
                new ReminderAnswerRequest { Kind = kind, Answer = answer }, TestJson.Options);

        public static async Task<Guid> AnsweredAsync(HttpClient client, Guid combinationId, CombinationReminderKind kind, ReminderAnswer answer) =>
            (await ApiAssert.OkAsync<ServiceUndoResponse>(await AnswerAsync(client, combinationId, kind, answer))).UndoId;

        public static Task<HttpResponseMessage> UndoAsync(HttpClient client, Guid undoId) =>
            client.PostAsync($"api/service/undo/{undoId}", null);

        public static Task<HttpResponseMessage> LayoutAsync(HttpClient client, LayoutRequest request) =>
            client.PostAsJsonAsync("api/service/layout", request, TestJson.Options);

        public static async Task<Guid> LaidOutAsync(HttpClient client, LayoutRequest request) =>
            (await ApiAssert.OkAsync<ServiceUndoResponse>(await LayoutAsync(client, request))).UndoId;

        public static TableMoveRequest Move(Table table, double x, double y) => new() { TableId = table.Id, X = x, Y = y };

        public static Task<Table> TableAsync(Guid id) =>
            TestApi.WithDbAsync(db => db.Tables.AsNoTracking().SingleAsync(t => t.Id == id));
    }
}
