using TUROAPI.Models;
using TUROAPI.Models.Enums;
using Window = TUROAPI.Services.ReservationClock.Window;

namespace TUROAPI.Services
{
    /// <summary>
    /// L'écran Service (§5) sans base : quel service montrer, ses bornes et son état, ce qu'occupe une réservation (§3.2),
    /// les chiffres de la frise. Testé seul ; `ServiceController` charge et assemble
    /// </summary>
    public static class ServiceView
    {
        /// <summary>Les instants UTC d'ouverture et de fermeture d'une plage ; la fermeture tombe le lendemain si la plage passe minuit</summary>
        public sealed record Bounds(DateTime OpeningUtc, DateTime ClosingUtc);

        /// <summary>Un service : son jour de service et sa plage (un jour à horaires modifiés n'a pas d'entité `Service`)</summary>
        public sealed record Choice(DateOnly Day, Window Window);

        /// <summary>Ce qu'occupe une réservation : `[Start, End)`</summary>
        public sealed record Interval(DateTime Start, DateTime End)
        {
            public bool Covers(DateTime instant) => Start <= instant && instant < End;
        }

        /// <summary>Une réservation du service, son occupation, et les tables physiques actives qu'elle tient</summary>
        public sealed record Booking(Reservation Reservation, Interval? Interval, bool IsPlaced, IReadOnlyCollection<Guid> TableIds);

        /// <summary>Un créneau de la frise (§5.4)</summary>
        public sealed record SlotFigures(TimeOnly Time, DateTime At, int Covers, int TakenTables, bool HasUnplaced);

        /// <summary>Jusqu'où chercher le prochain jour ouvert</summary>
        public const int SearchDays = 366;

        public static Bounds BoundsOf(DateOnly day, Window window, TimeZoneInfo timeZone) =>
            new(ReservationClock.StartUtc(day, window.Opening, window, timeZone),
                ReservationClock.StartUtc(day, window.Closing, window, timeZone));

        public static ServiceState StateOf(Bounds bounds, DateTime now) =>
            now < bounds.OpeningUtc ? ServiceState.Upcoming
            : now < bounds.ClosingUtc ? ServiceState.InProgress
            : ServiceState.Finished;

        /// <summary>
        /// La plage montrée pour un jour choisi : aujourd'hui, celle en cours, sinon la prochaine, sinon la dernière ;
        /// un autre jour, la première. `null` : aucune plage (jour fermé ou sans service)
        /// </summary>
        public static Window? WindowOfDay(DateOnly day, List<Window> windows, DateTime now, TimeZoneInfo timeZone)
        {
            if (windows.Count == 0)
            {
                return null;
            }
            if (day != TodayOf(now, timeZone))
            {
                return windows[0];
            }
            return windows.FirstOrDefault(w => StateOf(BoundsOf(day, w, timeZone), now) == ServiceState.InProgress)
                ?? windows.FirstOrDefault(w => StateOf(BoundsOf(day, w, timeZone), now) == ServiceState.Upcoming)
                ?? windows[^1];
        }

        /// <summary>
        /// §4.3 : le service en cours — y compris celui de la veille qui passe minuit —, sinon la règle d'aujourd'hui,
        /// sinon la première plage du prochain jour ouvert. `null` : aucune plage sur un an
        /// </summary>
        public static Choice? DefaultService(DateTime now, TimeZoneInfo timeZone, Func<DateOnly, List<Window>> windowsOf)
        {
            DateOnly today = TodayOf(now, timeZone);
            DateOnly yesterday = today.AddDays(-1);
            Window? lateEvening = windowsOf(yesterday)
                .FirstOrDefault(w => StateOf(BoundsOf(yesterday, w, timeZone), now) == ServiceState.InProgress);
            if (lateEvening != null)
            {
                return new Choice(yesterday, lateEvening);
            }
            if (WindowOfDay(today, windowsOf(today), now, timeZone) is Window ofToday)
            {
                return new Choice(today, ofToday);
            }
            for (int offset = 1; offset <= SearchDays; offset++)
            {
                DateOnly day = today.AddDays(offset);
                List<Window> windows = windowsOf(day);
                if (windows.Count > 0)
                {
                    return new Choice(day, windows[0]);
                }
            }
            return null;
        }

        /// <summary>Même jour de service, et l'heure locale du début tombe dans la plage (y compris après minuit)</summary>
        public static bool BelongsTo(Reservation reservation, Choice service, List<Window> windowsOfDay, TimeZoneInfo timeZone) =>
            reservation.ServiceDay == service.Day
            && ReservationClock.WindowAt(windowsOfDay, ReservationClock.LocalTime(reservation.Start, timeZone)) == service.Window;

        /// <summary>
        /// §3.2 : confirmée = l'heure prévue ; assise = depuis l'arrivée (si plus tôt) et tant qu'elle déborde ;
        /// terminée = jusqu'à la libération, ou l'heure prévue si elle a été close automatiquement. Le reste n'occupe rien
        /// </summary>
        public static Interval? OccupationOf(Reservation reservation, DateTime now)
        {
            DateTime plannedEnd = reservation.Start.AddMinutes(reservation.Duration);
            DateTime start = reservation.SeatedAt is DateTime seatedAt && seatedAt < reservation.Start ? seatedAt : reservation.Start;
            return reservation.Status switch
            {
                ReservationStatus.Confirmed => new Interval(reservation.Start, plannedEnd),
                ReservationStatus.Seated => new Interval(start, plannedEnd > now ? plannedEnd : now),
                ReservationStatus.Finished => new Interval(start, reservation.FinishedAt ?? plannedEnd),
                _ => null,
            };
        }

        /// <summary>
        /// Un créneau par pas : les couverts présents (placés ou non), les tables tenues, et le `!` d'une réservation
        /// confirmée sans table qui commence dans ce créneau
        /// </summary>
        public static List<SlotFigures> SlotsOf(Choice service, TimeZoneInfo timeZone, IReadOnlyCollection<Booking> bookings)
        {
            var slots = new List<SlotFigures>();
            foreach (TimeOnly time in ReservationClock.Slots(service.Window))
            {
                DateTime at = ReservationClock.StartUtc(service.Day, time, service.Window, timeZone);
                DateTime next = at.AddMinutes(service.Window.SlotStep);
                List<Booking> present = bookings.Where(b => b.Interval?.Covers(at) == true).ToList();
                slots.Add(new SlotFigures(
                    time,
                    at,
                    present.Sum(b => b.Reservation.Covers),
                    present.SelectMany(b => b.TableIds).Distinct().Count(),
                    bookings.Any(b => b.Reservation.Status == ReservationStatus.Confirmed && !b.IsPlaced
                        && b.Reservation.Start >= at && b.Reservation.Start < next)));
            }
            return slots;
        }

        private static DateOnly TodayOf(DateTime now, TimeZoneInfo timeZone) =>
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(now, DateTimeKind.Utc), timeZone));
    }
}
