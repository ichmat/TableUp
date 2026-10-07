using System.Text;

namespace TUROAPI.Test
{
    /// <summary>Export CSV : tout ce qui sert à recontacter, jamais les allergies ni les notes internes</summary>
    [TestClass]
    public sealed class ClientExportTests
    {
        private static async Task<(string Text, HttpResponseMessage Response)> ExportAsync(HttpClient client)
        {
            HttpResponseMessage response = await client.GetAsync("api/clients/export");
            Assert.AreEqual(HttpStatusCode.OK, response.StatusCode, await response.Content.ReadAsStringAsync());
            byte[] bytes = await response.Content.ReadAsByteArrayAsync();
            CollectionAssert.AreEqual(Encoding.UTF8.GetPreamble(), bytes.Take(3).ToArray());
            return (Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3), response);
        }

        [TestMethod]
        public async Task Export_lists_active_clients_without_allergies_or_notes()
        {
            TestRestaurant restaurant = await TestRestaurant.CreateAsync();
            using HttpClient staff = restaurant.StaffClient();
            ClientResponse sophie = await ClientApi.CreateAsync(staff, ClientApi.Request("Sophie Marchand", ["0612345678", "0711223344"],
                ["s@mail.fr"], allergies: "Fruits à coque", notes: "Négocie toujours", tags: [ClientTag.Regular, ClientTag.Vip]));
            await restaurant.AddReservationAsync(Dates.Today.AddDays(-3), 20, status: ReservationStatus.Finished, clientId: sophie.Id);
            Client gone = await ClientApi.AddAsync(restaurant.Id, "Partie", phone: "0600000009");
            await TestApi.WithDbAsync(db => db.Clients.Where(c => c.Id == gone.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.AnonymizedAt, DateTime.UtcNow)));

            (string text, HttpResponseMessage response) = await ExportAsync(staff);

            Assert.AreEqual("text/csv", response.Content.Headers.ContentType?.MediaType);
            Assert.AreEqual($"clients-{Dates.Today:yyyy-MM-dd}.csv", response.Content.Headers.ContentDisposition?.FileNameStar
                ?? response.Content.Headers.ContentDisposition?.FileName?.Trim('"'));
            string[] lines = text.Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
            Assert.AreEqual("Nom;Téléphones;E-mails;Tags;Visites;No-shows;Dernière;Consentement marketing", lines[0]);
            Assert.AreEqual($"Sophie Marchand;06 12 34 56 78, 07 11 22 33 44;s@mail.fr;Habitué, VIP;0;0;{Dates.Today.AddDays(-3):yyyy-MM-dd};non", lines[1]);
            Assert.AreEqual(2, lines.Length);
            Assert.IsFalse(text.Contains("Fruits"), text);
            Assert.IsFalse(text.Contains("Négocie"), text);
        }

        [TestMethod]
        public async Task Export_never_crosses_restaurants()
        {
            TestRestaurant a = await TestRestaurant.CreateAsync();
            TestRestaurant b = await TestRestaurant.CreateAsync();
            await ClientApi.AddAsync(a.Id, "Chez A", phone: "0600000001");
            using HttpClient staffB = b.StaffClient();

            (string text, _) = await ExportAsync(staffB);

            Assert.IsFalse(text.Contains("Chez A"), text);
        }
    }
}
