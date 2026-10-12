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

        public sealed record Floor(List<Candidate> Candidates, List<Occupied> Occupations, List<Approach> Approaches);

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

            // RAPP-02 : aucun filtre de proximité — les combinaisons en sommeil, et toute paire de tables qu'aucune ne réunit
            var approaches = new List<Approach>();
            foreach (Zone zone in zones)
            {
                List<Table> active = zone.Tables.Where(t => t.IsActive).OrderBy(t => t.Name).ToList();
                foreach (Combination dormant in zone.Combinations
                    .Where(c => !c.IsActive && c.Tables.Count >= 2 && c.Tables.All(t => t.IsActive && t.ZoneId == zone.Id))
                    .OrderBy(c => c.Name))
                {
                    approaches.Add(ApproachOf(dormant.Id, zone.Id, dormant.Name, dormant.Capacity, dormant.Tables, glued));
                }
                for (int i = 0; i < active.Count; i++)
                {
                    for (int j = i + 1; j < active.Count; j++)
                    {
                        Table a = active[i];
                        Table b = active[j];
                        bool declared = zone.Combinations.Any(c => c.Tables.Count == 2 && c.Tables.Any(t => t.Id == a.Id) && c.Tables.Any(t => t.Id == b.Id));
                        if (!declared)
                        {
                            approaches.Add(ApproachOf(null, zone.Id, CombinationNames.Default([a.Name, b.Name]), a.Capacity + b.Capacity, [a, b], glued));
                        }
                    }
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
            return new Floor(candidates, occupations, approaches);
        }

        private static Approach ApproachOf(Guid? combinationId, Guid zoneId, string name, int capacity, IReadOnlyList<Table> tables, List<Combination> glued)
        {
            Combination? within = glued.FirstOrDefault(c => c.Id != combinationId && c.Tables.Any(t => tables.Any(m => m.Id == t.Id)));
            Table? held = within == null ? null : tables.First(m => within.Tables.Any(t => t.Id == m.Id));
            return new Approach(combinationId, zoneId, name, capacity,
                tables.Select(t => t.Id).ToList(), tables.Select(t => t.Name).ToList(), Spread(tables),
                tables.Select(t => t.NeedsCleaningSince).Where(s => s != null).Min(),
                within == null ? null : new Glue(within.Name, within.Tables.Where(t => t.Id != held!.Id).Select(t => t.Name).OrderBy(n => n).ToList()));
        }

        /// <summary>RAPP-03 : la plus grande distance entre les centres de deux tables du groupe, en mètres (la rotation ne déplace pas le centre)</summary>
        private static double Spread(IReadOnlyList<Table> tables)
        {
            double spread = 0;
            foreach (Table a in tables)
            {
                foreach (Table b in tables)
                {
                    double dx = a.X + a.Width / 2 - (b.X + b.Width / 2);
                    double dy = a.Y + a.Height / 2 - (b.Y + b.Height / 2);
                    spread = Math.Max(spread, Math.Sqrt(dx * dx + dy * dy));
                }
            }
            return Math.Round(spread, 2);
        }
    }
}
