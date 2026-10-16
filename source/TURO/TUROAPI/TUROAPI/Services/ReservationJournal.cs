using System.Globalization;
using TUROAPI.Models.Enums;

namespace TUROAPI.Services
{
    /// <summary>Le texte lisible des lignes de journal (§6.8). Aucune base</summary>
    public static class ReservationJournal
    {
        private static readonly CultureInfo French = CultureInfo.GetCultureInfo("fr-FR");

        /// <summary>Ce qu'une modification peut changer, vu en heure locale</summary>
        public sealed record Fields(DateOnly ServiceDay, TimeOnly LocalTime, int Covers, int Duration, string? Note, Guid? ZoneId, string? ZoneName);

        public static string SourceLabel(ReservationSource source) => source switch
        {
            ReservationSource.Web => "web",
            ReservationSource.Phone => "téléphone",
            ReservationSource.WalkIn => "sur place",
            ReservationSource.Google => "google",
            ReservationSource.Platform => "plateforme",
            _ => "autre",
        };

        /// <summary>105 → « 1 h 45 », 120 → « 2 h », 45 → « 45 min » : comme `formatDuration` côté front</summary>
        public static string Duration(int minutes)
        {
            int hours = minutes / 60;
            int rest = minutes % 60;
            if (hours == 0)
            {
                return $"{rest} min";
            }
            return rest == 0 ? $"{hours} h" : $"{hours} h {rest:00}";
        }

        /// <summary>« jeu. 20/08 → ven. 21/08 · 20:00 → 20:30 · 4 → 6 couverts · … » ; `null` si rien n'a changé</summary>
        public static string? Changes(Fields before, Fields after)
        {
            var parts = new List<string>();
            if (before.ServiceDay != after.ServiceDay)
            {
                parts.Add($"{Day(before.ServiceDay)} → {Day(after.ServiceDay)}");
            }
            if (before.LocalTime != after.LocalTime)
            {
                parts.Add($"{Time(before.LocalTime)} → {Time(after.LocalTime)}");
            }
            if (before.Covers != after.Covers)
            {
                parts.Add($"{before.Covers} → {after.Covers} couverts");
            }
            if (before.Duration != after.Duration)
            {
                parts.Add($"durée {Duration(before.Duration)} → {Duration(after.Duration)}");
            }
            if (before.ZoneId != after.ZoneId)
            {
                parts.Add($"salle : {before.ZoneName ?? "indifférent"} → {after.ZoneName ?? "indifférent"}");
            }
            if (before.Note != after.Note)
            {
                parts.Add("commentaire modifié");
            }
            return parts.Count == 0 ? null : string.Join(" · ", parts);
        }

        private static string Day(DateOnly day) => day.ToString("ddd dd/MM", French);

        private static string Time(TimeOnly time) => time.ToString("HH:mm", CultureInfo.InvariantCulture);
    }
}
