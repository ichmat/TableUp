using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Caching.Memory;
using TUROAPI.Services;

namespace TUROAPI.Test
{
    /// <summary>Le cache d'annulation : l'état d'avant d'un geste, en mémoire seulement, pour un seul usage</summary>
    [TestClass]
    public sealed class ReservationUndoTests
    {
        [TestMethod]
        public void A_remembered_action_is_found_until_forgotten()
        {
            var undo = new ReservationUndo(new MemoryCache(new MemoryCacheOptions()));
            Guid eventId = Guid.NewGuid();
            var entry = new UndoEntry(Guid.NewGuid(), Guid.NewGuid(), UndoKind.Creation) { CreatedClientId = Guid.NewGuid() };

            undo.Remember(eventId, entry);

            Assert.AreEqual(entry, undo.Find(eventId));
            Assert.IsNull(undo.Find(Guid.NewGuid()));
            undo.Forget(eventId);
            Assert.IsNull(undo.Find(eventId));
        }

        [TestMethod]
        public void The_undo_window_outlasts_the_eight_second_banner()
        {
            Assert.AreEqual(TimeSpan.FromSeconds(30), ReservationUndo.Window);
        }

        [TestMethod]
        public void State_and_values_go_back_onto_the_reservation()
        {
            var reservation = new Reservation
            {
                Status = ReservationStatus.Seated, SeatedAt = DateTime.UtcNow, ServiceDay = new DateOnly(2026, 10, 10),
                Start = DateTime.UtcNow, Covers = 4, Duration = 105, Note = "fenêtre", PreferredZoneId = Guid.NewGuid(),
            };
            ReservationState state = ReservationState.Of(reservation);
            ReservationValues values = ReservationValues.Of(reservation);

            reservation.Status = ReservationStatus.Finished;
            reservation.FinishedAt = DateTime.UtcNow;
            reservation.Covers = 6;
            reservation.Note = null;
            state.ApplyTo(reservation);
            values.ApplyTo(reservation);

            Assert.AreEqual(ReservationStatus.Seated, reservation.Status);
            Assert.IsNull(reservation.FinishedAt);
            Assert.AreEqual(4, reservation.Covers);
            Assert.AreEqual("fenêtre", reservation.Note);
        }

        private static ReservationUndo Cache => TestApi.Factory.Services.GetRequiredService<ReservationUndo>();

        /// <summary>Lance toutes les requêtes en même temps et attend toutes les réponses</summary>
        private static Task<HttpResponseMessage[]> AllAtOnceAsync(IEnumerable<Func<Task<HttpResponseMessage>>> calls) =>
            Task.WhenAll(calls.Select(call => Task.Run(call)));

        [TestMethod]
        public async Task Undoing_a_creation_removes_the_reservation_and_the_client_born_with_it()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);
            ReservationActionResponse created = await ReservationApi.CreateAsync(staff, ReservationApi.Request(phone: "07 00 00 00 02", name: "Léa"));
            await using Screen screen = await Screen.ConnectAsync(restaurant.StaffJwt());

            HttpResponseMessage undone = await ReservationApi.UndoAsync(staff, created.Reservation.Id, created.EventId!.Value);

