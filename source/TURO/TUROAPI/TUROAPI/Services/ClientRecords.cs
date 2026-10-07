using TUROAPI.Models;

namespace TUROAPI.Services
{
    /// <summary>Fusion et anonymisation d'une fiche (§7.8), sans les réservations : c'est le contrôleur qui les déplace</summary>
    public static class ClientRecords
    {
        public const string AnonymizedName = "Client supprimé";

        /// <summary>CLI-11 : uniquement sur un numéro ou un e-mail identique, jamais sur le nom</summary>
        public static bool ShareAKey(Client a, Client b) =>
            ContactList.Split(a.Phone).Intersect(ContactList.Split(b.Phone)).Any()
            || ContactList.Split(a.Email).Intersect(ContactList.Split(b.Email)).Any();

        /// <summary>
        /// <paramref name="kept"/> reçoit tout ce que porte <paramref name="other"/>. Les allergies sont mises bout à bout :
        /// une allergie perdue à la fusion, c'est un passage aux urgences
        /// </summary>
        public static void Absorb(Client kept, Client other)
        {
            kept.Phone = ContactList.Join(ContactList.Split(kept.Phone).Concat(ContactList.Split(other.Phone)));
            kept.Email = ContactList.Join(ContactList.Split(kept.Email).Concat(ContactList.Split(other.Email)));
            kept.Tags = kept.Tags.Union(other.Tags).ToList();
            kept.Allergies = JoinTexts(" · ", kept.Allergies, other.Allergies);
            kept.InternalNotes = JoinTexts("\n", kept.InternalNotes, other.InternalNotes);
            if (other.MarketingConsent)
            {
                kept.ConsentAt = kept.MarketingConsent && kept.ConsentAt is { } mine && (other.ConsentAt is null || mine < other.ConsentAt)
                    ? mine
                    : other.ConsentAt;
                kept.MarketingConsent = true;
            }
            if (other.CreatedAt < kept.CreatedAt)
            {
                kept.CreatedAt = other.CreatedAt;
            }
            // CLI-12 : les compteurs s'additionnent, sans recomptage
            kept.VisitCount += other.VisitCount;
            kept.NoShowCount += other.NoShowCount;
        }

        /// <summary>CLI-13 : la personne disparaît, ses réservations et ses compteurs restent</summary>
        public static void Anonymize(Client client, DateTime nowUtc)
        {
            client.Name = AnonymizedName;
            client.Phone = null;
            client.Email = null;
            client.Allergies = null;
            client.InternalNotes = null;
            client.Tags = [];
            client.MarketingConsent = false;
            client.ConsentAt = null;
            client.AnonymizedAt = nowUtc;
        }

        private static string? JoinTexts(string separator, params string?[] texts)
        {
            List<string> parts = texts
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Select(t => t!.Trim())
                .Distinct()
                .ToList();
            return parts.Count == 0 ? null : string.Join(separator, parts);
        }
    }
}
