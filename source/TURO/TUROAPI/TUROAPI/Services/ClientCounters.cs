using System.Linq.Expressions;
using TUROAPI.Models;
using TUROAPI.Models.Enums;

namespace TUROAPI.Services
{
    /// <summary>
    /// Compteurs stockés du client (§7.4), justes par construction : pas de recomptage.
    /// Le lot Réservations appliquera <see cref="Delta"/> par une transition conditionnelle (`WHERE Status = @from`)
    /// et un incrément en base, dans la même transaction
    /// </summary>
    public static class ClientCounters
    {
        public static bool IsVisit(ReservationStatus status) =>
            status is ReservationStatus.Seated or ReservationStatus.Finished;

        /// <summary>CPT-02 : tout passage vers no_show compte +1, tout passage hors de no_show −1 ; de même pour les visites</summary>
        /// <param name="from">`null` à la création de la réservation</param>
        public static (int Visits, int NoShows) Delta(ReservationStatus? from, ReservationStatus to)
        {
            int visits = (IsVisit(to) ? 1 : 0) - (from is { } before && IsVisit(before) ? 1 : 0);
            int noShows = (to == ReservationStatus.NoShow ? 1 : 0) - (from == ReservationStatus.NoShow ? 1 : 0);
            return (visits, noShows);
        }

        /// <summary>CLI-05 : au moins 2 no-shows, et le ratio affiché « No-show / Visites » atteint un tiers</summary>
        public static readonly Expression<Func<Client, bool>> AtRisk =
            c => c.NoShowCount >= 2 && 3 * c.NoShowCount >= c.VisitCount;

        private static readonly Func<Client, bool> _atRisk = AtRisk.Compile();

        public static bool IsAtRisk(Client client) => _atRisk(client);
    }
}
