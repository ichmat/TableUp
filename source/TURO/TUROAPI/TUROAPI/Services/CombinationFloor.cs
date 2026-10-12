using Microsoft.EntityFrameworkCore;
using TUROAPI.Context;
using TUROAPI.Models;
using TUROAPI.Models.Enums;
using TUROAPI.Models.Responses;
using TUROAPI.Models.Wrapper;
using static TUROAPI.Services.CombinationSchedule;

namespace TUROAPI.Services
{
    /// <summary>
    /// Les entrées de `CombinationSchedule` en base, et l'écriture de ses dates. Appelé après chaque geste qui touche une
    /// affectation ou un collage, dans la transaction du geste : l'appelant fait le `SaveChanges`
    /// </summary>
    public static class CombinationFloor
    {
        /// <summary>« Pas encore, me redemander dans 10 minutes »</summary>
        public const int SnoozeMinutes = 10;

        private static readonly ReservationStatus[] Holding = [ReservationStatus.Confirmed, ReservationStatus.Seated];

        /// <summary>`Combinations` sont suivies (avec leurs tables) ; `NoShows` : les no-shows cités par un rappel, par id</summary>
        public sealed record Floor(List<Combination> Combinations, List<Hold> Holds, Dictionary<Guid, Hold> NoShows);

        public static async Task<Floor> LoadAsync(TuroDBContext context, Guid restaurantId, DateTime now)
        {
            List<Combination> combinations = await context.Combinations
                .Where(c => c.Zone.RestaurantId == restaurantId)
                .Include(c => c.Tables)
                .ToListAsync();
            // Deux jours de marge en UTC couvrent la veille locale : un service qui passe minuit
            DateOnly from = DateOnly.FromDateTime(now).AddDays(-2);
            List<Reservation> near = await context.Reservations
                .Where(r => r.RestaurantId == restaurantId && r.ServiceDay >= from && Holding.Contains(r.Status))
                .Include(r => r.Client)
                .Include(r => r.Assignments).ThenInclude(a => a.Combination).ThenInclude(c => c!.Tables)
                .AsSplitQuery()
                .AsNoTracking()
                .ToListAsync();
            List<Hold> holds = near.Select(r => HoldOf(r, now)).OfType<Hold>().ToList();

            List<Guid> cited = combinations.Select(c => c.SeparateAfterNoShowOf).OfType<Guid>().ToList();
            List<Reservation> noShows = cited.Count == 0 ? [] : await context.Reservations
                .Where(r => cited.Contains(r.Id) && r.Status == ReservationStatus.NoShow)
                .Include(r => r.Client)
                .AsNoTracking()
                .ToListAsync();
            return new Floor(combinations, holds, noShows.ToDictionary(r => r.Id,
                r => new Hold(r.Id, r.ServiceDay, null, [], r.Start, r.Start.AddMinutes(r.Duration), r.Client?.Name, r.Covers)));
        }

        public static State StateOf(Combination combination, Floor floor) =>
            new(combination.Id, combination.IsActive, combination.Tables.Select(t => t.Id).ToList(), combination.KeepGluedFor,
                combination.SeparateAfterNoShowOf,
                combination.SeparateAfterNoShowOf is Guid id && floor.NoShows.ContainsKey(id));

        /// <summary>
        /// Recalcule toutes les dates du restaurant. `noShow` : la réservation qui vient de passer no-show — si elle était sur des
        /// tables collées que rien d'autre n'attend ce jour-là, on demandera s'il faut les séparer (COMB-07)
        /// </summary>
        public static async Task ApplyAsync(TuroDBContext context, Guid restaurantId, DateTime now, Reservation? noShow = null)
        {
            Floor floor = await LoadAsync(context, restaurantId, now);
            if (noShow?.LatestAssignment()?.CombinationId is Guid gluedId
                && floor.Combinations.FirstOrDefault(c => c.Id == gluedId) is { IsActive: true } glued
                && !floor.Holds.Any(h => h.CombinationId == gluedId && h.ServiceDay == noShow.ServiceDay && h.End > now))
            {
                glued.SeparateAfterNoShowOf = noShow.Id;
                floor.NoShows[noShow.Id] = new Hold(noShow.Id, noShow.ServiceDay, null, [], noShow.Start,
                    noShow.Start.AddMinutes(noShow.Duration), null, noShow.Covers);
            }
            foreach (Combination combination in floor.Combinations)
            {
                Planned planned = Of(StateOf(combination, floor), floor.Holds, now);
                combination.ActivateAt = planned.ActivateAt;
                combination.DeactivateAt = planned.DeactivateAt;
                combination.KeepGluedFor = planned.KeepGluedFor;
                combination.SeparateAfterNoShowOf = planned.SeparateAfterNoShowOf;
                if (combination.IsActive || combination.ActivateAt == null)
                {
                    combination.SnoozedUntil = null;
                }
            }
        }

