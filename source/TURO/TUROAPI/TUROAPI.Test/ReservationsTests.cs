namespace TUROAPI.Test
{
    /// <summary>Créer une réservation (§8), lire sa fiche (§6.5), et les créneaux d'un jour</summary>
    [TestClass]
    public sealed class ReservationsTests
    {
        [TestMethod]
        public async Task Creating_books_a_confirmed_reservation_at_the_local_time_with_the_service_duration()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            DateOnly day = ReservationApi.Saturday;
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23, duration: 105);

            ReservationActionResponse created = await ReservationApi.CreateAsync(staff, ReservationApi.Request(day, 20, note: "  anniversaire  "));

            ReservationResponse reservation = created.Reservation;
            Assert.AreEqual(Dates.ToUtc(day, new TimeOnly(20, 0)), reservation.Start);
            Assert.AreEqual(day, reservation.ServiceDay);
            Assert.AreEqual(105, reservation.Duration);
            Assert.AreEqual(4, reservation.Covers);
            Assert.AreEqual(ReservationStatus.Confirmed, reservation.Status);
            Assert.AreEqual(ReservationSource.Phone, reservation.Source);
            Assert.AreEqual("anniversaire", reservation.Note);
            Assert.IsNull(reservation.Place);
            ReservationEventResponse creation = reservation.Events.Single();
            Assert.AreEqual(created.EventId, creation.Id);
            Assert.AreEqual(EventType.Creation, creation.Type);
            Assert.AreEqual("téléphone", creation.Details);
            Assert.AreEqual(restaurant.Staff.Login, creation.AuthorLogin);
            Assert.AreEqual(reservation.Id, (await ReservationApi.GetAsync(staff, reservation.Id)).Id);
        }

        [TestMethod]
        public async Task Duration_falls_back_to_the_restaurant_rotation_and_can_be_chosen()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);

            ReservationActionResponse byDefault = await ReservationApi.CreateAsync(staff, ReservationApi.Request());
            ReservationActionResponse chosen = await ReservationApi.CreateAsync(staff, ReservationApi.Request(duration: 150, phone: "06 98 76 54 32"));

            Assert.AreEqual(120, byDefault.Reservation.Duration);
            Assert.AreEqual(150, chosen.Reservation.Duration);
        }

        [TestMethod]
        public async Task A_late_meal_after_midnight_belongs_to_the_evening_service()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            DateOnly day = ReservationApi.Saturday;
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 22, 2);

            ReservationActionResponse created = await ReservationApi.CreateAsync(staff, ReservationApi.Request(day, 0, 30));

            Assert.AreEqual(Dates.ToUtc(day.AddDays(1), new TimeOnly(0, 30)), created.Reservation.Start);
            Assert.AreEqual(day, created.Reservation.ServiceDay);
        }

        [TestMethod]
        public async Task After_midnight_the_service_still_running_since_yesterday_can_be_booked_and_counts_as_today()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            DateTime local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(Dates.TimeZoneId));
            if (local.Hour >= 22)
            {
                Assert.Inconclusive("La plage d'hier doit passer minuit et contenir maintenant : impossible après 22 h");
            }
            DateOnly yesterday = Dates.Today.AddDays(-1);
            // Comme à 00:20 le dimanche, le dîner du samedi (hier, jusqu'à h+1 aujourd'hui) est encore en cours
            await ReservationApi.AddServiceAsync(restaurant.Id, yesterday.DayOfWeek, local.Hour + 2, local.Hour + 1);

            ReservationActionResponse created = await ReservationApi.CreateAsync(staff, ReservationApi.Request(yesterday, local.Hour));

            Assert.AreEqual(yesterday, created.Reservation.ServiceDay);
            Assert.AreEqual(Dates.ToUtc(Dates.Today, new TimeOnly(local.Hour, 0)), created.Reservation.Start);
            // « Aujourd'hui » est le jour du service en cours, pas la date du calendrier
            ReservationPageResponse today = await ReservationApi.ListAsync(staff, "?period=Today");
            Assert.AreEqual(yesterday, today.Days.Single().ServiceDay);
        }

        [TestMethod]
        public async Task Closed_days_past_days_and_hours_outside_service_are_refused()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            DateOnly day = ReservationApi.Saturday;
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);
            await ReservationApi.AddClosureAsync(restaurant.Id, day.AddDays(7));
            await ReservationApi.AddClosureAsync(restaurant.Id, day.AddDays(14), (12, 15));

            await ApiAssert.ErrorAsync(await ReservationApi.PostAsync(staff, ReservationApi.Request(day, 15)),
                HttpStatusCode.BadRequest, "OutsideService");
            // La fermeture n'ouvre pas de créneau
            await ApiAssert.ErrorAsync(await ReservationApi.PostAsync(staff, ReservationApi.Request(day, 23)),
                HttpStatusCode.BadRequest, "OutsideService");
            await ApiAssert.ErrorAsync(await ReservationApi.PostAsync(staff, ReservationApi.Request(Dates.Previous(DayOfWeek.Saturday), 20)),
                HttpStatusCode.BadRequest, "OutsideService", "past");
            await ApiAssert.ErrorAsync(await ReservationApi.PostAsync(staff, ReservationApi.Request(day.AddDays(7), 20)),
                HttpStatusCode.BadRequest, "OutsideService");
            // Horaires modifiés : le service habituel n'existe plus ce jour-là, la plage de remplacement si
            await ApiAssert.ErrorAsync(await ReservationApi.PostAsync(staff, ReservationApi.Request(day.AddDays(14), 20)),
                HttpStatusCode.BadRequest, "OutsideService");
            ReservationActionResponse lunch = await ReservationApi.CreateAsync(staff, ReservationApi.Request(day.AddDays(14), 12, 30));

            Assert.AreEqual(120, lunch.Reservation.Duration);
            Assert.AreEqual(1, await TestApi.WithDbAsync(db => db.Reservations.CountAsync(r => r.RestaurantId == restaurant.Id)));
        }

        [TestMethod]
        public async Task Every_field_is_checked_before_anything_is_written()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);
            (ReservationRequest Request, string Part)[] cases =
            [
                (ReservationApi.Request(phone: null), "phone"),
                (ReservationApi.Request(phone: "abc"), "phone"),
                (ReservationApi.Request(name: "  "), "name"),
                (ReservationApi.Request(name: new string('a', 101)), "name"),
                (ReservationApi.Request(covers: 0), "covers"),
                (ReservationApi.Request(covers: 100), "covers"),
                (ReservationApi.Request(duration: 10), "duration"),
                (ReservationApi.Request(note: new string('n', 501)), "note"),
                (ReservationApi.Request(source: ReservationSource.Web), "source"),
                (ReservationApi.Request(email: "pas-un-mail"), "e-mail"),
                (ReservationApi.Request(zoneId: Guid.NewGuid()), "zone"),
            ];

            foreach ((ReservationRequest request, string part) in cases)
            {
                await ApiAssert.ErrorAsync(await ReservationApi.PostAsync(staff, request), HttpStatusCode.BadRequest, "InvalidRequest", part);
            }
            Assert.AreEqual(0, await TestApi.WithDbAsync(db => db.Reservations.CountAsync(r => r.RestaurantId == restaurant.Id)));
            Assert.AreEqual(0, await TestApi.WithDbAsync(db => db.Clients.CountAsync(c => c.RestaurantId == restaurant.Id)));
        }

        [TestMethod]
        public async Task A_known_number_attaches_its_client_whatever_name_is_typed()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);
            Client sophie = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0612345678", allergies: "Fruits à coque");

            ReservationActionResponse created = await ReservationApi.CreateAsync(staff,
                ReservationApi.Request(phone: "+33 6 12 34 56 78", name: "Sophie"));

            Assert.AreEqual(sophie.Id, created.Reservation.Client!.Id);
            Assert.AreEqual("Sophie Marchand", created.Reservation.Client.Name);
            Assert.AreEqual("Fruits à coque", created.Reservation.Client.Allergies);
            Assert.AreEqual(1, await TestApi.WithDbAsync(db => db.Clients.CountAsync(c => c.RestaurantId == restaurant.Id)));
        }

        [TestMethod]
        public async Task Two_callers_giving_only_julien_get_two_clients()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);

            ReservationActionResponse first = await ReservationApi.CreateAsync(staff, ReservationApi.Request(phone: "06 11 11 11 11", name: "Julien"));
            ReservationActionResponse second = await ReservationApi.CreateAsync(staff, ReservationApi.Request(phone: "06 22 22 22 22", name: "Julien"));

            // Le nom n'est jamais une clé : seul le numéro identifie
            Assert.AreNotEqual(first.Reservation.Client!.Id, second.Reservation.Client!.Id);
            Assert.AreEqual(2, (await ClientApi.ListAsync(staff, "?search=Julien")).Items.Count);
        }

        [TestMethod]
        public async Task An_unknown_number_creates_the_client_and_both_lists_reload()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);
            await using Screen screen = await Screen.ConnectAsync(restaurant.StaffJwt());

            ReservationActionResponse created = await ReservationApi.CreateAsync(staff,
                ReservationApi.Request(phone: "07 00 00 00 01", name: "Léa", email: "Lea@Mail.fr"));

            Client stored = (await ClientApi.StoredAsync(created.Reservation.Client!.Id))!;
            Assert.AreEqual("Léa", stored.Name);
            Assert.AreEqual("0700000001", stored.Phone);
            Assert.AreEqual("lea@mail.fr", stored.Email);
            Assert.AreEqual(DataScope.Reservations, await screen.NextAsync());
            Assert.AreEqual(DataScope.Clients, await screen.NextAsync());
        }

        [TestMethod]
        public async Task Booking_modifying_and_undoing_for_a_known_client_reload_the_client_screens()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);
            await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0612345678");
            await using Screen screen = await Screen.ConnectAsync(restaurant.StaffJwt());

            ReservationActionResponse created = await ReservationApi.CreateAsync(staff, ReservationApi.Request());
            Assert.AreEqual(DataScope.Reservations, await screen.NextAsync());
            Assert.AreEqual(DataScope.Clients, await screen.NextAsync());

            HttpResponseMessage modified = await ReservationApi.PutAsync(staff, created.Reservation.Id, ReservationApi.Request(hour: 21));
            Assert.AreEqual(HttpStatusCode.OK, modified.StatusCode, await modified.Content.ReadAsStringAsync());
            Assert.AreEqual(DataScope.Reservations, await screen.NextAsync());
            Assert.AreEqual(DataScope.Clients, await screen.NextAsync());

            ReservationActionResponse modification = (await modified.Content.ReadFromJsonAsync<ReservationActionResponse>(TestJson.Options))!;
            await ReservationApi.UndoAsync(staff, created.Reservation.Id, modification.EventId!.Value);
            Assert.AreEqual(DataScope.Reservations, await screen.NextAsync());
            Assert.AreEqual(DataScope.Clients, await screen.NextAsync());
            Assert.IsFalse(screen.TryNext(out _));
        }

        [TestMethod]
        public async Task A_client_cannot_hold_two_reservations_that_overlap()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);
            ReservationActionResponse first = await ReservationApi.CreateAsync(staff, ReservationApi.Request(hour: 20, duration: 120));

            // 21:00 tombe pendant 20:00–22:00 ; le nom saisi n'y change rien, seul le numéro identifie
            await ApiAssert.ErrorAsync(await ReservationApi.PostAsync(staff, ReservationApi.Request(hour: 21, duration: 120, name: "Sophie")),
                HttpStatusCode.Conflict, "ClientAlreadyBooked");
            // Bout à bout : 22:00 commence quand la première finit
            await ReservationApi.CreateAsync(staff, ReservationApi.Request(hour: 22, duration: 60));
            // Une réservation annulée ne retient plus le créneau
            await ReservationApi.DoAsync(staff, first.Reservation.Id, "cancel");
            await ReservationApi.CreateAsync(staff, ReservationApi.Request(hour: 20, duration: 120));
            // Un autre client, au même moment : rien à voir
            await ReservationApi.CreateAsync(staff, ReservationApi.Request(hour: 20, duration: 120, phone: "06 99 99 99 99", name: "Paul"));
        }

        [TestMethod]
        public async Task The_sheet_carries_the_client_band_the_place_and_the_no_show_threshold()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Terrasse", ("T2", 2));
            Client sophie = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0612345678", visits: 3, noShows: 2,
                allergies: "Fruits à coque", tags: [ClientTag.Regular]);
            await restaurant.AddReservationAsync(Dates.Today.AddDays(-10), 20, status: ReservationStatus.Finished, clientId: sophie.Id);
            await restaurant.AddReservationAsync(Dates.Today.AddDays(-3), 20, status: ReservationStatus.NoShow, clientId: sophie.Id);
            Reservation upcoming = await restaurant.AddReservationAsync(ReservationApi.Saturday, 20, covers: 4, clientId: sophie.Id, preferredZoneId: zoneId);
            await ReservationApi.AssignAsync(upcoming.Id, tableId: tables[0].Id);

            ReservationResponse sheet = await ReservationApi.GetAsync(staff, upcoming.Id);

            Assert.AreEqual("T2", sheet.Place!.Name);
            Assert.AreEqual(2, sheet.Place.Capacity);
            // FICHE-06 : 4 couverts sur une table de 2, signalé sans rien déplacer
            Assert.IsTrue(sheet.PlaceTooSmall);
            Assert.AreEqual(upcoming.Start.AddMinutes(15), sheet.NoShowFrom);
            Assert.AreEqual("Terrasse", sheet.PreferredZoneName);
            Assert.AreEqual("Sophie Marchand", sheet.Client!.Name);
            Assert.AreEqual("0612345678", sheet.Client.Phone);
            Assert.AreEqual("Fruits à coque", sheet.Client.Allergies);
            CollectionAssert.AreEqual(new[] { ClientTag.Regular }, sheet.Client.Tags);
            Assert.AreEqual(3, sheet.Client.VisitCount);
            Assert.AreEqual(2, sheet.Client.NoShowCount);
            Assert.IsTrue(sheet.Client.AtRisk);
            // La visite la plus récente, pas le no-show plus récent
            Assert.AreEqual(Dates.Today.AddDays(-10), sheet.Client.LastVisitDay);
            Assert.AreNotEqual(0u, sheet.Version);
        }

        [TestMethod]
        public async Task Another_restaurant_reservation_does_not_exist()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            TestRestaurant other = await TestRestaurant.CreateAsync();
            Reservation theirs = await other.AddReservationAsync(ReservationApi.Saturday, 20);
            using HttpClient staff = restaurant.StaffClient();

            await ApiAssert.ErrorAsync(await staff.GetAsync($"api/reservations/{theirs.Id}"), HttpStatusCode.NotFound, "NotFound");
        }

        [TestMethod]
        public async Task Slots_follow_services_closures_and_midnight()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            DateOnly day = ReservationApi.Saturday;
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 21, duration: 105);
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 23, 1);
            await ReservationApi.AddClosureAsync(restaurant.Id, day.AddDays(7));
            await ReservationApi.AddClosureAsync(restaurant.Id, day.AddDays(14), (12, 15));

            async Task<List<ServiceWindowResponse>> SlotsAsync(DateOnly date) =>
                await ApiAssert.OkAsync<List<ServiceWindowResponse>>(await staff.GetAsync($"api/reservations/slots?day={date:yyyy-MM-dd}"));

            List<ServiceWindowResponse> normal = await SlotsAsync(day);
            Assert.AreEqual(2, normal.Count);
            CollectionAssert.AreEqual(new[] { new TimeOnly(19, 0), new TimeOnly(19, 30), new TimeOnly(20, 0), new TimeOnly(20, 30) }, normal[0].Slots);
            Assert.AreEqual(105, normal[0].Duration);
            CollectionAssert.AreEqual(new[] { new TimeOnly(23, 0), new TimeOnly(23, 30), new TimeOnly(0, 0), new TimeOnly(0, 30) }, normal[1].Slots);
            Assert.AreEqual(120, normal[1].Duration);
            Assert.AreEqual(0, (await SlotsAsync(day.AddDays(7))).Count);
            ServiceWindowResponse replacement = (await SlotsAsync(day.AddDays(14))).Single();
            Assert.AreEqual(new TimeOnly(12, 0), replacement.Opening);
            Assert.AreEqual(6, replacement.Slots.Count);
        }
    }
}
