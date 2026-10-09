namespace TUROAPI.Test
{
    /// <summary>WALK : toucher une table libre → « Asseoir maintenant » → couverts. Ni nom, ni numéro, ni fiche</summary>
    [TestClass]
    public sealed class WalkInTests
    {
        /// <summary>Une plage d'une heure qui contient maintenant ; `null` si l'heure est trop près de sa fin</summary>
        private static async Task<(TestRestaurant Restaurant, HttpClient Staff, List<Table> Tables)?> OpenNowAsync(params (string, int)[] tables)
        {
            DateTime local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(Dates.TimeZoneId));
            if (local.Minute >= 55 || local.Hour == 23)
            {
                return null;
            }
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            await ReservationApi.AddServiceAsync(restaurant.Id, local.DayOfWeek, local.Hour, local.Hour + 1, duration: 90);
            (_, List<Table> created) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", tables);
            return (restaurant, restaurant.StaffClient(), created);
        }

        [TestMethod]
        public async Task A_walk_in_is_seated_without_any_client_and_undo_removes_it()
        {
            if (await OpenNowAsync(("5", 4)) is not var (restaurant, staff, tables))
            {
                Assert.Inconclusive("Trop près de la fin de l'heure");
                return;
            }

            HttpResponseMessage response = await PlacementApi.SeatAsync(staff, tables[0].Id, 3);

            Assert.AreEqual(HttpStatusCode.Created, response.StatusCode, await response.Content.ReadAsStringAsync());
            ReservationActionResponse seated = (await response.Content.ReadFromJsonAsync<ReservationActionResponse>(TestJson.Options))!;
            Assert.AreEqual(ReservationStatus.Seated, seated.Reservation.Status);
            Assert.AreEqual(ReservationSource.WalkIn, seated.Reservation.Source);
            Assert.IsNull(seated.Reservation.Client);
            Assert.AreEqual(3, seated.Reservation.Covers);
            Assert.AreEqual(90, seated.Reservation.Duration);
            Assert.AreEqual("5", seated.Reservation.Place!.Name);
            Assert.AreEqual(EventType.Creation, seated.Reservation.Events.Single().Type);
            Assert.AreEqual(0, await TestApi.WithDbAsync(db => db.Clients.CountAsync(c => c.RestaurantId == restaurant.Id)));

            Assert.AreEqual(HttpStatusCode.NoContent, (await ReservationApi.UndoAsync(staff, seated.Reservation.Id, seated.EventId!.Value)).StatusCode);
            Assert.AreEqual(0, await TestApi.WithDbAsync(db => db.Reservations.CountAsync(r => r.Id == seated.Reservation.Id)));
        }

        [TestMethod]
        public async Task A_table_booked_later_in_the_meal_needs_the_restaurateurs_consent()
        {
            if (await OpenNowAsync(("5", 4)) is not var (restaurant, staff, tables))
            {
                Assert.Inconclusive("Trop près de la fin de l'heure");
                return;
            }
            Reservation legrand = await restaurant.AddReservationAsync(Dates.Today, 0, clientName: "Legrand");
            // Dans 40 min : avant la fin des 90 min du walk-in
            await TestApi.WithDbAsync(db => db.Reservations.Where(r => r.Id == legrand.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Start, DateTime.UtcNow.AddMinutes(40))));
            await ReservationApi.AssignAsync(legrand.Id, tableId: tables[0].Id);

            await ApiAssert.ErrorAsync(await PlacementApi.SeatAsync(staff, tables[0].Id, 2), HttpStatusCode.Conflict, "TableBookedLater");
            Assert.AreEqual(HttpStatusCode.Created, (await PlacementApi.SeatAsync(staff, tables[0].Id, 2, acceptBookedLater: true)).StatusCode);
        }

        [TestMethod]
        public async Task A_table_occupied_now_or_too_many_covers_is_refused()
        {
            if (await OpenNowAsync(("5", 4)) is not var (restaurant, staff, tables))
            {
                Assert.Inconclusive("Trop près de la fin de l'heure");
                return;
            }

            await ApiAssert.ErrorAsync(await PlacementApi.SeatAsync(staff, tables[0].Id, 5), HttpStatusCode.BadRequest, "InvalidRequest");
            await ApiAssert.ErrorAsync(await PlacementApi.SeatAsync(staff, tables[0].Id, 0), HttpStatusCode.BadRequest, "InvalidRequest");
            Assert.AreEqual(HttpStatusCode.Created, (await PlacementApi.SeatAsync(staff, tables[0].Id, 2)).StatusCode);
            await ApiAssert.ErrorAsync(await PlacementApi.SeatAsync(staff, tables[0].Id, 2), HttpStatusCode.Conflict, "PlacementUnavailable");
        }

        [TestMethod]
        public async Task Outside_any_open_service_nobody_is_seated()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            (_, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("5", 4));

            await ApiAssert.ErrorAsync(await PlacementApi.SeatAsync(staff, tables[0].Id, 2), HttpStatusCode.BadRequest, "OutsideService");
        }

        [TestMethod]
        public async Task Seating_cleans_a_dirty_table_and_undo_makes_it_dirty_again()
        {
            if (await OpenNowAsync(("5", 4)) is not var (restaurant, staff, tables))
            {
                Assert.Inconclusive("Trop près de la fin de l'heure");
                return;
            }
            await ReservationApi.TrackCleaningAsync(restaurant.Id);
            DateTime since = DateTime.UtcNow.AddMinutes(-5);
            await ServiceApi.MarkToCleanAsync(tables[0].Id, since);

            HttpResponseMessage response = await PlacementApi.SeatAsync(staff, tables[0].Id, 2);
            ReservationActionResponse seated = (await response.Content.ReadFromJsonAsync<ReservationActionResponse>(TestJson.Options))!;
            Assert.IsNull(await TestApi.WithDbAsync(db => db.Tables.Where(t => t.Id == tables[0].Id).Select(t => t.NeedsCleaningSince).SingleAsync()));

            await ReservationApi.UndoAsync(staff, seated.Reservation.Id, seated.EventId!.Value);
            DateTime? after = await TestApi.WithDbAsync(db => db.Tables.Where(t => t.Id == tables[0].Id).Select(t => t.NeedsCleaningSince).SingleAsync());
            ServiceApi.AssertSameInstant(since, after!.Value);
        }

        [TestMethod]
        public async Task Another_restaurants_table_is_not_found()
        {
            if (await OpenNowAsync(("5", 4)) is not var (_, staff, _))
            {
                Assert.Inconclusive("Trop près de la fin de l'heure");
                return;
            }
            TestRestaurant other = await TestRestaurant.CreateAsync();
            (_, List<Table> foreign) = await ReservationApi.AddTablesAsync(other.Id, "Salle", ("9", 4));

            await ApiAssert.ErrorAsync(await PlacementApi.SeatAsync(staff, foreign[0].Id, 2), HttpStatusCode.NotFound, "NotFound");
        }
    }
}
