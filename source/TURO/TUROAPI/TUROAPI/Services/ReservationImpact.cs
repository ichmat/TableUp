using Microsoft.EntityFrameworkCore;
using TUROAPI.Context;
using TUROAPI.Models;
using TUROAPI.Models.Enums;

namespace TUROAPI.Services
{
    /// <summary>
    /// Réservations actives, avec leur heure locale, pour savoir lesquelles un changement d'horaires laisserait sans service
    /// </summary>
    public static class ReservationImpact
    {
        public record LocalReservation(Reservation Reservation, TimeOnly LocalStart);

        public static async Task<TimeZoneInfo> GetTimeZoneAsync(TuroDBContext context, Guid restaurantId)
        {
            string timeZoneId = await context.Restaurants
                .Where(r => r.Id == restaurantId)
                .Select(r => r.TimeZone)
                .FirstAsync();
            return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }

        /// <summary>Le jour courant dans le fuseau du restaurant</summary>
        public static DateOnly Today(TimeZoneInfo timeZone) =>
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, timeZone));

        /// <summary>
        /// Réservations en attente ou confirmées dont le jour de service est entre <paramref name="from"/> et <paramref name="to"/> (inclus).
        /// <paramref name="withDetails"/> charge le client et les tables, pour les afficher
        /// </summary>
        public static async Task<List<LocalReservation>> ActiveAsync(
            TuroDBContext context, Guid restaurantId, TimeZoneInfo timeZone,
            DateOnly from, DateOnly? to = null, bool withDetails = false)
        {
            IQueryable<Reservation> query = context.Reservations
                .Where(r =>
                    r.RestaurantId == restaurantId
                    && r.ServiceDay >= from
                    && (!to.HasValue || r.ServiceDay <= to.Value)
                    && (r.Status == ReservationStatus.Pending
                        || r.Status == ReservationStatus.Confirmed));

            if (withDetails)
            {
                query = query
                    .Include(r => r.Client)
                    .Include(r => r.Assignments).ThenInclude(a => a.Table)
                    .Include(r => r.Assignments).ThenInclude(a => a.Combination);
            }

            // L'heure locale se calcule en mémoire : Start est en UTC, et le fuseau du restaurant ne s'applique pas côté base.
            // ServiceDay rattache déjà un repas commencé après minuit au jour du service (RES-02)
            return (await query.ToListAsync())
                .Select(r => new LocalReservation(r, TimeOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(r.Start, timeZone))))
                .OrderBy(x => x.Reservation.ServiceDay).ThenBy(x => x.Reservation.Start)
                .ToList();
        }
    }
}
