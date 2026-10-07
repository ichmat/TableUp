using TUROAPI.Services;

namespace TUROAPI.Test
{
    /// <summary>Doublons et suppression (§7.8) : fusion sur clé exacte seulement, suppression = anonymisation</summary>
    [TestClass]
    public sealed class ClientRecordsTests
    {
        [TestMethod]
        public async Task Merge_gathers_everything_on_the_kept_client_and_adds_the_counters()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            Client kept = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0612345678", email: "s@mail.fr",
                visits: 9, allergies: "Fruits à coque", tags: [ClientTag.Regular]);
            Client other = await ClientApi.AddAsync(restaurant.Id, "S. Marchand", phone: "0711223344", email: "s@mail.fr",
                noShows: 4, allergies: "Crustacés", tags: [ClientTag.Vip]);
            await restaurant.AddReservationAsync(Dates.Today.AddDays(-3), 20, status: ReservationStatus.Finished, clientId: kept.Id);
            Reservation moved = await restaurant.AddReservationAsync(Dates.Today.AddDays(-9), 20, status: ReservationStatus.NoShow, clientId: other.Id);
            await using Screen screen = await Screen.ConnectAsync(restaurant.StaffJwt());

            ClientResponse merged = await ApiAssert.OkAsync<ClientResponse>(await admin.PostAsync($"api/clients/{kept.Id}/merge/{other.Id}", null));

