namespace TUROAPI.Test.Infrastructure
{
    /// <summary>Le plan de salle par l'API, comme l'éditeur s'en sert : salles en direct, tables par brouillon puis publication</summary>
    public static class PlanApi
    {
        public static Task<HttpResponseMessage> PostZoneAsync(HttpClient admin, string name, double width, double height) =>
            admin.PostAsJsonAsync("api/restaurant/floor-plan/zones",
                new ZoneRequest { Name = name, Width = width, Height = height }, TestJson.Options);

        public static async Task<ZoneResponse> AddZoneAsync(HttpClient admin, string name = "Salle", double width = 8, double height = 6) =>
            await ApiAssert.OkAsync<ZoneResponse>(await PostZoneAsync(admin, name, width, height));

        public static Task<HttpResponseMessage> UpdateZoneAsync(HttpClient admin, Guid id, string name, double width, double height) =>
            admin.PutAsJsonAsync($"api/restaurant/floor-plan/zones/{id}",
                new ZoneRequest { Name = name, Width = width, Height = height }, TestJson.Options);

        public static async Task<List<ZoneResponse>> GetPlanAsync(HttpClient client) =>
            await ApiAssert.OkAsync<List<ZoneResponse>>(await client.GetAsync("api/restaurant/floor-plan"));

        public static DraftTableItem Table(Guid zoneId, string name, double x = 1, double y = 1, int capacity = 4,
            TableShape shape = TableShape.Square, double width = 0.8, double height = 0.8, double rotation = 0, Guid? id = null) => new()
        {
            Id = id ?? Guid.NewGuid(),
            ZoneId = zoneId,
            Name = name,
            Capacity = capacity,
            Shape = shape,
            X = x,
            Y = y,
            Width = width,
            Height = height,
            Rotation = rotation,
        };

        public static DraftDecorItem Decor(Guid zoneId, DecorType type = DecorType.Pillar, double x = 3, double y = 3,
            double width = 0.4, double height = 0.4, string? label = null, double rotation = 0, Guid? id = null) => new()
        {
            Id = id ?? Guid.NewGuid(),
            ZoneId = zoneId,
            Type = type,
            Label = label,
            X = x,
            Y = y,
            Width = width,
            Height = height,
            Rotation = rotation,
        };

        public static DraftCombinationItem Combination(string name, int capacity, Guid first, Guid second, Guid? id = null) => new()
        {
            Id = id ?? Guid.NewGuid(),
            Name = name,
            Capacity = capacity,
            TableIds = [first, second],
        };

        public static Task<HttpResponseMessage> SaveDraftAsync(HttpClient admin, FloorPlanDraftContent content) =>
            admin.PutAsJsonAsync("api/restaurant/floor-plan/draft", content, TestJson.Options);

        public static Task<HttpResponseMessage> PublishAsync(HttpClient admin) =>
            admin.PostAsync("api/restaurant/floor-plan/publish", null);

        /// <summary>Enregistre le brouillon, le publie et rend le plan publié</summary>
        public static async Task<List<ZoneResponse>> SaveAndPublishAsync(HttpClient admin, FloorPlanDraftContent content)
        {
            await ApiAssert.OkAsync<FloorPlanDraftResponse>(await SaveDraftAsync(admin, content));
            return await ApiAssert.OkAsync<List<ZoneResponse>>(await PublishAsync(admin));
        }

        /// <summary>La désactivation n'a pas encore d'écran (lot 5) : on la pose en base</summary>
        public static Task DeactivateTableAsync(Guid tableId) =>
            TestApi.WithDbAsync(db => db.Tables
                .Where(t => t.Id == tableId)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.IsActive, false)));
    }
}