            Assert.AreEqual(HttpStatusCode.NoContent, undone.StatusCode, await undone.Content.ReadAsStringAsync());
            Assert.AreEqual(0, await TestApi.WithDbAsync(db => db.Reservations.CountAsync(r => r.Id == created.Reservation.Id)));
            Assert.AreEqual(0, await TestApi.WithDbAsync(db => db.EventLogs.CountAsync(e => e.ReservationId == created.Reservation.Id)));
            Assert.IsNull(await ClientApi.StoredAsync(created.Reservation.Client!.Id));
            Assert.AreEqual(DataScope.Reservations, await screen.NextAsync());
            Assert.AreEqual(DataScope.Clients, await screen.NextAsync());
        }

        [TestMethod]
        public async Task Undoing_a_creation_keeps_a_client_that_existed_before()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);
            Client sophie = await ClientApi.AddAsync(restaurant.Id, "Sophie Marchand", phone: "0612345678");
            ReservationActionResponse created = await ReservationApi.CreateAsync(staff, ReservationApi.Request());

            Assert.AreEqual(HttpStatusCode.NoContent,
                (await ReservationApi.UndoAsync(staff, created.Reservation.Id, created.EventId!.Value)).StatusCode);
            Assert.IsNotNull(await ClientApi.StoredAsync(sophie.Id));
        }

        [TestMethod]
        public async Task Undoing_a_gesture_restores_status_counters_tables_and_erases_its_line()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (Guid zoneId, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("T12", 4), ("T13", 4));
            Guid combination = await ReservationApi.AddCombinationAsync(zoneId, "12-13", 8, tables[0].Id, tables[1].Id);
            Client roux = await ClientApi.AddAsync(restaurant.Id, "Roux", phone: "0611111111", visits: 4);
            Reservation group = await restaurant.AddReservationAsync(Dates.Today, 20, covers: 8, status: ReservationStatus.Seated, clientId: roux.Id);
            await ReservationApi.AssignAsync(group.Id, combinationId: combination);
            Reservation late = await restaurant.AddReservationAsync(Dates.Today.AddDays(-1), 20, clientId: roux.Id);

            ReservationActionResponse released = await ReservationApi.DoAsync(staff, group.Id, "release");
            ReservationActionResponse noShow = await ReservationApi.DoAsync(staff, late.Id, "no-show");
            ReservationResponse seatedAgain = await ApiAssert.OkAsync<ReservationResponse>(
                await ReservationApi.UndoAsync(staff, group.Id, released.EventId!.Value));
            ReservationResponse confirmedAgain = await ApiAssert.OkAsync<ReservationResponse>(
                await ReservationApi.UndoAsync(staff, late.Id, noShow.EventId!.Value));

            Assert.AreEqual(ReservationStatus.Seated, seatedAgain.Status);
            Assert.IsNull((await ReservationApi.StoredAsync(group.Id)).FinishedAt);
            Assert.IsTrue(await TestApi.WithDbAsync(db => db.Tables.Where(t => t.ZoneId == zoneId).AllAsync(t => t.NeedsCleaningSince == null)));
            Assert.AreEqual(0, seatedAgain.Events.Count);
            Assert.AreEqual(ReservationStatus.Confirmed, confirmedAgain.Status);
            Client stored = (await ClientApi.StoredAsync(roux.Id))!;
            Assert.AreEqual(4, stored.VisitCount);
            Assert.AreEqual(0, stored.NoShowCount);
        }

        [TestMethod]
        public async Task Undoing_a_modification_puts_the_old_values_back()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            await ReservationApi.AddServiceAsync(restaurant.Id, DayOfWeek.Saturday, 19, 23);
            ReservationResponse created = (await ReservationApi.CreateAsync(staff, ReservationApi.Request(note: "fenêtre"))).Reservation;
            ReservationRequest change = ReservationApi.Request(hour: 21, covers: 6, note: null);
            ReservationActionResponse updated = await ApiAssert.OkAsync<ReservationActionResponse>(
                await ReservationApi.PutAsync(staff, created.Id, change));

            ReservationResponse back = await ApiAssert.OkAsync<ReservationResponse>(
                await ReservationApi.UndoAsync(staff, created.Id, updated.EventId!.Value));

            Assert.AreEqual(created.Start, back.Start);
            Assert.AreEqual(4, back.Covers);
            Assert.AreEqual("fenêtre", back.Note);
            Assert.AreEqual(EventType.Creation, back.Events.Single().Type);
        }

        [TestMethod]
        public async Task Only_its_author_within_the_window_can_undo_the_last_line()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            using HttpClient staff = restaurant.StaffClient();
            Reservation request = await restaurant.AddReservationAsync(ReservationApi.Saturday, 20, status: ReservationStatus.Pending);

            ReservationActionResponse accepted = await ReservationApi.DoAsync(admin, request.Id, "accept");
            await ApiAssert.ErrorAsync(await ReservationApi.UndoAsync(staff, request.Id, accepted.EventId!.Value),
                HttpStatusCode.Conflict, "UndoExpired");
            ReservationActionResponse cancelled = await ReservationApi.DoAsync(admin, request.Id, "cancel");
            // L'acceptation n'est plus la dernière ligne : la défaire effacerait l'annulation qui la suit
            await ApiAssert.ErrorAsync(await ReservationApi.UndoAsync(admin, request.Id, accepted.EventId!.Value),
                HttpStatusCode.Conflict, "ReservationChanged");
            Assert.AreEqual(HttpStatusCode.OK, (await ReservationApi.UndoAsync(admin, request.Id, cancelled.EventId!.Value)).StatusCode);
            await ApiAssert.ErrorAsync(await ReservationApi.UndoAsync(admin, request.Id, cancelled.EventId!.Value),
                HttpStatusCode.Conflict, "UndoExpired");
            // Passé le délai (ou après un redémarrage), le cache a oublié
            Cache.Forget(accepted.EventId!.Value);
            await ApiAssert.ErrorAsync(await ReservationApi.UndoAsync(admin, request.Id, accepted.EventId!.Value),
                HttpStatusCode.Conflict, "UndoExpired");

            Assert.AreEqual(ReservationStatus.Confirmed, (await ReservationApi.StoredAsync(request.Id)).Status);
        }

        [TestMethod]
        public async Task A_walk_in_gesture_is_undone_without_touching_any_client()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (_, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("T4", 4));
            Reservation walkIn = await restaurant.AddReservationAsync(Dates.Today, 20, clientName: null);
            await ReservationApi.AssignAsync(walkIn.Id, tableId: tables[0].Id);

            ReservationActionResponse seated = await ReservationApi.DoAsync(staff, walkIn.Id, "arrive");
            ReservationResponse back = await ApiAssert.OkAsync<ReservationResponse>(
                await ReservationApi.UndoAsync(staff, walkIn.Id, seated.EventId!.Value));

            Assert.AreEqual(ReservationStatus.Confirmed, back.Status);
            Assert.IsNull(back.Client);
        }

        [TestMethod]
        public async Task An_undo_racing_another_gesture_leaves_one_consistent_story()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Client roux = await ClientApi.AddAsync(restaurant.Id, "Roux", phone: "0611111111");

            for (int round = 0; round < 5; round++)
            {
                Reservation late = await restaurant.AddReservationAsync(Dates.Today.AddDays(-1), 20, clientId: roux.Id);
                ReservationActionResponse noShow = await ReservationApi.DoAsync(staff, late.Id, "no-show");

                HttpResponseMessage[] responses = await AllAtOnceAsync([
                    () => ReservationApi.UndoAsync(staff, late.Id, noShow.EventId!.Value),
                    () => ReservationApi.ActAsync(staff, late.Id, "reopen"),
                ]);

                // Défaire, ou rouvrir : l'un des deux, jamais les deux ; dans les deux cas le no-show ne compte plus
                Assert.AreEqual(1, responses.Count(r => r.StatusCode == HttpStatusCode.OK), string.Join(", ", responses.Select(r => (int)r.StatusCode)));
                Assert.AreEqual(ReservationStatus.Confirmed, (await ReservationApi.StoredAsync(late.Id)).Status);
            }
            Assert.AreEqual(0, (await ClientApi.StoredAsync(roux.Id))!.NoShowCount);
        }

        [TestMethod]
        public async Task The_same_undo_sent_several_times_at_once_passes_once()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            Client roux = await ClientApi.AddAsync(restaurant.Id, "Roux", phone: "0611111111", noShows: 3);
            Reservation late = await restaurant.AddReservationAsync(Dates.Today.AddDays(-1), 20, clientId: roux.Id);
            ReservationActionResponse noShow = await ReservationApi.DoAsync(staff, late.Id, "no-show");

            HttpResponseMessage[] responses = await AllAtOnceAsync(Enumerable.Range(0, 4).Select(_ =>
                (Func<Task<HttpResponseMessage>>)(() => ReservationApi.UndoAsync(staff, late.Id, noShow.EventId!.Value))));

            Assert.AreEqual(1, responses.Count(r => r.StatusCode == HttpStatusCode.OK));
            Assert.AreEqual(3, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
            // 3 + 1 − 1 : le compteur n'est rendu qu'une fois
            Assert.AreEqual(3, (await ClientApi.StoredAsync(roux.Id))!.NoShowCount);
        }
    }
}
