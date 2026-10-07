using System.Text;
using TUROAPI.Services;

namespace TUROAPI.Test
{
    /// <summary>Règles pures du mini-CRM (§7.2, §7.4, §7.8) : aucune base, aucune requête</summary>
    [TestClass]
    public sealed class ClientRulesTests
    {
        [TestMethod]
        [DataRow("06 12 34 56 78", "0612345678")]
        [DataRow("06.12.34.56.78", "0612345678")]
        [DataRow("06-12-34-56-78", "0612345678")]
        [DataRow("+33 6 12 34 56 78", "0612345678")]
        [DataRow("0033 6 12 34 56 78", "0612345678")]
        [DataRow("+44 20 7946 0958", "+442079460958")]
        [DataRow("  0612345678  ", "0612345678")]
        [DataRow("+33 1 23", "+33123")]
        public void Phone_number_is_normalized_so_one_person_has_one_key(string raw, string expected)
        {
            Assert.AreEqual(expected, PhoneNumber.Normalize(raw));
        }

        [TestMethod]
        [DataRow(null)]
        [DataRow("")]
        [DataRow("   ")]
        [DataRow("pas de numéro")]
        public void Text_without_digits_is_no_phone_number(string? raw)
        {
            Assert.IsNull(PhoneNumber.Normalize(raw));
        }

        [TestMethod]
        [DataRow("06 12 34", "061234")]
        [DataRow("+33 6 12", "0612")]
        [DataRow("0033 6", "06")]
        [DataRow("+44 20", "+4420")]
        public void Search_key_normalizes_a_partial_number(string text, string expected)
        {
            Assert.AreEqual(expected, PhoneNumber.SearchKey(text));
        }

        [TestMethod]
        public void Email_is_trimmed_and_lowercased()
        {
            Assert.AreEqual("s.marchand@mail.fr", ContactList.NormalizeEmail("  S.Marchand@Mail.FR "));
            Assert.IsNull(ContactList.NormalizeEmail("   "));
            Assert.IsNull(ContactList.NormalizeEmail(null));
        }

        [TestMethod]
        public void Contact_lists_keep_order_and_drop_duplicates_and_blanks()
        {
            CollectionAssert.AreEqual(new[] { "0612345678", "0711223344" },
                ContactList.Phones(["06 12 34 56 78", "", "+33 6 12 34 56 78", "07 11 22 33 44", null]));
            CollectionAssert.AreEqual(new[] { "a@b.fr", "c@d.fr" },
                ContactList.Emails(["A@b.fr", "c@d.fr", " a@B.fr "]));
        }

        [TestMethod]
        public void Stored_list_is_split_and_joined_on_semicolons()
        {
            Assert.AreEqual("0612345678;0711223344", ContactList.Join(["0612345678", "0711223344", "0612345678"]));
            Assert.IsNull(ContactList.Join([]));
            CollectionAssert.AreEqual(new[] { "0612345678", "0711223344" }, ContactList.Split("0612345678;0711223344"));
            Assert.AreEqual(0, ContactList.Split(null).Count);
        }

        [TestMethod]
        [DataRow("Marchand", "Marchand")]
        [DataRow("Da Silva; Marc", "\"Da Silva; Marc\"")]
        [DataRow("Le \"Patron\"", "\"Le \"\"Patron\"\"\"")]
        [DataRow("deux\nlignes", "\"deux\nlignes\"")]
        [DataRow(null, "")]
        public void Csv_value_is_escaped_per_rfc_4180(string? value, string expected)
        {
            Assert.AreEqual(expected, ClientCsv.Escape(value));
        }

        [TestMethod]
        public void Csv_file_starts_with_a_bom_and_uses_semicolons()
        {
            byte[] bytes = ClientCsv.Build([["Nom", "Visites"], ["Marchand, Sophie", "41"]]);

            CollectionAssert.AreEqual(Encoding.UTF8.GetPreamble(), bytes.Take(3).ToArray());
            Assert.AreEqual("Nom;Visites\r\nMarchand, Sophie;41\r\n", Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3));
        }

