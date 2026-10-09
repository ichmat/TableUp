namespace TUROAPI.Test.Infrastructure
{
    /// <summary>Le placement (§5.8) : verdicts, dépôt, walk-in</summary>
    public static class PlacementApi
    {
        public static Task<HttpResponseMessage> GetAsync(HttpClient client, Guid reservationId) =>
            client.GetAsync($"api/service/placement/{reservationId}");

        public static async Task<PlacementResponse> VerdictsAsync(HttpClient client, Guid reservationId) =>
            await ApiAssert.OkAsync<PlacementResponse>(await GetAsync(client, reservationId));

        public static Task<HttpResponseMessage> PlaceAsync(HttpClient client, Guid reservationId, Guid? tableId = null, Guid? combinationId = null) =>
            client.PostAsJsonAsync($"api/reservations/{reservationId}/place", new PlaceRequest { TableId = tableId, CombinationId = combinationId }, TestJson.Options);

        public static async Task<ReservationActionResponse> PlacedAsync(HttpClient client, Guid reservationId, Guid? tableId = null, Guid? combinationId = null) =>
            await ApiAssert.OkAsync<ReservationActionResponse>(await PlaceAsync(client, reservationId, tableId, combinationId));

        public static Task<HttpResponseMessage> SeatAsync(HttpClient client, Guid tableId, int covers, bool acceptBookedLater = false) =>
            client.PostAsJsonAsync($"api/service/tables/{tableId}/seat", new SeatRequest { Covers = covers, AcceptBookedLater = acceptBookedLater }, TestJson.Options);

        public static Task ActivateAsync(Guid combinationId) =>
            TestApi.WithDbAsync(db => db.Combinations.Where(c => c.Id == combinationId)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.IsActive, true)));

        public static PlacementEntityResponse Entity(PlacementResponse placement, string name) =>
            placement.Entities.Single(e => e.Name == name);
    }
}
