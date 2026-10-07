namespace TUROAPI.Test.Infrastructure
{
    /// <summary>Le mini-CRM par l'API, et des fiches posées en base quand l'API n'a pas encore le geste (compteurs, dates)</summary>
    public static class ClientApi
    {
        public static ClientRequest Request(string name = "Sophie Marchand", string[]? phones = null, string[]? emails = null,
            string? allergies = null, string? notes = null, ClientTag[]? tags = null) => new()
        {
            Name = name,
            Phones = [.. phones ?? ["06 12 34 56 78"]],
            Emails = [.. emails ?? []],
            Allergies = allergies,
            InternalNotes = notes,
            Tags = [.. tags ?? []],
        };

        public static Task<HttpResponseMessage> PostAsync(HttpClient client, ClientRequest request) =>
            client.PostAsJsonAsync("api/clients", request, TestJson.Options);

        public static async Task<ClientResponse> CreateAsync(HttpClient client, ClientRequest request) =>
            await ApiAssert.OkAsync<ClientResponse>(await PostAsync(client, request));

        /// <summary>
        /// Sans version donnée, repart de la version enregistrée : la plupart des tests ne portent pas sur la concurrence.
        /// Une fiche introuvable garde la version 0, et l'API répond 404 avant de la comparer
        /// </summary>
        public static async Task<HttpResponseMessage> PutAsync(HttpClient client, Guid id, ClientRequest request)
        {
            if (request.Version == null)
            {
                HttpResponseMessage current = await client.GetAsync($"api/clients/{id}");
                request.Version = current.IsSuccessStatusCode
                    ? (await current.Content.ReadFromJsonAsync<ClientResponse>(TestJson.Options))!.Version
                    : 0;
            }
            return await client.PutAsJsonAsync($"api/clients/{id}", request, TestJson.Options);
        }

        public static async Task<ClientResponse> GetAsync(HttpClient client, Guid id) =>
            await ApiAssert.OkAsync<ClientResponse>(await client.GetAsync($"api/clients/{id}"));

        public static async Task<ClientPageResponse> ListAsync(HttpClient client, string query = "") =>
            await ApiAssert.OkAsync<ClientPageResponse>(await client.GetAsync($"api/clients{query}"));

        /// <summary>Une fiche posée en base : les changements de statut, qui feront bouger les compteurs, n'ont pas encore d'API</summary>
        public static async Task<Client> AddAsync(Guid restaurantId, string name, string? phone = null, string? email = null,
            int visits = 0, int noShows = 0, DateTime? createdAt = null, string? allergies = null, ClientTag[]? tags = null)
        {
            var client = new Client
            {
                Id = Guid.NewGuid(),
                RestaurantId = restaurantId,
                Name = name,
                Phone = phone,
                Email = email,
                VisitCount = visits,
                NoShowCount = noShows,
                CreatedAt = createdAt ?? DateTime.UtcNow,
                Allergies = allergies,
                Tags = [.. tags ?? []],
            };
            await TestApi.WithDbAsync(db =>
            {
                db.Clients.Add(client);
                return db.SaveChangesAsync();
            });
            return client;
        }

        public static Task<Client?> StoredAsync(Guid id) =>
            TestApi.WithDbAsync(db => db.Clients.AsNoTracking().SingleOrDefaultAsync(c => c.Id == id));
    }
}
