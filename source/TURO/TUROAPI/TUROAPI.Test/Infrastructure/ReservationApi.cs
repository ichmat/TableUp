using System.Text.Json;

namespace TUROAPI.Test.Infrastructure
{
    /// <summary>Les réservations par l'API ; services, fermetures, tables et affectations posés en base (d'autres écrans les testent)</summary>
    public static class ReservationApi
    {
        /// <summary>Un samedi dans au moins une semaine : jamais passé pendant un test</summary>
        public static DateOnly Saturday => Dates.Next(DayOfWeek.Saturday);

        public static ReservationRequest Request(DateOnly? day = null, int hour = 20, int minute = 0, int covers = 4,
            string? phone = "06 12 34 56 78", string? name = "Sophie Marchand", string? email = null,
            ReservationSource source = ReservationSource.Phone, int? duration = null, string? note = null, Guid? zoneId = null) => new()
        {
            ServiceDay = day ?? Saturday,
            Time = new TimeOnly(hour, minute),
            Covers = covers,
            Phone = phone,
            Name = name,
            Email = email,
            Source = source,
            Duration = duration,
            Note = note,
            PreferredZoneId = zoneId,
        };

        public static Task AddServiceAsync(Guid restaurantId, DayOfWeek day, int opening, int closing, int slotStep = 30, int? duration = null) =>
            TestApi.WithDbAsync(db =>
            {
                db.Services.Add(new Service
                {
                    Id = Guid.NewGuid(),
                    RestaurantId = restaurantId,
                    Day = day,
                    Opening = new TimeOnly(opening, 0),
                    Closing = new TimeOnly(closing, 0),
                    SlotStep = slotStep,
                    OccupancyMode = OccupancyMode.Rotation,
                    ExpectedDuration = duration,
                });
                return db.SaveChangesAsync();
            });

        /// <summary>Ouvert tous les soirs, 19:00 – 23:00</summary>
        public static async Task OpenEveryEveningAsync(Guid restaurantId)
        {
            foreach (DayOfWeek day in Enum.GetValues<DayOfWeek>())
            {
                await AddServiceAsync(restaurantId, day, 19, 23);
            }
        }

        /// <summary>Sans plage : jour fermé. Avec des plages : horaires modifiés</summary>
        public static Task AddClosureAsync(Guid restaurantId, DateOnly day, params (int Opening, int Closing)[] hours) =>
            TestApi.WithDbAsync(db =>
            {
                db.Closures.Add(new Closure
                {
                    Id = Guid.NewGuid(),
                    RestaurantId = restaurantId,
                    From = day,
                    To = day,
                    Type = hours.Length == 0 ? ClosureType.Closed : ClosureType.ModifiedHours,
                    Reason = ClosureReason.Private,
                    ReplacementHours = hours.Length == 0 ? null
                        : hours.Select(h => new ReplacementHours { Opening = new TimeOnly(h.Opening, 0), Closing = new TimeOnly(h.Closing, 0) }).ToList(),
                });
                return db.SaveChangesAsync();
            });

        public static Task<HttpResponseMessage> PostAsync(HttpClient client, ReservationRequest request) =>
            client.PostAsJsonAsync("api/reservations", request, TestJson.Options);

        public static async Task<ReservationActionResponse> CreateAsync(HttpClient client, ReservationRequest request)
        {
            HttpResponseMessage response = await PostAsync(client, request);
            string body = await response.Content.ReadAsStringAsync();
            Assert.AreEqual(HttpStatusCode.Created, response.StatusCode, body);
            return JsonSerializer.Deserialize<ReservationActionResponse>(body, TestJson.Options)!;
        }

        public static async Task<ReservationResponse> GetAsync(HttpClient client, Guid id) =>
            await ApiAssert.OkAsync<ReservationResponse>(await client.GetAsync($"api/reservations/{id}"));

