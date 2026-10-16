using Microsoft.EntityFrameworkCore;
using TUROAPI.Context;
using TUROAPI.Models;
using TUROAPI.Models.Enums;

namespace TUROAPI.Services
{
    /// <summary>Les règles d'une combinaison, que l'éditeur et le service partagent</summary>
    public static class CombinationRules
    {
        public const int MaxNameLength = 20;
        public const int MinCapacity = 1;
        public const int MaxCapacity = 100;

        /// <summary>Le nom et les places d'une combinaison créée en service : les règles de la publication, unicité comprise</summary>
        public static async Task<string> CheckNewAsync(TuroDBContext context, Guid restaurantId, string? name, int capacity)
        {
            string trimmed = name?.Trim() ?? string.Empty;
            if (trimmed.Length == 0 || trimmed.Length > MaxNameLength)
            {
                throw new ApiErrorException(ApiError.InvalidModification, $"combination {trimmed}: a name of 1 to {MaxNameLength} characters is required.");
            }
            if (capacity < MinCapacity || capacity > MaxCapacity)
            {
                throw new ApiErrorException(ApiError.InvalidModification, $"combination {trimmed}: seats must be between {MinCapacity} and {MaxCapacity}.");
            }
            string key = trimmed.ToLower();
            // Une réservation affiche une table ou une combinaison : un nom ne désigne qu'une seule chose
            bool taken = await context.Tables.AnyAsync(t => t.Zone.RestaurantId == restaurantId && t.IsActive && t.Name.Trim().ToLower() == key)
                || await context.Combinations.AnyAsync(c => c.Zone.RestaurantId == restaurantId && c.Name.Trim().ToLower() == key);
            if (taken)
            {
                throw new ApiErrorException(ApiError.InvalidModification, $"name {trimmed}: another table or combination already has this name.");
            }
            return trimmed;
        }

        /// <summary>
        /// Les tables d'une combinaison à créer en service : au moins `minimum`, distinctes, actives, du restaurant, dans une salle,
        /// et qu'aucune combinaison ne réunit déjà exactement
        /// </summary>
        public static async Task<List<Table>> CheckPairAsync(TuroDBContext context, Guid restaurantId, IReadOnlyCollection<Guid> tableIds, int minimum)
        {
            List<Guid> ids = tableIds.Distinct().ToList();
            if (ids.Count != tableIds.Count || ids.Count < minimum)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, $"a combination joins at least {minimum} different tables.");
            }
            List<Table> tables = await context.Tables
                .Where(t => ids.Contains(t.Id) && t.Zone.RestaurantId == restaurantId && t.IsActive)
                .ToListAsync();
            if (tables.Count != ids.Count || tables.Select(t => t.ZoneId).Distinct().Count() > 1)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, "the tables must be active tables of one room.");
            }
            List<List<Guid>> declared = await context.Combinations
                .Where(c => c.Zone.RestaurantId == restaurantId)
                .Select(c => c.Tables.Select(t => t.Id).ToList())
                .ToListAsync();
            if (declared.Any(set => set.Count == ids.Count && set.All(ids.Contains)))
            {
                throw new ApiErrorException(ApiError.InvalidRequest, "a combination already joins these tables.");
            }
            return tables;
        }
    }
}
