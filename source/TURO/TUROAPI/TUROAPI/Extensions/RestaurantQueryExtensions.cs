using Microsoft.EntityFrameworkCore;
using TUROAPI.Models;

namespace TUROAPI.Extensions
{
    public static class RestaurantQueryExtensions
    {
        /// <summary>Ce que GET /api/restaurant renvoie : salles, services, conditions d'annulation et équipe</summary>
        public static IQueryable<Restaurant> WithFullInfo(this IQueryable<Restaurant> restaurants) =>
            restaurants
                .Include(r => r.Zones)
                .Include(r => r.Services)
                .Include(r => r.CancellationConditions)
                .Include(r => r.Users);
    }
}