        [TestMethod]
        [DataRow("+33 (0)6 12 34 56 78", "0612345678")]
        [DataRow("0033 (0)6 12 34 56 78", "0612345678")]
        public void French_number_written_with_a_bracketed_zero_is_the_same_key(string raw, string expected)
        {
            Assert.AreEqual(expected, PhoneNumber.Normalize(raw));
        }

        [TestMethod]
        [DataRow("+33 (0)6 12", "0612")]
        public void Search_key_drops_the_bracketed_zero(string text, string expected)
        {
            Assert.AreEqual(expected, PhoneNumber.SearchKey(text));
        }

        [TestMethod]
        [DataRow("0612345678", "06 12 34 56 78")]
        [DataRow("+442079460958", "+442079460958")]
        public void Phone_number_is_written_in_pairs_for_reading(string stored, string expected)
        {
            // Excel garde « 06 12 34 56 78 » en texte ; « 0612345678 » perdrait son zéro
            Assert.AreEqual(expected, PhoneNumber.Format(stored));
        }

        [TestMethod]
        [DataRow("=HYPERLINK(\"http://x\")", "\"'=HYPERLINK(\"\"http://x\"\")\"")]
        [DataRow("+442079460958", "'+442079460958")]
        [DataRow("-2+3", "'-2+3")]
        [DataRow("@SUM(A1)", "'@SUM(A1)")]
        public void Csv_value_that_starts_like_a_formula_is_kept_as_text(string value, string expected)
        {
            // OWASP : une cellule qui commence par = + - @ serait exécutée par Excel
            Assert.AreEqual(expected, ClientCsv.Escape(value));
        }

        private static Client Counted(int visits, int noShows) => new() { VisitCount = visits, NoShowCount = noShows };

        [TestMethod]
        [DataRow(null, ReservationStatus.Confirmed, 0, 0)]
        [DataRow(null, ReservationStatus.Seated, 1, 0)]
        [DataRow(ReservationStatus.Confirmed, ReservationStatus.Seated, 1, 0)]
        [DataRow(ReservationStatus.Seated, ReservationStatus.Finished, 0, 0)]
        [DataRow(ReservationStatus.Confirmed, ReservationStatus.NoShow, 0, 1)]
        [DataRow(ReservationStatus.NoShow, ReservationStatus.Confirmed, 0, -1)]
        [DataRow(ReservationStatus.Finished, ReservationStatus.Confirmed, -1, 0)]
        [DataRow(ReservationStatus.NoShow, ReservationStatus.Finished, 1, -1)]
        public void Counter_delta_follows_every_status_change_both_ways(ReservationStatus? from, ReservationStatus to, int visits, int noShows)
        {
            // CPT-02 : sortir de no_show décrémente, y compris « Rouvrir »
            Assert.AreEqual((visits, noShows), ClientCounters.Delta(from, to));
        }

        [TestMethod]
        [DataRow(0, 1, false)]
        [DataRow(1, 0, false)]
        [DataRow(2, 41, false)]
        [DataRow(2, 7, false)]
        [DataRow(2, 6, true)]
        [DataRow(2, 5, true)]
        [DataRow(2, 3, true)]
        [DataRow(3, 2, true)]
        [DataRow(2, 0, true)]
        public void Ratio_turns_coral_from_two_no_shows_weighing_a_third_of_visits(int noShows, int visits, bool expected)
        {
            Assert.AreEqual(expected, ClientCounters.IsAtRisk(Counted(visits, noShows)));
        }

