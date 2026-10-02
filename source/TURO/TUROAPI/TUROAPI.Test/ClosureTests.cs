namespace TUROAPI.Test
{
    /// <summary>
    /// La seule écriture qui annule des réservations de clients (§9.5) : rien n'est annulé sans avoir été montré et accepté
    /// </summary>
    [TestClass]
    public sealed class ClosureTests
    {
        private static Task<HttpResponseMessage> AddAsync(HttpClient admin, AddOrUpdateClosureRequest request) =>
            admin.PostAsJsonAsync("api/restaurant/closures", request, TestJson.Options);

        private static Task<HttpResponseMessage> UpdateAsync(HttpClient admin, Guid id, AddOrUpdateClosureRequest request) =>
            admin.PutAsJsonAsync($"api/restaurant/closures/{id}", request, TestJson.Options);

        private static Task<HttpResponseMessage> ImpactAsync(HttpClient admin, AddOrUpdateClosureRequest request) =>
            admin.PostAsJsonAsync("api/restaurant/closures/impact", request, TestJson.Options);

        private static TimeOnly At(int hour, int minute = 0) => new(hour, minute);

        [TestMethod]
        public async Task Impact_lists_the_active_reservations_of_the_closed_days()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            DateOnly day = Dates.Today.AddDays(10);
            Reservation dinner = await restaurant.AddReservationAsync(day, 20, covers: 4);
            Reservation walkIn = await restaurant.AddReservationAsync(day, 12, status: ReservationStatus.Pending, clientName: null);
            await restaurant.AddReservationAsync(day, 21, status: ReservationStatus.Cancelled);
            await restaurant.AddReservationAsync(day.AddDays(5), 20);

            List<ImpactedReservationResponse> impact = await ApiAssert.OkAsync<List<ImpactedReservationResponse>>(
                await ImpactAsync(admin, Requests.Closed(day, day)));

            CollectionAssert.AreEqual(new[] { walkIn.Id, dinner.Id }, impact.Select(i => i.Id).ToArray());
            Assert.IsNull(impact[0].ClientName);
            Assert.AreEqual("Dupont", impact[1].ClientName);
            Assert.AreEqual("0600000000", impact[1].ClientPhone);
            Assert.AreEqual(At(20), impact[1].LocalStart);
            Assert.AreEqual(4, impact[1].Covers);
            // L'aperçu n'annule rien
            Assert.AreEqual(ReservationStatus.Confirmed, (await TestRestaurant.ReservationAsync(dinner.Id)).Status);
        }

        [TestMethod]
        public async Task Closure_is_refused_while_an_impacted_reservation_was_not_accepted()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            DateOnly day = Dates.Today.AddDays(10);
            Reservation dinner = await restaurant.AddReservationAsync(day, 20, covers: 4);

            await ApiAssert.ErrorAsync(await AddAsync(admin, Requests.Closed(day, day)),
                HttpStatusCode.Conflict, "ClosureImpactsReservations", "1 active reservation(s) (4 covers)");

            int closures = await TestApi.WithDbAsync(db => db.Closures.CountAsync(c => c.RestaurantId == restaurant.Id));
            Assert.AreEqual(0, closures);
            Assert.AreEqual(ReservationStatus.Confirmed, (await TestRestaurant.ReservationAsync(dinner.Id)).Status);
        }

        [TestMethod]
        public async Task Closure_cancels_the_accepted_reservations_on_behalf_of_the_restaurant()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            DateOnly day = Dates.Today.AddDays(10);
            Reservation dinner = await restaurant.AddReservationAsync(day, 20);

            ClosureResponse closure = await ApiAssert.OkAsync<ClosureResponse>(await AddAsync(admin, Requests.Closed(day, day, dinner.Id)));

            Reservation cancelled = await TestRestaurant.ReservationAsync(dinner.Id);
            Assert.AreEqual(ReservationStatus.Cancelled, cancelled.Status);
            Assert.AreEqual(CancelledBy.Restaurant, cancelled.CancelledBy);
            Assert.IsNotNull(cancelled.CancelledAt);
            EventLog log = await TestApi.WithDbAsync(db => db.EventLogs.AsNoTracking().SingleAsync(e => e.ReservationId == dinner.Id));
            Assert.AreEqual(EventType.Cancellation, log.Type);
            Assert.AreEqual(restaurant.Admin.Id, log.AuthorId);
            Assert.AreEqual("Fermeture exceptionnelle", log.Details);
            List<ClosureResponse> closures = await ApiAssert.OkAsync<List<ClosureResponse>>(await admin.GetAsync("api/restaurant/closures"));
            Assert.AreEqual(closure.Id, closures.Single().Id);
        }

        [TestMethod]
        public async Task Partial_acceptance_cancels_nothing()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            DateOnly day = Dates.Today.AddDays(10);
            Reservation accepted = await restaurant.AddReservationAsync(day, 19, covers: 4);
            await restaurant.AddReservationAsync(day, 21, covers: 2);

            await ApiAssert.ErrorAsync(await AddAsync(admin, Requests.Closed(day, day, accepted.Id)),
                HttpStatusCode.Conflict, "ClosureImpactsReservations", "1 active reservation(s) (2 covers)");

            Assert.AreEqual(ReservationStatus.Confirmed, (await TestRestaurant.ReservationAsync(accepted.Id)).Status);
        }

        [TestMethod]
        public async Task Modified_hours_only_impact_reservations_outside_the_new_slots()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            DateOnly day = Dates.Today.AddDays(10);
            Reservation lunch = await restaurant.AddReservationAsync(day, 12, 30);
            Reservation dinner = await restaurant.AddReservationAsync(day, 20);
            (TimeOnly, TimeOnly)[] eveningOnly = [(At(19), At(23))];

            List<ImpactedReservationResponse> impact = await ApiAssert.OkAsync<List<ImpactedReservationResponse>>(
                await ImpactAsync(admin, Requests.ModifiedHours(day, day, eveningOnly)));
            Assert.AreEqual(lunch.Id, impact.Single().Id);

            await ApiAssert.OkAsync<ClosureResponse>(await AddAsync(admin, Requests.ModifiedHours(day, day, eveningOnly, lunch.Id)));

            Assert.AreEqual(ReservationStatus.Cancelled, (await TestRestaurant.ReservationAsync(lunch.Id)).Status);
            Assert.AreEqual(ReservationStatus.Confirmed, (await TestRestaurant.ReservationAsync(dinner.Id)).Status);
            string? details = await TestApi.WithDbAsync(db => db.EventLogs
                .Where(e => e.ReservationId == lunch.Id)
                .Select(e => e.Details)
                .SingleAsync());
            Assert.AreEqual("Horaires exceptionnels modifiés", details);
        }

        [TestMethod]
        public async Task Seated_finished_lost_and_cancelled_reservations_are_not_impacted()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            DateOnly day = Dates.Today.AddDays(10);
            ReservationStatus[] statuses = [ReservationStatus.Seated, ReservationStatus.Finished, ReservationStatus.NoShow, ReservationStatus.Cancelled];
            List<Reservation> reservations = [];
            foreach (ReservationStatus status in statuses)
            {
                reservations.Add(await restaurant.AddReservationAsync(day, 20, status: status));
            }

            Assert.AreEqual(0, (await ApiAssert.OkAsync<List<ImpactedReservationResponse>>(await ImpactAsync(admin, Requests.Closed(day, day)))).Count);
            await ApiAssert.OkAsync<ClosureResponse>(await AddAsync(admin, Requests.Closed(day, day)));

            for (int i = 0; i < statuses.Length; i++)
            {
                Assert.AreEqual(statuses[i], (await TestRestaurant.ReservationAsync(reservations[i].Id)).Status);
            }
        }

        [TestMethod]
        public async Task Dates_are_validated()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            DateOnly today = Dates.Today;
            DateOnly day = today.AddDays(10);
            (AddOrUpdateClosureRequest Request, string Message)[] cases =
            [
                (Requests.Closed(day, day.AddDays(-1)), "the last day must not be before the first day."),
                (Requests.Closed(day, day.AddDays(366)), "a closure cannot exceed 366 days."),
                (Requests.Closed(today.AddDays(-1), day), "a closure cannot be planned in the past."),
                (Requests.Closed(today.AddDays(-3), today.AddDays(-1)), "a closure cannot be planned in the past."),
            ];

            foreach ((AddOrUpdateClosureRequest request, string message) in cases)
            {
                await ApiAssert.ErrorAsync(await AddAsync(admin, request), HttpStatusCode.Forbidden, "InvalidModification", message);
            }
            // Bornes acceptées : aujourd'hui, et 366 jours tout juste
            await ApiAssert.OkAsync<ClosureResponse>(await AddAsync(admin, Requests.Closed(today, today.AddDays(365))));
        }

        [TestMethod]
        public async Task Overlapping_closures_are_refused_but_adjacent_ones_are_not()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            DateOnly day = Dates.Today.AddDays(10);
            await ApiAssert.OkAsync<ClosureResponse>(await AddAsync(admin, Requests.Closed(day, day.AddDays(2))));

            await ApiAssert.ErrorAsync(await AddAsync(admin, Requests.Closed(day.AddDays(2), day.AddDays(4))),
                HttpStatusCode.Forbidden, "InvalidModification", "these days overlap another exceptional closure");
            await ApiAssert.OkAsync<ClosureResponse>(await AddAsync(admin, Requests.Closed(day.AddDays(3), day.AddDays(4))));
        }

        [TestMethod]
        public async Task Replacement_slots_are_validated()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            DateOnly day = Dates.Today.AddDays(10);
            var withoutHours = new AddOrUpdateClosureRequest { From = day, To = day, Type = ClosureType.ModifiedHours, Reason = ClosureReason.Works };
            (AddOrUpdateClosureRequest Request, string Message)[] cases =
            [
                (withoutHours, "modified hours need at least one opening slot."),
                (Requests.ModifiedHours(day, day, []), "modified hours need at least one opening slot."),
                (Requests.ModifiedHours(day, day, [(At(20), At(20))]), "an opening slot cannot start and end at the same time."),
                (Requests.ModifiedHours(day, day, [(At(12), At(15)), (At(14), At(18))]), "replacement opening slots overlap."),
                // Des plages qui passent minuit se chevauchent aussi
                (Requests.ModifiedHours(day, day, [(At(19), At(1)), (At(0, 30), At(2))]), "replacement opening slots overlap."),
            ];

            foreach ((AddOrUpdateClosureRequest request, string message) in cases)
            {
                await ApiAssert.ErrorAsync(await AddAsync(admin, request), HttpStatusCode.Forbidden, "InvalidModification", message);
            }
            ClosureResponse saved = await ApiAssert.OkAsync<ClosureResponse>(
                await AddAsync(admin, Requests.ModifiedHours(day, day, [(At(19), At(23)), (At(12), At(14))])));
            // Les plages sont rangées par heure d'ouverture
            CollectionAssert.AreEqual(new[] { At(12), At(19) }, saved.ReplacementHours!.Select(h => h.Opening).ToArray());
        }

        [TestMethod]
        public async Task Unknown_values_and_too_long_texts_are_refused()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            DateOnly day = Dates.Today.AddDays(10);
            AddOrUpdateClosureRequest Make(Action<AddOrUpdateClosureRequest> change)
            {
                AddOrUpdateClosureRequest request = Requests.Closed(day, day);
                change(request);
                return request;
            }
            (AddOrUpdateClosureRequest Request, string Message)[] cases =
            [
                (Make(r => r.Type = (ClosureType)7), "unknown closure type or reason."),
                (Make(r => r.Reason = (ClosureReason)42), "unknown closure type or reason."),
                (Make(r => r.ReasonDetail = new string('x', 501)), "reason detail cannot exceed 500 characters."),
                (Make(r => r.CustomerMessage = new string('x', 2001)), "customer message cannot exceed 2000 characters."),
            ];

            foreach ((AddOrUpdateClosureRequest request, string message) in cases)
            {
                await ApiAssert.ErrorAsync(await AddAsync(admin, request), HttpStatusCode.Forbidden, "InvalidModification", message);
            }
            ClosureResponse saved = await ApiAssert.OkAsync<ClosureResponse>(await AddAsync(admin, Make(r =>
            {
                r.ReasonDetail = "   ";
                r.CustomerMessage = "  Fermé pour travaux  ";
            })));
            Assert.IsNull(saved.ReasonDetail);
            Assert.AreEqual("Fermé pour travaux", saved.CustomerMessage);
        }

        [TestMethod]
        public async Task Update_requires_accepting_the_reservations_it_newly_impacts()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            DateOnly day = Dates.Today.AddDays(10);
            ClosureResponse closure = await ApiAssert.OkAsync<ClosureResponse>(await AddAsync(admin, Requests.Closed(day, day)));
            Reservation nextDay = await restaurant.AddReservationAsync(day.AddDays(1), 20, covers: 3);

            await ApiAssert.ErrorAsync(await UpdateAsync(admin, closure.Id, Requests.Closed(day, day.AddDays(1))),
                HttpStatusCode.Conflict, "ClosureImpactsReservations", "1 active reservation(s) (3 covers)");
            Closure unchanged = await TestApi.WithDbAsync(db => db.Closures.AsNoTracking().SingleAsync(c => c.Id == closure.Id));
            Assert.AreEqual(day, unchanged.To);

            await ApiAssert.OkAsync<ClosureResponse>(await UpdateAsync(admin, closure.Id, Requests.Closed(day, day.AddDays(1), nextDay.Id)));
            Assert.AreEqual(ReservationStatus.Cancelled, (await TestRestaurant.ReservationAsync(nextDay.Id)).Status);
        }

        [TestMethod]
        public async Task Started_closure_keeps_its_first_day_when_updated()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            DateOnly today = Dates.Today;
            Guid id = Guid.NewGuid();
            await TestApi.WithDbAsync(db =>
            {
                db.Closures.Add(new Closure
                {
                    Id = id,
                    RestaurantId = restaurant.Id,
                    From = today.AddDays(-2),
                    To = today.AddDays(2),
                    Type = ClosureType.Closed,
                    Reason = ClosureReason.Works,
                });
                return db.SaveChangesAsync();
            });

            ClosureResponse extended = await ApiAssert.OkAsync<ClosureResponse>(
                await UpdateAsync(admin, id, Requests.Closed(today.AddDays(-2), today.AddDays(4))));
            Assert.AreEqual(today.AddDays(4), extended.To);
            // Le premier jour, déjà passé, ne peut pas être déplacé
            await ApiAssert.ErrorAsync(await UpdateAsync(admin, id, Requests.Closed(today.AddDays(-1), today.AddDays(4))),
                HttpStatusCode.Forbidden, "InvalidModification", "a closure cannot be planned in the past.");
        }

        [TestMethod]
        public async Task Deleting_a_closure_reopens_the_days_but_cancellations_stay()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            DateOnly day = Dates.Today.AddDays(10);
            Reservation dinner = await restaurant.AddReservationAsync(day, 20);
            ClosureResponse closure = await ApiAssert.OkAsync<ClosureResponse>(await AddAsync(admin, Requests.Closed(day, day, dinner.Id)));

            await ApiAssert.OkAsync<ClosureResponse>(await admin.DeleteAsync($"api/restaurant/closures/{closure.Id}"));

            Assert.AreEqual(0, (await ApiAssert.OkAsync<List<ClosureResponse>>(await admin.GetAsync("api/restaurant/closures"))).Count);
            Assert.AreEqual(ReservationStatus.Cancelled, (await TestRestaurant.ReservationAsync(dinner.Id)).Status);
        }

        [TestMethod]
        public async Task Unknown_closure_is_not_found()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient admin = restaurant.AdminClient();
            DateOnly day = Dates.Today.AddDays(10);
            Guid unknown = Guid.NewGuid();

            await ApiAssert.ErrorAsync(await UpdateAsync(admin, unknown, Requests.Closed(day, day)),
                HttpStatusCode.NotFound, "NotFound", "Closure not found.");
            await ApiAssert.ErrorAsync(await admin.DeleteAsync($"api/restaurant/closures/{unknown}"),
                HttpStatusCode.NotFound, "NotFound", "Closure not found.");
        }
    }
}
