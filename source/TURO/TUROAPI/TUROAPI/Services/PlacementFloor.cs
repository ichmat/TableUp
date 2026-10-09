using Microsoft.EntityFrameworkCore;
using TUROAPI.Context;
using TUROAPI.Models;
using TUROAPI.Models.Enums;
using TUROAPI.Models.Wrapper;
using static TUROAPI.Services.PlacementEngine;

namespace TUROAPI.Services
{
    /// <summary>
    /// Les entrées du moteur : tables actives, combinaisons actives (toutes tables actives), et les occupations de la veille
    /// au lendemain du jour de service — un service qui passe minuit, et la suite d'une table
    /// </summary>
    public static class PlacementFloor
    {
        private static readonly ReservationStatus[] Occupying = [ReservationStatus.Confirmed, ReservationStatus.Seated, ReservationStatus.Finished];

        public sealed record Floor(List<Candidate> Candidates, List<Occupied> Occupations);

        public static async Task<Floor> LoadAsync(TuroDBContext context, Guid restaurantId, DateOnly serviceDay, DateTime now)
        {
            List<Zone> zones = await context.Zones
                .Where(z => z.RestaurantId == restaurantId)
                .Include(z => z.Tables)
                .Include(z => z.Combinations).ThenInclude(c => c.Tables)
                .OrderBy(z => z.Order)
                .AsSplitQuery()
                .AsNoTracking()
                .ToListAsync();
            List<Combination> glued = zones.SelectMany(z => z.Combinations)
                .Where(c => c.IsActive && c.Tables.Count > 0 && c.Tables.All(t => t.IsActive))
                .ToList();

            var candidates = new List<Candidate>();
            foreach (Zone zone in zones)
            {
                foreach (Table table in zone.Tables.Where(t => t.IsActive).OrderBy(t => t.Name))
                {
                    Combination? within = glued.FirstOrDefault(c => c.Tables.Any(t => t.Id == table.Id));
                    candidates.Add(new Candidate(table.Id, null, zone.Id, table.Name, table.Capacity, [table.Id], table.NeedsCleaningSince,
                        within == null ? null : new Glue(within.Name, within.Tables.Where(t => t.Id != table.Id).Select(t => t.Name).OrderBy(n => n).ToList())));
                }
                foreach (Combination combination in glued.Where(c => c.ZoneId == zone.Id).OrderBy(c => c.Name))
                {
                    candidates.Add(new Candidate(null, combination.Id, zone.Id, combination.Name, combination.Capacity,
                        combination.Tables.Select(t => t.Id).ToList(),
                        combination.Tables.Select(t => t.NeedsCleaningSince).Where(s => s != null).Min(), null));
                }
            }

            List<Reservation> near = await context.Reservations
                .Where(r => r.RestaurantId == restaurantId
                    && r.ServiceDay >= serviceDay.AddDays(-1) && r.ServiceDay <= serviceDay.AddDays(1)
                    && Occupying.Contains(r.Status))
                .Include(r => r.Client)
                .Include(r => r.Assignments).ThenInclude(a => a.Combination).ThenInclude(c => c!.Tables)
                .AsSplitQuery()
                .AsNoTracking()
                .ToListAsync();
            var occupations = new List<Occupied>();
            foreach (Reservation reservation in near)
            {
                if (ServiceView.OccupationOf(reservation, now) is not ServiceView.Interval interval)
                {
                    continue;
                }
                Assignment? assignment = reservation.LatestAssignment();
                IEnumerable<Guid> held = assignment?.TableId is Guid tableId ? [tableId] : assignment?.Combination?.Tables.Select(t => t.Id) ?? [];
                occupations.AddRange(held.Select(id =>
                    new Occupied(reservation.Id, id, interval.Start, interval.End, reservation.Status, reservation.Client?.Name)));
            }
            return new Floor(candidates, occupations);
        }
    }
}