        [TestMethod]
        public void Clients_share_a_key_only_on_an_exact_phone_or_email()
        {
            var sophie = new Client { Name = "Sophie Marchand", Phone = "0612345678", Email = "s@mail.fr" };

            Assert.IsTrue(ClientRecords.ShareAKey(sophie, new Client { Name = "S. M.", Phone = "0711223344;0612345678" }));
            Assert.IsTrue(ClientRecords.ShareAKey(sophie, new Client { Name = "Autre", Phone = "0799999999", Email = "s@mail.fr" }));
            // Deux homonymes sans clé commune : jamais (CLI-11)
            Assert.IsFalse(ClientRecords.ShareAKey(sophie, new Client { Name = "Sophie Marchand", Phone = "0799999999", Email = "x@mail.fr" }));
        }

        [TestMethod]
        public void Absorbing_a_client_keeps_every_number_email_tag_allergy_and_note()
        {
            var kept = new Client
            {
                Name = "Sophie Marchand", Phone = "0612345678", Email = "s@mail.fr", Tags = [ClientTag.Regular],
                Allergies = "Fruits à coque", InternalNotes = "Table près de la fenêtre", VisitCount = 3, NoShowCount = 1,
                CreatedAt = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            };
            var other = new Client
            {
                Name = "S. Marchand", Phone = "0711223344;0612345678", Email = "sophie@pro.fr", Tags = [ClientTag.Vip, ClientTag.Regular],
                Allergies = "Crustacés", InternalNotes = "Négocie le dessert", VisitCount = 2, NoShowCount = 1,
                MarketingConsent = true, ConsentAt = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            };

            ClientRecords.Absorb(kept, other);

            Assert.AreEqual("Sophie Marchand", kept.Name);
            Assert.AreEqual("0612345678;0711223344", kept.Phone);
            Assert.AreEqual("s@mail.fr;sophie@pro.fr", kept.Email);
            CollectionAssert.AreEquivalent(new[] { ClientTag.Regular, ClientTag.Vip }, kept.Tags);
            Assert.AreEqual("Fruits à coque · Crustacés", kept.Allergies);
            Assert.AreEqual("Table près de la fenêtre\nNégocie le dessert", kept.InternalNotes);
            Assert.AreEqual(5, kept.VisitCount);
            Assert.AreEqual(2, kept.NoShowCount);
            Assert.IsTrue(kept.MarketingConsent);
            Assert.AreEqual(other.ConsentAt, kept.ConsentAt);
            Assert.AreEqual(other.CreatedAt, kept.CreatedAt);
        }

        [TestMethod]
        public void Absorbing_does_not_repeat_an_identical_allergy()
        {
            var kept = new Client { Allergies = "Arachide" };

            ClientRecords.Absorb(kept, new Client { Allergies = "Arachide" });

            Assert.AreEqual("Arachide", kept.Allergies);
        }

        [TestMethod]
        public void Anonymizing_erases_the_person_and_keeps_the_counters()
        {
            var client = new Client
            {
                Name = "Sophie Marchand", Phone = "0612345678", Email = "s@mail.fr", Allergies = "Arachide",
                InternalNotes = "Habituée", Tags = [ClientTag.Vip], MarketingConsent = true, ConsentAt = DateTime.UtcNow,
                VisitCount = 41, NoShowCount = 2,
            };
            var now = new DateTime(2026, 10, 5, 12, 0, 0, DateTimeKind.Utc);

            ClientRecords.Anonymize(client, now);

            Assert.AreEqual(ClientRecords.AnonymizedName, client.Name);
            Assert.IsNull(client.Phone);
            Assert.IsNull(client.Email);
            Assert.IsNull(client.Allergies);
            Assert.IsNull(client.InternalNotes);
            Assert.AreEqual(0, client.Tags.Count);
            Assert.IsFalse(client.MarketingConsent);
            Assert.IsNull(client.ConsentAt);
            Assert.AreEqual(now, client.AnonymizedAt);
            Assert.AreEqual(41, client.VisitCount);
            Assert.AreEqual(2, client.NoShowCount);
        }
    }
}
