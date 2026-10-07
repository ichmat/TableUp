using TUROAPI.Services;

namespace TUROAPI.Test
{
    /// <summary>La fiche client (§7.2, §7.5) : le téléphone est l'identité, l'API normalise et refuse les doublons</summary>
    [TestClass]
    public sealed class ClientsTests
    {
        [TestMethod]
        public async Task Created_client_is_normalized_and_returned_whole()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();

            ClientResponse created = await ClientApi.CreateAsync(staff, ClientApi.Request(
                name: "  Sophie Marchand ", phones: ["06 12 34 56 78", "+33 7 11 22 33 44", ""], emails: [" S.Marchand@Mail.fr"],
                allergies: "Fruits à coque", notes: "Négocie toujours le dessert", tags: [ClientTag.Regular]));

            Assert.AreEqual("Sophie Marchand", created.Name);
            CollectionAssert.AreEqual(new[] { "0612345678", "0711223344" }, created.Phones);
            CollectionAssert.AreEqual(new[] { "s.marchand@mail.fr" }, created.Emails);
            Assert.AreEqual("Fruits à coque", created.Allergies);
            Assert.AreEqual("Négocie toujours le dessert", created.InternalNotes);
            CollectionAssert.AreEqual(new[] { ClientTag.Regular }, created.Tags);
            Assert.AreEqual(0, created.VisitCount);
            Assert.IsNull(created.AverageCovers);
            Assert.IsFalse(created.AtRisk);
            Assert.AreEqual(0, created.History.Count);
            Client stored = (await ClientApi.StoredAsync(created.Id))!;
            Assert.AreEqual("0612345678;0711223344", stored.Phone);
            Assert.AreEqual(restaurant.Id, stored.RestaurantId);
            Assert.IsTrue(stored.CreatedAt > DateTime.UtcNow.AddMinutes(-1));
        }

        [TestMethod]
        public async Task Client_with_email_only_is_accepted()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();

            ClientResponse created = await ClientApi.CreateAsync(staff, ClientApi.Request(phones: [], emails: ["a@b.fr"]));

