namespace TUROAPI.Test
{
    /// <summary>NET : « Nettoyée » rend la table libre, se défait 8 s, et n'existe que si le restaurant suit le nettoyage</summary>
    [TestClass]
    public sealed class TableCleaningTests
    {
        private static Task<DateTime?> CleaningOfAsync(Guid tableId) =>
            TestApi.WithDbAsync(db => db.Tables.Where(t => t.Id == tableId).Select(t => t.NeedsCleaningSince).SingleAsync());

        private static async Task<(TestRestaurant Restaurant, Table Table, DateTime Since)> DirtyTableAsync(bool track = true)
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            (_, List<Table> tables) = await ReservationApi.AddTablesAsync(restaurant.Id, "Salle", ("T6", 4));
            DateTime since = DateTime.UtcNow.AddMinutes(-12);
            await ServiceApi.MarkToCleanAsync(tables[0].Id, since);
            await ReservationApi.TrackCleaningAsync(restaurant.Id, track);
            return (restaurant, tables[0], since);
        }

        [TestMethod]
        public async Task Cleaning_frees_the_table_and_returns_the_date_it_was_dirty_since()
        {
            (TestRestaurant restaurant, Table table, DateTime since) = await DirtyTableAsync();
            using HttpClient staff = restaurant.StaffClient();
            await using Screen screen = await Screen.ConnectAsync(restaurant.StaffJwt());

            TableCleanedResponse cleaned = await ApiAssert.OkAsync<TableCleanedResponse>(await ServiceApi.CleanAsync(staff, table.Id));

            Assert.AreEqual(table.Id, cleaned.TableId);
            ServiceApi.AssertSameInstant(since, cleaned.Since);
            Assert.IsNull(await CleaningOfAsync(table.Id));
            Assert.AreEqual(DataScope.Service, await screen.NextAsync());
        }

        [TestMethod]
        public async Task Undoing_the_cleaning_puts_the_table_back_to_clean()
        {
            (TestRestaurant restaurant, Table table, _) = await DirtyTableAsync();
            using HttpClient staff = restaurant.StaffClient();
            TableCleanedResponse cleaned = await ApiAssert.OkAsync<TableCleanedResponse>(await ServiceApi.CleanAsync(staff, table.Id));
            await using Screen screen = await Screen.ConnectAsync(restaurant.StaffJwt());

            HttpResponseMessage undone = await ServiceApi.UndoCleanAsync(staff, table.Id, cleaned.Since);

            Assert.AreEqual(HttpStatusCode.NoContent, undone.StatusCode, await undone.Content.ReadAsStringAsync());
            ServiceApi.AssertSameInstant(cleaned.Since, (await CleaningOfAsync(table.Id))!.Value);
            Assert.AreEqual(DataScope.Service, await screen.NextAsync());
        }

        [TestMethod]
        public async Task An_undo_after_the_table_was_dirtied_again_is_refused_and_keeps_the_new_date()
        {
            (TestRestaurant restaurant, Table table, _) = await DirtyTableAsync();
            using HttpClient staff = restaurant.StaffClient();
            TableCleanedResponse cleaned = await ApiAssert.OkAsync<TableCleanedResponse>(await ServiceApi.CleanAsync(staff, table.Id));
            DateTime again = DateTime.UtcNow;
            await ServiceApi.MarkToCleanAsync(table.Id, again);

            await ApiAssert.ErrorAsync(await ServiceApi.UndoCleanAsync(staff, table.Id, cleaned.Since), HttpStatusCode.Conflict, "UndoExpired");

            ServiceApi.AssertSameInstant(again, (await CleaningOfAsync(table.Id))!.Value);
        }

        [TestMethod]
        public async Task A_clean_table_cannot_be_cleaned_twice()
        {
            (TestRestaurant restaurant, Table table, _) = await DirtyTableAsync();
            using HttpClient first = restaurant.StaffClient();
            using HttpClient second = restaurant.AdminClient();
            await ApiAssert.OkAsync<TableCleanedResponse>(await ServiceApi.CleanAsync(first, table.Id));

            await ApiAssert.ErrorAsync(await ServiceApi.CleanAsync(second, table.Id), HttpStatusCode.Conflict, "TableAlreadyClean", "T6");
        }

        [TestMethod]
        public async Task Cleaning_is_refused_when_the_restaurant_does_not_track_it()
        {
            (TestRestaurant restaurant, Table table, DateTime since) = await DirtyTableAsync(track: false);
            using HttpClient staff = restaurant.StaffClient();

            await ApiAssert.ErrorAsync(await ServiceApi.CleanAsync(staff, table.Id), HttpStatusCode.Conflict, "TableCleaningDisabled");

            ServiceApi.AssertSameInstant(since, (await CleaningOfAsync(table.Id))!.Value);
        }

        [TestMethod]
        public async Task Another_restaurant_cannot_clean_or_dirty_my_table()
        {
            (_, Table table, DateTime since) = await DirtyTableAsync();
            TestRestaurant other = await TestRestaurant.CreateAsync();
            await ReservationApi.TrackCleaningAsync(other.Id);
            using HttpClient intruder = other.StaffClient();

            await ApiAssert.ErrorAsync(await ServiceApi.CleanAsync(intruder, table.Id), HttpStatusCode.NotFound, "NotFound");
            await ApiAssert.ErrorAsync(await ServiceApi.UndoCleanAsync(intruder, table.Id, DateTime.UtcNow), HttpStatusCode.NotFound, "NotFound");
            ServiceApi.AssertSameInstant(since, (await CleaningOfAsync(table.Id))!.Value);
        }
    }
}
