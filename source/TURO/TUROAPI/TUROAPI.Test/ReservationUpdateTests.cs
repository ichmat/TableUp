using System.Globalization;

namespace TUROAPI.Test
{
    /// <summary>Modifier une réservation (§13 tranché) : le formulaire réutilisé, l'identité jamais touchée, la table jamais déplacée</summary>
    [TestClass]
    public sealed class ReservationUpdateTests
    {
        private static readonly CultureInfo French = CultureInfo.GetCultureInfo("fr-FR");

        /// <summary>La requête qui ne change rien : jour, heure, couverts, durée, note et salle tels qu'enregistrés</summary>
        private static ReservationRequest Same(ReservationResponse r) => new()
        {
            ServiceDay = r.ServiceDay,
            Time = TimeOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(r.Start, TimeZoneInfo.FindSystemTimeZoneById(Dates.TimeZoneId))),
            Covers = r.Covers,
            Duration = r.Duration,
            Note = r.Note,
            PreferredZoneId = r.PreferredZoneId,
        };

        [TestMethod]
        public async Task Modifying_moves_the_reservation_and_writes_what_changed()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);
            (Guid salle, _) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle");
            DateOnly day = ReservationApi.Saturday;
            ReservationResponse created = (await ReservationApi.CreateAsync(staff, ReservationApi.Request(day, 20))).Reservation;

            ReservationRequest change = Same(created);
            change.ServiceDay = day.AddDays(7);
            change.Time = new TimeOnly(20, 30);
            change.Covers = 6;
            change.Duration = 150;
            change.Note = "anniversaire";
            change.PreferredZoneId = salle;
            change.Phone = "07 99 99 99 99";
            change.Name = "Quelqu'un d'autre";
            ReservationActionResponse updated = await ApiAssert.OkAsync<ReservationActionResponse>(
                await ReservationApi.PutAsync(staff, created.Id, change));

            ReservationResponse r = updated.Reservation;
            Assert.AreEqual(Dates.ToUtc(day.AddDays(7), new TimeOnly(20, 30)), r.Start);
            Assert.AreEqual(day.AddDays(7), r.ServiceDay);
            Assert.AreEqual(6, r.Covers);
            Assert.AreEqual(150, r.Duration);
            Assert.AreEqual("anniversaire", r.Note);
            Assert.AreEqual("Salle", r.PreferredZoneName);
            // L'identité se modifie depuis la fiche client, jamais d'ici
            Assert.AreEqual(created.Client!.Id, r.Client!.Id);
            Assert.AreEqual("Sophie Marchand", r.Client.Name);
            ReservationEventResponse line = r.Events.Last();
            Assert.AreEqual(updated.EventId, line.Id);
            Assert.AreEqual(EventType.Modification, line.Type);
            Assert.AreEqual(
                $"{day.ToString("ddd dd/MM", French)} → {day.AddDays(7).ToString("ddd dd/MM", French)} · 20:00 → 20:30 · 4 → 6 couverts · durée 2 h → 2 h 30 · salle : indifférent → Salle · commentaire modifié",
                line.Details);
        }

        [TestMethod]
        public async Task Nothing_changed_writes_no_journal_line()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);
            ReservationResponse created = (await ReservationApi.CreateAsync(staff, ReservationApi.Request())).Reservation;

            ReservationActionResponse same = await ApiAssert.OkAsync<ReservationActionResponse>(
                await ReservationApi.PutAsync(staff, created.Id, Same(created)));

            Assert.IsNull(same.EventId);
            Assert.AreEqual(1, same.Reservation.Events.Count);
        }

        [TestMethod]
        public async Task The_version_is_required_and_a_stale_form_is_refused()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);
            Reservation request = await restaurant.AddReservationAsync(ReservationApi.Saturday, 20, status: ReservationStatus.Pending);
            ReservationResponse opened = await ReservationApi.GetAsync(staff, request.Id);

            ReservationRequest noVersion = Same(opened);
            noVersion.Version = null;
            await ApiAssert.ErrorAsync(await staff.PutAsJsonAsync($"api/reservations/{request.Id}", noVersion, TestJson.Options),
                HttpStatusCode.BadRequest, "InvalidRequest", "version");
            // Un autre poste accepte la demande pendant que le formulaire est ouvert
            await ReservationApi.DoAsync(staff, request.Id, "accept");
            ReservationRequest stale = Same(opened);
            stale.Covers = 6;
            stale.Version = opened.Version;
            await ApiAssert.ErrorAsync(await ReservationApi.PutAsync(staff, request.Id, stale), HttpStatusCode.Conflict, "ReservationChanged");

            Assert.AreEqual(2, (await ReservationApi.StoredAsync(request.Id)).Covers);
        }

        [TestMethod]
        public async Task A_seated_table_keeps_its_day_and_time_and_a_closed_one_cannot_change()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.OpenEveryEveningAsync(restaurant.Id);
            Reservation seated = await restaurant.AddReservationAsync(Dates.Today, 20, covers: 4, status: ReservationStatus.Seated);
            Reservation finished = await restaurant.AddReservationAsync(Dates.Today, 19, status: ReservationStatus.Finished);
            ReservationResponse sheet = await ReservationApi.GetAsync(staff, seated.Id);

            // « Ajouter un couvert » sur une table assise
            ReservationRequest oneMore = Same(sheet);
            oneMore.Covers = 5;
            Assert.AreEqual(5, (await ApiAssert.OkAsync<ReservationActionResponse>(await ReservationApi.PutAsync(staff, seated.Id, oneMore))).Reservation.Covers);
            ReservationRequest later = Same(await ReservationApi.GetAsync(staff, seated.Id));
            later.Time = new TimeOnly(21, 0);
            await ApiAssert.ErrorAsync(await ReservationApi.PutAsync(staff, seated.Id, later),
                HttpStatusCode.Conflict, "ReservationActionNotAllowed", "seated");
            await ApiAssert.ErrorAsync(await ReservationApi.PutAsync(staff, finished.Id, Same(await ReservationApi.GetAsync(staff, finished.Id))),
                HttpStatusCode.Conflict, "ReservationActionNotAllowed", "closed");
        }

        [TestMethod]
        public async Task More_covers_than_the_table_keeps_the_table_and_says_so()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);
            (_, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("T12", 4));
            Reservation reservation = await restaurant.AddReservationAsync(ReservationApi.Saturday, 20, covers: 4);
            await ReservationApi.AssignAsync(reservation.Id, tableId: tables[0].Id);

            ReservationRequest six = Same(await ReservationApi.GetAsync(staff, reservation.Id));
            six.Covers = 6;
            ReservationResponse updated = (await ApiAssert.OkAsync<ReservationActionResponse>(
                await ReservationApi.PutAsync(staff, reservation.Id, six))).Reservation;

            // FICHE-06 : rien n'est déplacé ni libéré en silence
            Assert.AreEqual("T12", updated.Place!.Name);
            Assert.IsTrue(updated.PlaceTooSmall);
        }

        [TestMethod]
        public async Task Moving_outside_the_opening_hours_is_refused_and_changes_nothing()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);
            ReservationResponse created = (await ReservationApi.CreateAsync(staff, ReservationApi.Request())).Reservation;

            ReservationRequest lunch = Same(created);
            lunch.Time = new TimeOnly(12, 0);
            lunch.Covers = 2;
            await ApiAssert.ErrorAsync(await ReservationApi.PutAsync(staff, created.Id, lunch), HttpStatusCode.BadRequest, "OutsideService");

            Reservation stored = await ReservationApi.StoredAsync(created.Id);
            Assert.AreEqual(created.Start, stored.Start);
            Assert.AreEqual(4, stored.Covers);
        }
    }
}
