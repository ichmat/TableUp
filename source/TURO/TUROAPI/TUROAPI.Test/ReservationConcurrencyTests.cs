namespace TUROAPI.Test
{
    /// <summary>
    /// Deux tablettes, le même instant (spec CRM, « Pas de recomptage ») : les compteurs restent justes par construction.
    /// Chaque geste verrouille sa réservation, et les compteurs s'incrémentent en base
    /// </summary>
    [TestClass]
    public sealed class ReservationConcurrencyTests
    {
        /// <summary>Lance toutes les requêtes en même temps et attend toutes les réponses</summary>
        private static Task<HttpResponseMessage[]> AllAtOnceAsync(IEnumerable<Func<Task<HttpResponseMessage>>> calls) =>
            Task.WhenAll(calls.Select(call => Task.Run(call)));

        private static string Codes(HttpResponseMessage[] responses) => string.Join(", ", responses.Select(r => (int)r.StatusCode));

        [TestMethod]
        public async Task The_same_no_show_from_several_tablets_counts_once()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Client roux = await ClientApi.AddAsync(restaurant.Id, "Roux", phone: "0611111111");
            Reservation late = await restaurant.AddReservationAsync(Dates.Today.AddDays(-1), 20, clientId: roux.Id);

            HttpResponseMessage[] responses = await AllAtOnceAsync(Enumerable.Range(0, 6).Select(_ =>
                (Func<Task<HttpResponseMessage>>)(() => ReservationApi.ActAsync(staff, late.Id, "no-show"))));

            Assert.AreEqual(1, responses.Count(r => r.StatusCode == HttpStatusCode.OK), Codes(responses));
            Assert.AreEqual(5, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict), Codes(responses));
            Assert.AreEqual(1, (await ClientApi.StoredAsync(roux.Id))!.NoShowCount);
            Assert.AreEqual(1, await TestApi.WithDbAsync(db => db.EventLogs.CountAsync(e => e.ReservationId == late.Id)));
        }

        [TestMethod]
        public async Task Reservations_of_one_client_changed_at_once_all_count()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (_, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle",
                Enumerable.Range(1, 8).Select(i => ($"T{i}", 4)).ToArray());
            Client sophie = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0612345678");
            List<Guid> ids = [];
            foreach (Table table in tables)
            {
                Reservation reservation = await restaurant.AddReservationAsync(Dates.Today, 20, clientId: sophie.Id);
                await ReservationApi.AssignAsync(reservation.Id, tableId: table.Id);
                ids.Add(reservation.Id);
            }

            HttpResponseMessage[] responses = await AllAtOnceAsync(ids.Select(id =>
                (Func<Task<HttpResponseMessage>>)(() => ReservationApi.ActAsync(staff, id, "arrive"))));

            Assert.IsTrue(responses.All(r => r.StatusCode == HttpStatusCode.OK), Codes(responses));
            // Lire puis écrire le compteur en perdrait : l'incrément se fait en base
            Assert.AreEqual(8, (await ClientApi.StoredAsync(sophie.Id))!.VisitCount);
        }

        [TestMethod]
        public async Task Reopen_racing_a_no_show_leaves_counters_matching_the_final_status()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Client roux = await ClientApi.AddAsync(restaurant.Id, "Roux", phone: "0611111111");

            for (int round = 0; round < 5; round++)
            {
                Reservation late = await restaurant.AddReservationAsync(Dates.Today.AddDays(-1), 20, clientId: roux.Id);

                await AllAtOnceAsync([
                    () => ReservationApi.ActAsync(staff, late.Id, "no-show"),
                    () => ReservationApi.ActAsync(staff, late.Id, "reopen"),
                ]);
            }

            int noShows = await TestApi.WithDbAsync(db =>
                db.Reservations.CountAsync(r => r.ClientId == roux.Id && r.Status == ReservationStatus.NoShow));
            Assert.AreEqual(noShows, (await ClientApi.StoredAsync(roux.Id))!.NoShowCount);
        }

        [TestMethod]
        public async Task A_merge_during_a_gesture_never_deadlocks_and_counts_once()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();

            for (int round = 0; round < 5; round++)
            {
                Client kept = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", email: $"s{round}@mail.fr", noShows: 1);
                Client other = await ClientApi.AddAsync(restaurant.Id, "S. Marchand", phone: $"070000000{round}", email: $"s{round}@mail.fr");
                Reservation late = await restaurant.AddReservationAsync(Dates.Today.AddDays(-1), 20, clientId: other.Id);

                HttpResponseMessage[] responses = await AllAtOnceAsync([
                    () => admin.PostAsync($"api/clients/{kept.Id}/merge/{other.Id}", null),
                    () => ReservationApi.ActAsync(admin, late.Id, "no-show"),
                ]);

                Assert.IsTrue(responses.All(r => r.StatusCode == HttpStatusCode.OK), Codes(responses));
                // 1 + 1 : avant la fusion, le no-show est additionné par elle ; après, il va directement sur la fiche gardée
                Assert.AreEqual(2, (await ClientApi.StoredAsync(kept.Id))!.NoShowCount);
            }
        }
    }
}
