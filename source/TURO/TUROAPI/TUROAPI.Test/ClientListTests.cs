namespace TUROAPI.Test
{
    /// <summary>La liste (§7.3) : mince, triée par récents, interrogeable au téléphone avant le nom</summary>
    [TestClass]
    public sealed class ClientListTests
    {
        private static string[] Names(ClientPageResponse page) => page.Items.Select(i => i.Name).ToArray();

        [TestMethod]
        public async Task Default_sort_is_most_recent_reservation_then_creation_date()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Client old = await ClientApi.AddAsync(restaurant.Id, "Ancienne", phone: "0600000001", createdAt: DateTime.UtcNow.AddDays(-300));
            Client fresh = await ClientApi.AddAsync(restaurant.Id, "Nouvelle", phone: "0600000002", createdAt: DateTime.UtcNow.AddDays(-1));
            Client upcoming = await ClientApi.AddAsync(restaurant.Id, "Attendue", phone: "0600000003", createdAt: DateTime.UtcNow.AddDays(-400));
            await restaurant.AddReservationAsync(Dates.Today.AddDays(2), 20, clientId: upcoming.Id);
            await restaurant.AddReservationAsync(Dates.Today.AddDays(-5), 20, status: ReservationStatus.Finished, clientId: old.Id);

            ClientPageResponse page = await ClientApi.ListAsync(staff);

            CollectionAssert.AreEqual(new[] { "Attendue", "Nouvelle", "Ancienne" }, Names(page));
            Assert.AreEqual(Dates.Today.AddDays(2), page.Items[0].LastServiceDay);
            Assert.IsNull(page.Items[1].LastServiceDay);
            Assert.AreEqual(Dates.Today.AddDays(-5), page.Items[2].LastServiceDay);
            Assert.AreEqual(3, page.Total);
            Assert.AreEqual(0, page.Page);
            Assert.AreEqual(50, page.PageSize);
        }

        [TestMethod]
        public async Task Name_sort_ignores_case_and_visits_sort_puts_the_most_faithful_first()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ClientApi.AddAsync(restaurant.Id, "bernard", phone: "0600000001", visits: 2);
            await ClientApi.AddAsync(restaurant.Id, "Albert", phone: "0600000002", visits: 41);
            await ClientApi.AddAsync(restaurant.Id, "Claire", phone: "0600000003", visits: 12);

            CollectionAssert.AreEqual(new[] { "Albert", "bernard", "Claire" }, Names(await ClientApi.ListAsync(staff, "?sort=Name")));
            CollectionAssert.AreEqual(new[] { "Albert", "Claire", "bernard" }, Names(await ClientApi.ListAsync(staff, "?sort=Visits")));
        }

        [TestMethod]
        [DataRow("marchand")]
        [DataRow("SOPHIE")]
        [DataRow("06 12 34")]
        [DataRow("06.12.34.56.78")]
        [DataRow("+33 6 12")]
        [DataRow("33 44")]
        public async Task Search_finds_a_name_or_any_number_ignoring_spaces_and_dots(string search)
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0612345678;0711223344");
            await ClientApi.AddAsync(restaurant.Id, "Paul Lefebvre", phone: "0799999999");

            ClientPageResponse page = await ClientApi.ListAsync(staff, $"?search={Uri.EscapeDataString(search)}");

            CollectionAssert.AreEqual(new[] { "Sophie Marchand" }, Names(page));
            Assert.AreEqual(1, page.Total);
        }

        [TestMethod]
        public async Task With_phone_keeps_only_the_clients_who_can_be_called_back()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0612345678");
            await ClientApi.AddAsync(restaurant.Id, "Marchal", phone: null);

            // Filtré par l'API et non après coup : une page de suggestions reste pleine
            CollectionAssert.AreEqual(new[] { "Sophie Marchand" }, Names(await ClientApi.ListAsync(staff, "?search=march&withPhone=true")));
            Assert.AreEqual(2, (await ClientApi.ListAsync(staff, "?search=march")).Total);
        }

        [TestMethod]
        public async Task Search_treats_percent_and_underscore_literally()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ClientApi.AddAsync(restaurant.Id, "Paul Lefebvre", phone: "0799999999");

            Assert.AreEqual(0, (await ClientApi.ListAsync(staff, "?search=%25")).Total);
            Assert.AreEqual(0, (await ClientApi.ListAsync(staff, "?search=_")).Total);
        }

        [TestMethod]
        public async Task Tag_and_risk_filters_narrow_the_list()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ClientApi.AddAsync(restaurant.Id, "Fidèle", phone: "0600000001", visits: 41, noShows: 2, tags: [ClientTag.Regular]);
            await ClientApi.AddAsync(restaurant.Id, "Oublieux", phone: "0600000002", visits: 3, noShows: 2, tags: [ClientTag.Watch]);
            await ClientApi.AddAsync(restaurant.Id, "Presse", phone: "0600000003", tags: [ClientTag.Press]);

            CollectionAssert.AreEqual(new[] { "Oublieux" }, Names(await ClientApi.ListAsync(staff, "?atRisk=true")));
            CollectionAssert.AreEqual(new[] { "Fidèle" }, Names(await ClientApi.ListAsync(staff, "?tag=Regular")));
            ClientPageResponse all = await ClientApi.ListAsync(staff, "?sort=Name");
            Assert.IsFalse(all.Items.Single(i => i.Name == "Fidèle").AtRisk);
            Assert.IsTrue(all.Items.Single(i => i.Name == "Oublieux").AtRisk);
        }

        [TestMethod]
        public async Task List_item_carries_the_main_phone_and_the_allergy_mark()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ClientApi.AddAsync(restaurant.Id, "Sophie", phone: "0612345678;0711223344", allergies: "Arachide", tags: [ClientTag.Vip]);

            ClientListItemResponse item = (await ClientApi.ListAsync(staff)).Items.Single();

            Assert.AreEqual("0612345678", item.Phone);
            Assert.IsTrue(item.HasAllergy);
            CollectionAssert.AreEqual(new[] { ClientTag.Vip }, item.Tags);
        }

        [TestMethod]
        public async Task Pages_cut_the_list_and_keep_the_total()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            for (int i = 0; i < 5; i++)
            {
                await ClientApi.AddAsync(restaurant.Id, $"Client {i}", phone: $"060000000{i}");
            }

            ClientPageResponse second = await ClientApi.ListAsync(staff, "?sort=Name&page=1&pageSize=2");

            CollectionAssert.AreEqual(new[] { "Client 2", "Client 3" }, Names(second));
            Assert.AreEqual(5, second.Total);
        }

        [TestMethod]
        [DataRow("?pageSize=0")]
        [DataRow("?pageSize=501")]
        [DataRow("?page=-1")]
        [DataRow("?sort=Banane")]
        public async Task Out_of_bounds_paging_or_unknown_sort_is_refused(string query)
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();

            await ApiAssert.ErrorAsync(await staff.GetAsync($"api/clients{query}"), HttpStatusCode.BadRequest, "InvalidRequest");
        }

        [TestMethod]
        public async Task Anonymized_and_foreign_clients_are_never_listed()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            TestRestaurant other = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ClientApi.AddAsync(restaurant.Id, "Présente", phone: "0600000001");
            Client gone = await ClientApi.AddAsync(restaurant.Id, "Partie", phone: "0600000002");
            await TestApi.WithDbAsync(db => db.Clients.Where(c => c.Id == gone.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.AnonymizedAt, DateTime.UtcNow)));
            await ClientApi.AddAsync(other.Id, "Ailleurs", phone: "0600000003");

            CollectionAssert.AreEqual(new[] { "Présente" }, Names(await ClientApi.ListAsync(staff)));
        }

        [TestMethod]
        public async Task Exact_phone_finds_only_the_whole_number_whatever_its_writing()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Client sophie = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0699999999;0612345678", allergies: "Fruits à coque");
            await ClientApi.AddAsync(restaurant.Id, "Autre", phone: "0612345679");

            ClientPageResponse found = await ClientApi.ListAsync(staff, "?phone=%2B33%206%2012%2034%2056%2078");
            ClientPageResponse fragment = await ClientApi.ListAsync(staff, "?phone=06%2012%2034");
            ClientPageResponse unreadable = await ClientApi.ListAsync(staff, "?phone=abc");

            // Le formulaire de réservation reconnaît un client au numéro entier, jamais à un morceau (§8.5)
            Assert.AreEqual(sophie.Id, found.Items.Single().Id);
            Assert.AreEqual("Fruits à coque", found.Items.Single().Allergies);
            Assert.AreEqual(0, fragment.Items.Count);
            Assert.AreEqual(0, unreadable.Items.Count);
        }
    }
}
