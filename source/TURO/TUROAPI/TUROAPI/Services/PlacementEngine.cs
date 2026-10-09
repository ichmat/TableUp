using TUROAPI.Models;
using TUROAPI.Models.Enums;

namespace TUROAPI.Services
{
    /// <summary>
    /// §3.5 sans base : pour une réservation, le verdict de chaque table et de chaque combinaison active.
    /// Le GET des halos et le placement (qui revalide sous verrou) partagent ce calcul : il n'existe qu'ici
    /// </summary>
    public static class PlacementEngine
    {
        /// <summary>En deçà, la table suivante attend debout : « Réservée juste après ». Fixe, pas un réglage</summary>
        public const int SoonMinutes = 15;

        /// <summary>Placer, accepter en déposant, ou changer de table</summary>
        public static readonly ReservationStatus[] Placeable = [ReservationStatus.Pending, ReservationStatus.Confirmed, ReservationStatus.Seated];

        /// <summary>Une table active ou une combinaison active, et ses tables physiques (§3.3)</summary>
        public sealed record Candidate(Guid? TableId, Guid? CombinationId, Guid ZoneId, string Name, int Capacity,
            IReadOnlyList<Guid> TableIds, DateTime? NeedsCleaningSince, Glue? GluedIn);

        /// <summary>La combinaison active dans laquelle une table est collée, et ses voisines</summary>
        public sealed record Glue(string Combination, IReadOnlyList<string> With);

        /// <summary>Une occupation (lot A) portée par une table physique</summary>
        public sealed record Occupied(Guid ReservationId, Guid TableId, DateTime Start, DateTime End, ReservationStatus Status, string? Guest);

        public sealed record Request(Guid ReservationId, int Covers, DateTime Start, DateTime End, Guid? PreferredZoneId,
            string? PreferredZoneName, string? Note);

        public sealed record Settings(int Tolerance, bool TrackCleaning, int DefaultRotation);

        /// <summary>« Ensuite 22:30 · marge 30 min » ; `Margin` en minutes</summary>
        public sealed record NextBooking(DateTime Start, int Margin, string? Guest);

        /// <summary>Une raison et ses données : seuls les champs de son `Kind` sont remplis</summary>
        public sealed record Reason(PlacementReasonKind Kind)
        {
            public int? Count { get; init; }
            public int? Tolerance { get; init; }
            public bool? NoneLeftOfCapacity { get; init; }
            public DateTime? Since { get; init; }
            public string? Guest { get; init; }
            public DateTime? LeftAt { get; init; }
            public string? RequestedZone { get; init; }
            public string? Note { get; init; }
            public DateTime? Start { get; init; }
            public int? Margin { get; init; }
            public int? DefaultRotation { get; init; }
            public string? Combination { get; init; }
            public IReadOnlyList<string>? With { get; init; }
        }

        public sealed record Verdict(Candidate Candidate, PlacementLevel Level, IReadOnlyList<Reason> Reasons, NextBooking? Next);

        /// <summary>
        /// `[max(début, maintenant), max(fin prévue, ce début + 15 min))` : le passé ne compte plus, et une table assise qui
        /// déborde déjà se cherche pour le quart d'heure à venir
        /// </summary>
        public static (DateTime Start, DateTime End) IntervalOf(DateTime start, int duration, DateTime now)
        {
            DateTime from = start > now ? start : now;
            DateTime planned = start.AddMinutes(duration);
            DateTime minimum = from.AddMinutes(SoonMinutes);
            return (from, planned > minimum ? planned : minimum);
        }

        public static Request RequestOf(Reservation reservation, string? preferredZoneName, DateTime now)
        {
            (DateTime start, DateTime end) = IntervalOf(reservation.Start, reservation.Duration, now);
            return new Request(reservation.Id, reservation.Covers, start, end, reservation.PreferredZoneId, preferredZoneName, reservation.Note);
        }

        public static Settings SettingsOf(Restaurant restaurant) =>
            new(restaurant.SeatTolerance, restaurant.TrackTableCleaning, restaurant.DefaultRotation);

        public static List<Verdict> Judge(Request request, IReadOnlyList<Candidate> candidates, IReadOnlyList<Occupied> occupations, Settings settings)
        {
            // La réservation qu'on déplace ne se bloque pas elle-même
            List<Occupied> others = occupations.Where(o => o.ReservationId != request.ReservationId).ToList();
            bool IsTaken(Candidate c) => c.Capacity < request.Covers
                || others.Any(o => c.TableIds.Contains(o.TableId) && o.Start < request.End && request.Start < o.End);
            List<Candidate> open = candidates.Where(c => !IsTaken(c)).ToList();

            return candidates
                .Select(c => open.Contains(c) ? Judged(c) : new Verdict(c, PlacementLevel.Excluded, [], null))
                .ToList();

            Verdict Judged(Candidate candidate)
            {
                var reasons = new List<Reason>();
                int extra = candidate.Capacity - request.Covers;
                switch (PlacementVerdict.Of(request.Covers, candidate.Capacity, settings.Tolerance))
                {
                    case PlacementFit.WithinTolerance:
                        reasons.Add(new Reason(PlacementReasonKind.ExtraSeats)
                        {
                            Count = extra,
                            Tolerance = settings.Tolerance,
                            // « Il ne te restera plus de table de 6 ce soir »
                            NoneLeftOfCapacity = !open.Any(o => o != candidate && o.Capacity == candidate.Capacity),
                        });
                        break;
                    case PlacementFit.NotAdvised:
                        reasons.Add(new Reason(PlacementReasonKind.BeyondTolerance) { Count = extra, Tolerance = settings.Tolerance });
                        break;
                }

                List<Occupied> onIt = others.Where(o => candidate.TableIds.Contains(o.TableId)).ToList();
                if (settings.TrackCleaning && candidate.NeedsCleaningSince is DateTime since)
                {
                    Occupied? last = onIt.Where(o => o.Status == ReservationStatus.Finished).MaxBy(o => o.End);
                    reasons.Add(new Reason(PlacementReasonKind.NeedsCleaning) { Since = since, Guest = last?.Guest, LeftAt = last?.End });
                }
                if (request.PreferredZoneId is Guid wanted && wanted != candidate.ZoneId)
                {
                    reasons.Add(new Reason(PlacementReasonKind.OtherZone) { RequestedZone = request.PreferredZoneName, Note = request.Note });
                }

                Occupied? following = onIt.Where(o => o.Start >= request.End).MinBy(o => o.Start);
                NextBooking? next = following == null
                    ? null
                    : new NextBooking(following.Start, (int)(following.Start - request.End).TotalMinutes, following.Guest);
                if (next != null && next.Margin < SoonMinutes)
                {
                    reasons.Add(new Reason(PlacementReasonKind.NextSoon)
                    {
                        Start = next.Start, Margin = next.Margin, Guest = next.Guest, DefaultRotation = settings.DefaultRotation,
                    });
                }
                if (candidate.GluedIn is Glue glue)
                {
                    reasons.Add(new Reason(PlacementReasonKind.Glued) { Combination = glue.Combination, With = glue.With });
                }

                PlacementLevel level = reasons.Count == 0 ? PlacementLevel.Perfect
                    : reasons.Any(r => r.Kind == PlacementReasonKind.BeyondTolerance) ? PlacementLevel.NotAdvised
                    : PlacementLevel.WithReserve;
                return new Verdict(candidate, level, reasons, next);
            }
        }
    }
}