            Assert.AreEqual(0, created.Phones.Count);
        }

        [TestMethod]
        [DataRow("", "06 12 34 56 78", "", "name is required")]
        [DataRow("Paul", "", "", "phone number or an e-mail")]
        [DataRow("Paul", "pas de chiffre", "", "phone number or an e-mail")]
        [DataRow("Paul", "", "pas-un-email", "is not a valid e-mail")]
        [DataRow("Paul", "", "a@b.fr;c@d.fr", "is not a valid e-mail")]
        public async Task Invalid_client_is_refused(string name, string phone, string email, string message)
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();

            await ApiAssert.ErrorAsync(await ClientApi.PostAsync(staff, ClientApi.Request(name, [phone], [email])),
                HttpStatusCode.BadRequest, "InvalidRequest", message);

            Assert.AreEqual(0, await TestApi.WithDbAsync(db => db.Clients.CountAsync(c => c.RestaurantId == restaurant.Id)));
        }

        [TestMethod]
        public async Task Oversized_fields_are_refused()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();

            await ApiAssert.ErrorAsync(await ClientApi.PostAsync(staff, ClientApi.Request(name: new string('a', 101))),
                HttpStatusCode.BadRequest, "InvalidRequest", "name");
            await ApiAssert.ErrorAsync(await ClientApi.PostAsync(staff, ClientApi.Request(allergies: new string('a', 501))),
                HttpStatusCode.BadRequest, "InvalidRequest", "allergies");
            await ApiAssert.ErrorAsync(await ClientApi.PostAsync(staff, ClientApi.Request(notes: new string('a', 2001))),
                HttpStatusCode.BadRequest, "InvalidRequest", "internal notes");
            await ApiAssert.ErrorAsync(await ClientApi.PostAsync(staff, ClientApi.Request(phones: [new string('1', 31)])),
                HttpStatusCode.BadRequest, "InvalidRequest", "phone number");
            await ApiAssert.ErrorAsync(await ClientApi.PostAsync(staff, ClientApi.Request(
                phones: ["0600000001", "0600000002", "0600000003", "0600000004", "0600000005", "0600000006"])),
                HttpStatusCode.BadRequest, "InvalidRequest", "at most 5 phone numbers");
        }

        [TestMethod]
        public async Task Same_number_written_otherwise_is_refused_and_names_the_owner()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ClientApi.CreateAsync(staff, ClientApi.Request("Sophie Marchand", ["06.12.34.56.78"]));

            await ApiAssert.ErrorAsync(await ClientApi.PostAsync(staff, ClientApi.Request("Autre", ["+33 6 12 34 56 78"])),
                HttpStatusCode.Conflict, "ClientPhoneTaken", "Sophie Marchand");
        }

        [TestMethod]
        public async Task Number_of_an_anonymized_or_foreign_client_is_free()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            TestRestaurant other = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Client gone = await ClientApi.AddAsync(restaurant.Id, "Parti", phone: "0612345678");
            await TestApi.WithDbAsync(db => db.Clients.Where(c => c.Id == gone.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.AnonymizedAt, DateTime.UtcNow)));
            await ClientApi.AddAsync(other.Id, "Ailleurs", phone: "0612345678");

            await ClientApi.CreateAsync(staff, ClientApi.Request(phones: ["0612345678"]));
        }

        [TestMethod]
        public async Task Update_replaces_the_fields_and_keeping_ones_own_number_is_no_conflict()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            ClientResponse created = await ClientApi.CreateAsync(staff, ClientApi.Request(phones: ["0612345678"]));

            ClientResponse updated = await ApiAssert.OkAsync<ClientResponse>(await ClientApi.PutAsync(staff, created.Id,
                ClientApi.Request("Sophie Marchand-Perrin", ["06 12 34 56 78", "0711223344"], ["s@m.fr"], "Arachide", null, [ClientTag.Vip])));

            Assert.AreEqual("Sophie Marchand-Perrin", updated.Name);
            CollectionAssert.AreEqual(new[] { "0612345678", "0711223344" }, updated.Phones);
            Assert.AreEqual("Arachide", updated.Allergies);
            Assert.IsNull(updated.InternalNotes);
            CollectionAssert.AreEqual(new[] { ClientTag.Vip }, updated.Tags);
        }

        [TestMethod]
        public async Task Merged_client_over_the_limits_can_still_be_saved_but_not_grown()
        {
            // Une fusion peut dépasser 5 numéros ou 2 000 caractères de notes : la fiche doit rester enregistrable
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            string[] phones = Enumerable.Range(1, 8).Select(i => $"060000000{i}").ToArray();
            string notes = new('n', 2500);
            Client merged = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: string.Join(';', phones));
            await TestApi.WithDbAsync(db => db.Clients.Where(c => c.Id == merged.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.InternalNotes, notes)));

            await ApiAssert.OkAsync<ClientResponse>(await ClientApi.PutAsync(staff, merged.Id,
                ClientApi.Request("Sophie Marchand", phones, notes: notes, tags: [ClientTag.Vip])));

            await ApiAssert.ErrorAsync(await ClientApi.PutAsync(staff, merged.Id,
                ClientApi.Request("Sophie Marchand", [.. phones, "0600000009"], notes: notes)),
                HttpStatusCode.BadRequest, "InvalidRequest", "at most 8 phone numbers");
            await ApiAssert.ErrorAsync(await ClientApi.PutAsync(staff, merged.Id,
                ClientApi.Request("Sophie Marchand", phones, notes: notes + "n")),
                HttpStatusCode.BadRequest, "InvalidRequest", "internal notes");
        }

        [TestMethod]
        public async Task Saving_a_stale_form_is_refused_and_keeps_what_another_device_saved()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            ClientResponse opened = await ClientApi.CreateAsync(staff, ClientApi.Request(phones: ["0612345678"]));

            // Un autre poste ajoute l'allergie pendant que le formulaire est ouvert ici
            ClientRequest elsewhere = ClientApi.Request(phones: ["0612345678"], allergies: "Arachide");
            elsewhere.Version = opened.Version;
            await ApiAssert.OkAsync<ClientResponse>(await ClientApi.PutAsync(staff, opened.Id, elsewhere));

            ClientRequest stale = ClientApi.Request(phones: ["0612345678", "0711223344"]);
            stale.Version = opened.Version;
            await ApiAssert.ErrorAsync(await ClientApi.PutAsync(staff, opened.Id, stale), HttpStatusCode.Conflict, "ClientChanged");

            Client stored = (await ClientApi.StoredAsync(opened.Id))!;
            Assert.AreEqual("Arachide", stored.Allergies);
            Assert.AreEqual("0612345678", stored.Phone);
        }

        [TestMethod]
        public async Task Update_without_the_version_read_is_refused()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            ClientResponse opened = await ClientApi.CreateAsync(staff, ClientApi.Request());

            await ApiAssert.ErrorAsync(await staff.PutAsJsonAsync($"api/clients/{opened.Id}", ClientApi.Request(), TestJson.Options),
                HttpStatusCode.BadRequest, "InvalidRequest", "version");
        }

        [TestMethod]
        public async Task Update_cannot_take_another_clients_number()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ClientApi.CreateAsync(staff, ClientApi.Request("Sophie Marchand", ["0612345678"]));
            ClientResponse paul = await ClientApi.CreateAsync(staff, ClientApi.Request("Paul", ["0799999999"]));

            await ApiAssert.ErrorAsync(await ClientApi.PutAsync(staff, paul.Id, ClientApi.Request("Paul", ["0799999999", "06 12 34 56 78"])),
                HttpStatusCode.Conflict, "ClientPhoneTaken", "Sophie Marchand");
        }

        [TestMethod]
        public async Task History_is_newest_first_with_its_place_and_average_covers_count_visits_only()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Client sophie = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0612345678");
            ZoneResponse zone = await PlanApi.AddZoneAsync(restaurant.AdminClient());
            List<ZoneResponse> plan = await PlanApi.SaveAndPublishAsync(restaurant.AdminClient(), new FloorPlanDraftContent
            {
                Tables = [PlanApi.Table(zone.Id, "T6", x: 1), PlanApi.Table(zone.Id, "T12", x: 3), PlanApi.Table(zone.Id, "T13", x: 4.2)],
            });
            List<TableResponse> tables = plan.Single().Tables;
            Reservation upcoming = await restaurant.AddReservationAsync(Dates.Today.AddDays(3), 20, covers: 2, clientId: sophie.Id);
            Reservation finished = await restaurant.AddReservationAsync(Dates.Today.AddDays(-10), 20, covers: 2,
                status: ReservationStatus.Finished, clientId: sophie.Id);
            Reservation grouped = await restaurant.AddReservationAsync(Dates.Today.AddDays(-20), 20, covers: 5,
                status: ReservationStatus.Finished, clientId: sophie.Id);
            Reservation noShow = await restaurant.AddReservationAsync(Dates.Today.AddDays(-30), 20, covers: 4,
                status: ReservationStatus.NoShow, clientId: sophie.Id);
            Guid combinationId = Guid.NewGuid();
            await TestApi.WithDbAsync(async db =>
            {
                db.Combinations.Add(new Combination
                {
                    Id = combinationId, ZoneId = zone.Id, Name = "12-13", Capacity = 8,
                    Tables = [.. db.Tables.Where(t => t.Name == "T12" || t.Name == "T13").Where(t => t.ZoneId == zone.Id)],
                });
                db.Assignments.AddRange(
                    new Assignment { Id = Guid.NewGuid(), ReservationId = upcoming.Id, TableId = tables.Single(t => t.Name == "T6").Id, AssignedAt = DateTime.UtcNow },
                    new Assignment { Id = Guid.NewGuid(), ReservationId = finished.Id, TableId = tables.Single(t => t.Name == "T12").Id, AssignedAt = DateTime.UtcNow.AddDays(-12) },
                    // Déplacée ensuite : c'est la dernière affectation qui compte
                    new Assignment { Id = Guid.NewGuid(), ReservationId = finished.Id, TableId = tables.Single(t => t.Name == "T6").Id, AssignedAt = DateTime.UtcNow.AddDays(-11) },
                    new Assignment { Id = Guid.NewGuid(), ReservationId = grouped.Id, CombinationId = combinationId, AssignedAt = DateTime.UtcNow.AddDays(-21) });
                await db.SaveChangesAsync();
            });

            ClientResponse detail = await ClientApi.GetAsync(staff, sophie.Id);

            CollectionAssert.AreEqual(new[] { upcoming.Id, finished.Id, grouped.Id, noShow.Id }, detail.History.Select(h => h.Id).ToArray());
            CollectionAssert.AreEqual(new[] { "T6", "T6", "12-13", null }, detail.History.Select(h => h.PlaceName).ToArray());
            Assert.AreEqual(ReservationStatus.NoShow, detail.History[3].Status);
            Assert.AreEqual(Dates.Today.AddDays(3), detail.History[0].ServiceDay);
            // Moyenne des visites seules (2 et 5) : ni la réservation à venir, ni le no-show
            Assert.AreEqual(3.5m, detail.AverageCovers);
        }

        [TestMethod]
        public async Task Merge_candidates_share_an_exact_key_never_a_name()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Client sophie = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0612345678", email: "s@mail.fr");
            Client sameEmail = await ClientApi.AddAsync(restaurant.Id, "S. Marchand", phone: "0711223344", email: "s@mail.fr");
            await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0799999999", email: "autre@mail.fr");
            Client gone = await ClientApi.AddAsync(restaurant.Id, "Partie", email: "s@mail.fr");
            await TestApi.WithDbAsync(db => db.Clients.Where(c => c.Id == gone.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.AnonymizedAt, DateTime.UtcNow)));

            ClientResponse detail = await ClientApi.GetAsync(staff, sophie.Id);

            ClientMergeCandidateResponse candidate = detail.MergeCandidates.Single();
            Assert.AreEqual(sameEmail.Id, candidate.Id);
            Assert.AreEqual("S. Marchand", candidate.Name);
            Assert.AreEqual("0711223344", candidate.Phone);
            Assert.AreEqual(ClientSharedKey.Email, candidate.SharedKey);
        }

        [TestMethod]
        public async Task Another_restaurants_or_anonymized_client_is_not_found()
        {
            TestRestaurant a = await TestRestaurant.CreateAsync();
            TestRestaurant b = await TestRestaurant.CreateAsync();
            Client foreign = await ClientApi.AddAsync(a.Id, "Chez A", phone: "0612345678");
            Client gone = await ClientApi.AddAsync(b.Id, "Parti", phone: "0611111111");
            await TestApi.WithDbAsync(db => db.Clients.Where(c => c.Id == gone.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.AnonymizedAt, DateTime.UtcNow)));
            using HttpClient adminB = b.AdminClient();

            await ApiAssert.ErrorAsync(await adminB.GetAsync($"api/clients/{foreign.Id}"), HttpStatusCode.NotFound, "NotFound");
            await ApiAssert.ErrorAsync(await adminB.GetAsync($"api/clients/{gone.Id}"), HttpStatusCode.NotFound, "NotFound");
            await ApiAssert.ErrorAsync(await ClientApi.PutAsync(adminB, foreign.Id, ClientApi.Request(phones: ["0622222222"])),
                HttpStatusCode.NotFound, "NotFound");
            Assert.AreEqual("Chez A", (await ClientApi.StoredAsync(foreign.Id))!.Name);
        }

        [TestMethod]
        public async Task Known_number_attaches_unknown_number_creates_email_is_the_fallback_and_walk_in_creates_nothing()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            Client sophie = await ClientApi.AddAsync(restaurant.Id, "Sophie", phone: "0612345678", email: "s@mail.fr");

            await TestApi.WithDbAsync(async db =>
            {
                Guid id = restaurant.Id;
                Client? byPhone = await ClientIdentity.FindOrCreateAsync(db, id, "S. M.", "+33 6 12 34 56 78", null);
                Client? byEmail = await ClientIdentity.FindOrCreateAsync(db, id, "S. M.", null, "S@Mail.fr");
                Client? created = await ClientIdentity.FindOrCreateAsync(db, id, " Paul ", "07 99 99 99 99", "s@mail.fr");
                Client? walkIn = await ClientIdentity.FindOrCreateAsync(db, id, "Table 4", null, " ");

                Assert.AreEqual(sophie.Id, byPhone!.Id);
                Assert.AreEqual(sophie.Id, byEmail!.Id);
                // Numéro inconnu : une fiche, même si l'e-mail est connu (la fusion sera proposée)
                Assert.AreNotEqual(sophie.Id, created!.Id);
                Assert.AreEqual("Paul", created.Name);
                Assert.AreEqual("0799999999", created.Phone);
                Assert.IsNull(walkIn);
                await db.SaveChangesAsync();
            });

            Assert.AreEqual(2, await TestApi.WithDbAsync(db => db.Clients.CountAsync(c => c.RestaurantId == restaurant.Id)));
        }

        [TestMethod]
        public async Task Writes_notify_the_clients_scope()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await using Screen screen = await Screen.ConnectAsync(restaurant.AdminJwt());

            ClientResponse created = await ClientApi.CreateAsync(staff, ClientApi.Request());
            Assert.AreEqual(DataScope.Clients, await screen.NextAsync());

            await ApiAssert.OkAsync<ClientResponse>(await ClientApi.PutAsync(staff, created.Id, ClientApi.Request("Sophie M.")));
            Assert.AreEqual(DataScope.Clients, await screen.NextAsync());
        }
    }
}