        /// <summary>Un geste : `accept`, `refuse`, `arrive`, `release`, `no-show`, `cancel` (avec <paramref name="by"/>), `reopen`</summary>
        public static Task<HttpResponseMessage> ActAsync(HttpClient client, Guid id, string gesture, CancelledBy by = CancelledBy.Client) =>
            gesture == "cancel"
                ? client.PostAsJsonAsync($"api/reservations/{id}/cancel", new CancelReservationRequest { By = by }, TestJson.Options)
                : client.PostAsync($"api/reservations/{id}/{gesture}", null);

        public static async Task<ReservationActionResponse> DoAsync(HttpClient client, Guid id, string gesture, CancelledBy by = CancelledBy.Client) =>
            await ApiAssert.OkAsync<ReservationActionResponse>(await ActAsync(client, id, gesture, by));

        public static Task<HttpResponseMessage> UndoAsync(HttpClient client, Guid id, Guid eventId) =>
            client.PostAsync($"api/reservations/{id}/undo/{eventId}", null);

        /// <summary>Sans version donnée, repart de la version enregistrée : la plupart des tests ne portent pas sur la concurrence</summary>
        public static async Task<HttpResponseMessage> PutAsync(HttpClient client, Guid id, ReservationRequest request)
        {
            if (request.Version == null)
            {
                HttpResponseMessage current = await client.GetAsync($"api/reservations/{id}");
                request.Version = current.IsSuccessStatusCode
                    ? (await current.Content.ReadFromJsonAsync<ReservationResponse>(TestJson.Options))!.Version
                    : 0;
            }
            return await client.PutAsJsonAsync($"api/reservations/{id}", request, TestJson.Options);
        }

        public static async Task<ReservationPageResponse> ListAsync(HttpClient client, string query = "") =>
            await ApiAssert.OkAsync<ReservationPageResponse>(await client.GetAsync($"api/reservations{query}"));

        /// <summary>Une salle et ses tables, en base : le placement arrive avec le lot Plan</summary>
        public static async Task<(Guid ZoneId, List<Table> Tables)> AddTablesAsync(Guid restaurantId, string zoneName, params (string Name, int Capacity)[] tables)
        {
            var zone = new Zone { Id = Guid.NewGuid(), RestaurantId = restaurantId, Name = zoneName, Width = 8, Height = 6 };
            List<Table> created = tables.Select((t, i) => new Table
            {
                Id = Guid.NewGuid(), ZoneId = zone.Id, Name = t.Name, Capacity = t.Capacity, Shape = TableShape.Square,
                X = 1 + i * 1.5, Y = 1, Width = 0.8, Height = 0.8,
            }).ToList();
            await TestApi.WithDbAsync(db =>
            {
                db.Zones.Add(zone);
                db.Tables.AddRange(created);
                return db.SaveChangesAsync();
            });
            return (zone.Id, created);
        }

        public static async Task<Guid> AddCombinationAsync(Guid zoneId, string name, int capacity, params Guid[] tableIds)
        {
            Guid id = Guid.NewGuid();
            await TestApi.WithDbAsync(async db =>
            {
                db.Combinations.Add(new Combination
                {
                    Id = id, ZoneId = zoneId, Name = name, Capacity = capacity,
                    Tables = [.. db.Tables.Where(t => tableIds.Contains(t.Id))],
                });
                await db.SaveChangesAsync();
            });
            return id;
        }

        public static Task AssignAsync(Guid reservationId, Guid? tableId = null, Guid? combinationId = null) =>
            TestApi.WithDbAsync(db =>
            {
                db.Assignments.Add(new Assignment
                {
                    Id = Guid.NewGuid(), ReservationId = reservationId, TableId = tableId, CombinationId = combinationId, AssignedAt = DateTime.UtcNow,
                });
                return db.SaveChangesAsync();
            });

        public static Task<Reservation> StoredAsync(Guid id) =>
            TestApi.WithDbAsync(db => db.Reservations.AsNoTracking().SingleAsync(r => r.Id == id));
    }
}