        /// <summary>
        /// Le rappel d'une combinaison, dû ou à venir : au plus un (COMB-05). `Separate` passe avant `AfterNoShow`.
        /// Un rappel après no-show est dû tout de suite
        /// </summary>
        public static CombinationReminderResponse? ReminderOf(Combination combination, Floor floor, DateTime now)
        {
            State state = StateOf(combination, floor);
            (CombinationReminderKind Kind, DateTime DueAt, Hold? About)? found =
                !combination.IsActive && combination.ActivateAt is DateTime activateAt
                    ? (CombinationReminderKind.Approach, combination.SnoozedUntil > activateAt ? combination.SnoozedUntil.Value : activateAt, NextOn(state, floor.Holds, now))
                : combination.IsActive && combination.DeactivateAt is DateTime deactivateAt
                    ? (CombinationReminderKind.Separate, deactivateAt, ClaimOf(state, floor.Holds, now))
                : combination.IsActive && combination.SeparateAfterNoShowOf is Guid noShowId
                    ? (CombinationReminderKind.AfterNoShow, now, floor.NoShows.GetValueOrDefault(noShowId))
                : null;
            if (found is not { } reminder)
            {
                return null;
            }
            List<Table> members = [.. combination.Tables.OrderBy(t => t.Name, StringComparer.Ordinal)];
            return new CombinationReminderResponse
            {
                CombinationId = combination.Id,
                Name = combination.Name,
                Kind = reminder.Kind,
                DueAt = reminder.DueAt,
                TableIds = members.Select(t => t.Id).ToList(),
                TableNames = members.Select(t => t.Name).ToList(),
                Reservation = reminder.About is Hold about
                    ? new ReminderReservationResponse { Id = about.ReservationId, Start = about.Start, GuestName = about.Guest, Covers = about.Covers }
                    : null,
                Separates = reminder.Kind == CombinationReminderKind.Approach
                    ? floor.Combinations
                        .Where(o => o.Id != combination.Id && o.IsActive && o.Tables.Any(t => members.Any(m => m.Id == t.Id)))
                        .Select(o => o.Name).OrderBy(n => n).ToList()
                    : [],
            };
        }

        /// <summary>Coller ou séparer : les réponses de l'autre état ne valent plus (COMB-05). Toujours par ici</summary>
        public static void SetActive(Combination combination, bool active)
        {
            if (combination.IsActive == active)
            {
                return;
            }
            combination.IsActive = active;
            combination.ActivateAt = null;
            combination.DeactivateAt = null;
            combination.SnoozedUntil = null;
            combination.KeepGluedFor = null;
            combination.SeparateAfterNoShowOf = null;
        }

        /// <summary>L'occupation d'une réservation placée ; une table assise qui déborde se juge sur le quart d'heure à venir</summary>
        private static Hold? HoldOf(Reservation reservation, DateTime now)
        {
            if (reservation.LatestAssignment() is not Assignment assignment || ServiceView.OccupationOf(reservation, now) is not ServiceView.Interval interval)
            {
                return null;
            }
            IReadOnlyList<Guid> tableIds = assignment.TableId is Guid tableId
                ? [tableId]
                : assignment.Combination?.Tables.Select(t => t.Id).ToList() ?? [];
            DateTime end = interval.End == ServiceView.Unreleased ? now.AddMinutes(PlacementEngine.SoonMinutes) : interval.End;
            return new Hold(reservation.Id, reservation.ServiceDay, assignment.CombinationId, tableIds, interval.Start, end,
                reservation.Client?.Name, reservation.Covers);
        }
    }
}
