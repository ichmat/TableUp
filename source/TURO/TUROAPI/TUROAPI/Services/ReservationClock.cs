using TUROAPI.Models;
using TUROAPI.Models.Enums;

namespace TUROAPI.Services
{
    /// <summary>
    /// Les plages ouvertes d'un jour de service et l'instant d'un repas (TECH-02) : horaires en heure locale du restaurant,
    /// début stocké en UTC, jour de service local (RES-02). Aucune base : testé seul
    /// </summary>
    public static class ReservationClock
    {
        // Le pas d'un horaire de remplacement quand le jour n'a aucun service pour en donner un
        public const int ReplacementSlotStep = 30;

        /// <summary>Une plage ouverte : un service, ou un horaire de remplacement. `Duration` est la durée par défaut d'un repas</summary>
        public sealed record Window(TimeOnly Opening, TimeOnly Closing, int SlotStep, int Duration);

        /// <summary>
        /// Les plages ouvertes de <paramref name="serviceDay"/>, triées par ouverture. Fermeture → aucune.
        /// Horaires modifiés → les plages de remplacement, au pas le plus fin des services du jour, à la rotation par défaut
        /// </summary>
        public static List<Window> WindowsOf(DateOnly serviceDay, IEnumerable<Service> services, IEnumerable<Closure> closures, int defaultRotation)
        {
            List<Service> ofDay = services.Where(s => s.Day == serviceDay.DayOfWeek).OrderBy(s => s.Opening).ToList();
            Closure? closure = closures.FirstOrDefault(c => c.From <= serviceDay && serviceDay <= c.To);
            if (closure?.Type == ClosureType.Closed)
            {
                return [];
            }
            if (closure?.Type == ClosureType.ModifiedHours)
            {
                int step = ofDay.Count > 0 ? ofDay.Min(s => s.SlotStep) : ReplacementSlotStep;
                return (closure.ReplacementHours ?? [])
                    .OrderBy(h => h.Opening)
                    .Select(h => new Window(h.Opening, h.Closing, step, defaultRotation))
                    .ToList();
            }
            return ofDay.Select(s => new Window(s.Opening, s.Closing, s.SlotStep, s.ExpectedDuration ?? defaultRotation)).ToList();
        }

        /// <summary>La plage qui contient <paramref name="time"/>, fermeture exclue. `IsBetween` gère les plages qui passent minuit</summary>
        public static Window? WindowAt(IEnumerable<Window> windows, TimeOnly time) =>
            windows.FirstOrDefault(w => time.IsBetween(w.Opening, w.Closing));

        /// <summary>Le début de chaque créneau, de l'ouverture jusqu'au dernier avant la fermeture, y compris après minuit</summary>
        public static List<TimeOnly> Slots(Window window)
        {
            // La soustraction de deux TimeOnly tourne sur une horloge : 23:00 → 01:00 donne 2 h
            int length = (int)(window.Closing - window.Opening).TotalMinutes;
            var slots = new List<TimeOnly>();
            for (int offset = 0; offset < length; offset += window.SlotStep)
            {
                slots.Add(window.Opening.AddMinutes(offset));
            }
            return slots;
        }

        /// <summary>
        /// Le début UTC d'un repas de <paramref name="serviceDay"/> à <paramref name="time"/> : le lendemain si la plage passe minuit
        /// et que l'heure est après minuit. Heure inexistante (passage à l'heure d'été) : une heure plus tard.
        /// Heure ambiguë (passage à l'heure d'hiver) : la première des deux
        /// </summary>
        public static DateTime StartUtc(DateOnly serviceDay, TimeOnly time, Window window, TimeZoneInfo timeZone)
        {
            DateOnly date = window.Closing <= window.Opening && time < window.Opening ? serviceDay.AddDays(1) : serviceDay;
            DateTime local = date.ToDateTime(time, DateTimeKind.Unspecified);
            if (timeZone.IsInvalidTime(local))
            {
                local = local.AddHours(1);
            }
            TimeSpan offset = timeZone.IsAmbiguousTime(local)
                ? timeZone.GetAmbiguousTimeOffsets(local).Max()
                : timeZone.GetUtcOffset(local);
            return DateTime.SpecifyKind(local - offset, DateTimeKind.Utc);
        }

        public static TimeOnly LocalTime(DateTime startUtc, TimeZoneInfo timeZone) =>
            TimeOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(startUtc, DateTimeKind.Utc), timeZone));
    }
}
