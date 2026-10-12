namespace TUROAPI.Services
{
    /// <summary>
    /// §3.4 sans base : quand rapprocher une combinaison en sommeil, quand séparer une combinaison collée. Les dates sont
    /// toujours recalculées, jamais saisies (COMB-01) ; le logiciel ne bascule jamais `IsActive` tout seul
    /// </summary>
    public static class CombinationSchedule
    {
        /// <summary>Une combinaison et les réponses qu'elle retient. `NoShowStands` : la réservation du no-show l'est toujours</summary>
        public sealed record State(Guid Id, bool IsActive, IReadOnlyList<Guid> TableIds, Guid? KeepGluedFor, Guid? SeparateAfterNoShowOf, bool NoShowStands);

        /// <summary>Une réservation confirmée ou assise, l'entité qui la porte et ses tables physiques : `[Start, End)`</summary>
        public sealed record Hold(Guid ReservationId, DateOnly ServiceDay, Guid? CombinationId, IReadOnlyList<Guid> TableIds,
            DateTime Start, DateTime End, string? Guest, int Covers);

        public sealed record Planned(DateTime? ActivateAt, DateTime? DeactivateAt, Guid? KeepGluedFor, Guid? SeparateAfterNoShowOf);

        /// <summary>
        /// En sommeil : rapprocher au début de sa prochaine réservation. Collée : séparer à la fin de sa série, seulement si une
        /// réservation ultérieure prend une table membre sans elle ; rien avant cette réservation → tout de suite
        /// </summary>
        public static Planned Of(State combination, IReadOnlyList<Hold> holds, DateTime now)
        {
            List<Hold> ahead = holds.Where(h => h.End > now).ToList();
            List<Hold> onIt = ahead.Where(h => h.CombinationId == combination.Id).ToList();
            if (!combination.IsActive)
            {
                return new Planned(onIt.Count == 0 ? null : onIt.Min(h => h.Start), null, null, null);
            }

            DateTime? deactivateAt = null;
            if (ClaimOf(combination, ahead, now) is Hold claim)
            {
                List<Hold> series = onIt.Where(h => h.Start < claim.Start).ToList();
                deactivateAt = series.Count == 0 ? now : series.Max(h => h.End);
            }
            // La réclamation qu'on a laissée passer ne compte plus ; disparue, on l'oublie
            bool stillClaims = combination.KeepGluedFor is Guid kept && Claims(combination, ahead).Any(h => h.ReservationId == kept);
            return new Planned(null, deactivateAt, stillClaims ? combination.KeepGluedFor : null,
                combination.NoShowStands ? combination.SeparateAfterNoShowOf : null);
        }

        /// <summary>La première réservation à venir qui prend une table membre sans passer par cette combinaison</summary>
        public static Hold? ClaimOf(State combination, IReadOnlyList<Hold> holds, DateTime now) =>
            Claims(combination, holds.Where(h => h.End > now))
                .Where(h => h.ReservationId != combination.KeepGluedFor)
                .MinBy(h => h.Start);

        /// <summary>La prochaine réservation de cette combinaison : celle qui attend le rapprochement</summary>
        public static Hold? NextOn(State combination, IReadOnlyList<Hold> holds, DateTime now) =>
            holds.Where(h => h.End > now && h.CombinationId == combination.Id).MinBy(h => h.Start);

        private static IEnumerable<Hold> Claims(State combination, IEnumerable<Hold> holds) =>
            holds.Where(h => h.CombinationId != combination.Id && h.TableIds.Any(combination.TableIds.Contains));
    }
}