            Assert.AreEqual("Sophie Marchand", merged.Name);
            CollectionAssert.AreEqual(new[] { "0612345678", "0711223344" }, merged.Phones);
            CollectionAssert.AreEqual(new[] { "s@mail.fr" }, merged.Emails);
            CollectionAssert.AreEquivalent(new[] { ClientTag.Regular, ClientTag.Vip }, merged.Tags);
            Assert.AreEqual("Fruits à coque · Crustacés", merged.Allergies);
            // CLI-12 : additionnés (9 + 0, 0 + 4), sans recomptage
            Assert.AreEqual(9, merged.VisitCount);
            Assert.AreEqual(4, merged.NoShowCount);
            Assert.AreEqual(2, merged.History.Count);
            Assert.AreEqual(0, merged.MergeCandidates.Count);
            Assert.IsNull(await ClientApi.StoredAsync(other.Id));
            Assert.AreEqual(kept.Id, (await TestRestaurant.ReservationAsync(moved.Id)).ClientId);
            Assert.AreEqual(DataScope.Clients, await screen.NextAsync());
        }

        [TestMethod]
        public async Task Merge_without_a_shared_key_is_refused_even_between_namesakes()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            Client paul = await ClientApi.AddAsync(restaurant.Id, "Paul Lefebvre", phone: "0612345678", allergies: "Arachide");
            Client namesake = await ClientApi.AddAsync(restaurant.Id, "Paul Lefebvre", phone: "0799999999");

            await ApiAssert.ErrorAsync(await admin.PostAsync($"api/clients/{paul.Id}/merge/{namesake.Id}", null),
                HttpStatusCode.BadRequest, "InvalidRequest", "share no phone number or e-mail");
            await ApiAssert.ErrorAsync(await admin.PostAsync($"api/clients/{paul.Id}/merge/{paul.Id}", null),
                HttpStatusCode.BadRequest, "InvalidRequest", "itself");

            Assert.IsNotNull(await ClientApi.StoredAsync(namesake.Id));
            Assert.IsNull((await ClientApi.StoredAsync(namesake.Id))!.Allergies);
        }

        [TestMethod]
        public async Task Merge_with_an_anonymized_or_foreign_client_is_not_found()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            TestRestaurant other = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            Client kept = await ClientApi.AddAsync(restaurant.Id, "Sophie", email: "s@mail.fr");
            Client foreign = await ClientApi.AddAsync(other.Id, "Sophie", email: "s@mail.fr");

            await ApiAssert.ErrorAsync(await admin.PostAsync($"api/clients/{kept.Id}/merge/{foreign.Id}", null),
                HttpStatusCode.NotFound, "NotFound");
            Assert.IsNotNull(await ClientApi.StoredAsync(foreign.Id));
        }

        [TestMethod]
        public async Task Deleting_a_client_anonymizes_it_and_keeps_its_reservations()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            Client sophie = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0612345678", email: "s@mail.fr",
                visits: 1, allergies: "Arachide", tags: [ClientTag.Vip]);
            Reservation kept = await restaurant.AddReservationAsync(Dates.Today.AddDays(-3), 20, covers: 4,
                status: ReservationStatus.Finished, clientId: sophie.Id);

            HttpResponseMessage response = await admin.DeleteAsync($"api/clients/{sophie.Id}");

            Assert.AreEqual(HttpStatusCode.NoContent, response.StatusCode, await response.Content.ReadAsStringAsync());
            Client stored = (await ClientApi.StoredAsync(sophie.Id))!;
            Assert.AreEqual("Client supprimé", stored.Name);
            Assert.IsNull(stored.Phone);
            Assert.IsNull(stored.Allergies);
            Assert.AreEqual(0, stored.Tags.Count);
            Assert.IsNotNull(stored.AnonymizedAt);
            Reservation reservation = await TestRestaurant.ReservationAsync(kept.Id);
            Assert.AreEqual(sophie.Id, reservation.ClientId);
            Assert.AreEqual(4, reservation.Covers);
            Assert.AreEqual(ReservationStatus.Finished, reservation.Status);
            await ApiAssert.ErrorAsync(await admin.GetAsync($"api/clients/{sophie.Id}"), HttpStatusCode.NotFound, "NotFound");
            await ApiAssert.ErrorAsync(await admin.DeleteAsync($"api/clients/{sophie.Id}"), HttpStatusCode.NotFound, "NotFound");
        }

        /// <summary>Lance toutes les requêtes en même temps et attend toutes les réponses</summary>
        private static Task<HttpResponseMessage[]> AllAtOnceAsync(IEnumerable<Func<Task<HttpResponseMessage>>> calls) =>
            Task.WhenAll(calls.Select(call => Task.Run(call)));

        [TestMethod]
        public async Task Simultaneous_merges_into_one_client_lose_no_counter_and_no_allergy()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            Client kept = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", email: "s@mail.fr", visits: 1, noShows: 1);
            List<Guid> others = [];
            for (int i = 1; i <= 8; i++)
            {
                Client other = await ClientApi.AddAsync(restaurant.Id, $"Doublon {i}", phone: $"060000000{i}", email: "s@mail.fr",
                    visits: i, noShows: 1, allergies: $"Allergie {i}");
                others.Add(other.Id);
            }

            HttpResponseMessage[] responses = await AllAtOnceAsync(others.Select(otherId =>
                (Func<Task<HttpResponseMessage>>)(() => admin.PostAsync($"api/clients/{kept.Id}/merge/{otherId}", null))));

            Assert.IsTrue(responses.All(r => r.StatusCode == HttpStatusCode.OK), string.Join(", ", responses.Select(r => (int)r.StatusCode)));
            Client stored = (await ClientApi.StoredAsync(kept.Id))!;
            // 1 + (1 + 2 + … + 8) visites, 1 + 8 no-shows : aucune addition perdue
            Assert.AreEqual(37, stored.VisitCount);
            Assert.AreEqual(9, stored.NoShowCount);
            Assert.AreEqual(8, ContactList.Split(stored.Phone).Count);
            for (int i = 1; i <= 8; i++)
            {
                Assert.IsTrue(stored.Allergies!.Contains($"Allergie {i}"), stored.Allergies);
            }
            Assert.AreEqual(0, await TestApi.WithDbAsync(db => db.Clients.CountAsync(c => others.Contains(c.Id))));
        }

        [TestMethod]
        public async Task The_same_merge_sent_several_times_at_once_counts_once()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            Client kept = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", email: "s@mail.fr", visits: 1);
            Client other = await ClientApi.AddAsync(restaurant.Id, "S. Marchand", email: "s@mail.fr", visits: 5, noShows: 2);

            HttpResponseMessage[] responses = await AllAtOnceAsync(Enumerable.Range(0, 5).Select(_ =>
                (Func<Task<HttpResponseMessage>>)(() => admin.PostAsync($"api/clients/{kept.Id}/merge/{other.Id}", null))));

            // Une seule passe ; les autres trouvent la fiche déjà absorbée
            Assert.AreEqual(1, responses.Count(r => r.StatusCode == HttpStatusCode.OK), string.Join(", ", responses.Select(r => (int)r.StatusCode)));
            Assert.AreEqual(4, responses.Count(r => r.StatusCode == HttpStatusCode.NotFound));
            Client stored = (await ClientApi.StoredAsync(kept.Id))!;
            Assert.AreEqual(6, stored.VisitCount);
            Assert.AreEqual(2, stored.NoShowCount);
        }

        [TestMethod]
        public async Task Deleting_or_editing_a_client_while_it_is_merged_never_half_succeeds()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            Client kept = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", email: "s@mail.fr", visits: 1);
            Client other = await ClientApi.AddAsync(restaurant.Id, "S. Marchand", email: "s@mail.fr", visits: 3);

            HttpResponseMessage[] responses = await AllAtOnceAsync([
                () => admin.PostAsync($"api/clients/{kept.Id}/merge/{other.Id}", null),
                () => admin.DeleteAsync($"api/clients/{other.Id}"),
                () => ClientApi.PutAsync(admin, other.Id, ClientApi.Request("S. Marchand", ["0611111111"], ["s@mail.fr"])),
            ]);

            HttpStatusCode[] codes = responses.Select(r => r.StatusCode).ToArray();
            Assert.IsTrue(codes.All(c => c is HttpStatusCode.OK or HttpStatusCode.NoContent or HttpStatusCode.NotFound), string.Join(", ", codes));
            // Fusionnée ou supprimée avant : jamais les deux, et ses visites ne comptent qu'une fois, ou pas du tout
            bool merged = codes[0] == HttpStatusCode.OK;
            Assert.AreNotEqual(merged, codes[1] == HttpStatusCode.NoContent);
            Assert.AreEqual(merged ? 4 : 1, (await ClientApi.StoredAsync(kept.Id))!.VisitCount);
        }
    }
}
