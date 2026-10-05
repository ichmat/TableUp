using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using TUROAPI.Context;
using TUROAPI.Controllers.Base;
using TUROAPI.Extensions;
using TUROAPI.Models;
using TUROAPI.Models.Enums;
using TUROAPI.Models.Requests;
using TUROAPI.Models.Responses;
using TUROAPI.Models.Wrapper;
using TUROAPI.Services;

namespace TUROAPI.Controllers
{
    /// <summary>
    /// Salles et plan de salle (§12, §13.1). Les salles changent tout de suite ; les tables passent par le brouillon
    /// </summary>
    [Route("api/restaurant/floor-plan")]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status401Unauthorized)]
    public class FloorPlanController : NeedAuthController
    {
        private const int MaxZoneNameLength = 40;
        private const double MinZoneSize = 2;
        private const double MaxZoneSize = 100;
        private const int MaxTableNameLength = 20;
        private const int MinCapacity = 1;
        private const int MaxCapacity = 50;
        private const double MinTableSize = 0.30;
        private const double MaxTableSize = 4.00;
        private const int MaxDecorLabelLength = 30;
        private const double MinDecorSize = 0.10;
        private const int MaxCombinationNameLength = 20;
        private const int MinCombinationCapacity = 1;
        private const int MaxCombinationCapacity = 100;

        public FloorPlanController(TuroDBContext context) : base(context)
        {
        }

        /// <summary>Le plan publié, celui du service : salles dans l'ordre des onglets</summary>
        [HttpGet]
        [ProducesResponseType<List<ZoneResponse>>(StatusCodes.Status200OK)]
        public async Task<IActionResult> GetFloorPlan()
        {
            return Ok(await LoadPublishedAsync());
        }

        [HttpPost("zones")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType<ZoneResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> AddZone(ZoneRequest request)
        {
            await CheckZone(request);

            int lastOrder = await context.Zones
                .Where(z => z.RestaurantId == CurrentRestaurantId)
                .MaxAsync(z => (int?)z.Order) ?? -1;

            Zone zone = new()
            {
                Id = Guid.NewGuid(),
                RestaurantId = CurrentRestaurantId,
                Name = request.Name.Trim(),
                Width = request.Width,
                Height = request.Height,
                Order = lastOrder + 1,
            };
            context.Zones.Add(zone);

            await context.SaveChangesAsync();
            await NotifyChangedAsync(DataScope.FloorPlan);
            return Ok(zone.ToResponse());
        }

        [HttpPut("zones/{id:guid}")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType<ZoneResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> UpdateZone([FromRoute] Guid id, [FromBody] ZoneRequest request)
        {
            Zone zone = await context.Zones
                .Include(z => z.Tables)
                .Include(z => z.Decors)
                .FirstOrDefaultAsync(z => z.Id == id && z.RestaurantId == CurrentRestaurantId)
                ?? throw new ApiErrorException(ApiError.NotFound, "Zone not found.");
            await CheckZone(request, zone);
            await CheckZoneContentFits(zone, request.Width, request.Height);

            zone.Name = request.Name.Trim();
            zone.Width = request.Width;
            zone.Height = request.Height;

            await context.SaveChangesAsync();
            await NotifyChangedAsync(DataScope.FloorPlan);
            return Ok(zone.ToResponse());
        }

        [HttpPut("zones/order")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType<List<ZoneResponse>>(StatusCodes.Status200OK)]
        public async Task<IActionResult> ReorderZones(ZoneOrderRequest request)
        {
            List<Zone> zones = await context.Zones
                .Where(z => z.RestaurantId == CurrentRestaurantId)
                .ToListAsync();

            bool sameSet = request.ZoneIds.Count == zones.Count
                && request.ZoneIds.Distinct().Count() == zones.Count
                && zones.All(z => request.ZoneIds.Contains(z.Id));
            if (!sameSet)
            {
                throw new ApiErrorException(ApiError.InvalidModification, "the new order must list every room exactly once.");
            }

            foreach (Zone zone in zones)
            {
                zone.Order = request.ZoneIds.IndexOf(zone.Id);
            }

            await context.SaveChangesAsync();
            await NotifyChangedAsync(DataScope.FloorPlan);
            return Ok(await LoadPublishedAsync());
        }

        /// <summary>Une salle qui a porté une table reste : les tables ne se suppriment jamais (MOD-01). Son décor part avec elle</summary>
        [HttpDelete("zones/{id:guid}")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType<ZoneResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> DeleteZone([FromRoute] Guid id)
        {
            Zone zone = await context.Zones
                .GetOrThrowAsync(z => z.Id == id && z.RestaurantId == CurrentRestaurantId);
            await CheckZoneIsEmpty(zone);

            // Le décor du brouillon part avec la salle, comme le décor publié (cascade) : sinon le brouillon
            // garderait un décor sans salle, qu'il ne pourrait plus enregistrer
            FloorPlanDraft? draft = await context.FloorPlanDrafts
                .FirstOrDefaultAsync(d => d.RestaurantId == CurrentRestaurantId);
            if (draft != null)
            {
                FloorPlanDraftContent content = draft.ReadContent();
                content.Decors.RemoveAll(d => d.ZoneId == zone.Id);
                draft.Content = JsonSerializer.Serialize(content, ModelWrapper.DraftJsonOptions);
            }

            context.Zones.Remove(zone);

            await context.SaveChangesAsync();
            await NotifyChangedAsync(DataScope.FloorPlan);
            return Ok(zone.ToResponse());
        }

        private async Task<List<ZoneResponse>> LoadPublishedAsync()
        {
            List<Zone> zones = await context.Zones
                .Where(z => z.RestaurantId == CurrentRestaurantId)
                .Include(z => z.Tables)
                .Include(z => z.Decors)
                .Include(z => z.Combinations).ThenInclude(c => c.Tables)
                .OrderBy(z => z.Order)
                .ToListAsync();

            return zones.Select(z => z.ToResponse()).ToList();
        }

        /// <param name="existing">La salle modifiée, null pour une création</param>
        private async Task CheckZone(ZoneRequest request, Zone? existing = null)
        {
            string name = request.Name?.Trim() ?? string.Empty;
            if (name.Length == 0)
            {
                throw new ApiErrorException(ApiError.InvalidModification, "a room needs a name.");
            }
            if (name.Length > MaxZoneNameLength)
            {
                throw new ApiErrorException(ApiError.InvalidModification, $"room {name}: name cannot exceed {MaxZoneNameLength} characters.");
            }
            if (request.Width < MinZoneSize || request.Width > MaxZoneSize
                || request.Height < MinZoneSize || request.Height > MaxZoneSize)
            {
                throw new ApiErrorException(ApiError.InvalidModification,
                    $"room {name}: width and depth must be between {MinZoneSize} and {MaxZoneSize} m.");
            }

            Guid? excludeId = existing?.Id;
            string lowered = name.ToLower();
            bool taken = await context.Zones.AnyAsync(z =>
                z.RestaurantId == CurrentRestaurantId
                && (!excludeId.HasValue || z.Id != excludeId.Value)
                && z.Name.ToLower() == lowered);
            if (taken)
            {
                throw new ApiErrorException(ApiError.InvalidModification, $"room {name}: another room already has this name.");
            }
        }

        /// <summary>Redimensionner ne doit laisser aucune table ni aucun décor, publié ou du brouillon, hors de la salle</summary>
        private async Task CheckZoneContentFits(Zone zone, double width, double height)
        {
            FloorPlanDraftContent? draft = await ReadDraftAsync();
            IEnumerable<(string Label, double X, double Y, double W, double H, double R)> items = zone.Tables
                .Where(t => t.IsActive)
                .Select(t => ($"table {t.Name}", t.X, t.Y, t.Width, t.Height, t.Rotation))
                .Concat(zone.Decors.Select(d => ($"decor {d.Label ?? d.Type.ToString()}", d.X, d.Y, d.Width, d.Height, d.Rotation)));
            if (draft != null)
            {
                items = items.Concat(draft.Tables
                    .Where(t => t.ZoneId == zone.Id)
                    .Select(t => ($"table {t.Name} (draft)", t.X, t.Y, t.Width, t.Height, t.Rotation)));
                items = items.Concat(draft.Decors
                    .Where(d => d.ZoneId == zone.Id)
                    .Select(d => ($"decor {d.Label ?? d.Type.ToString()} (draft)", d.X, d.Y, d.Width, d.Height, d.Rotation)));
            }

            List<string> outside = items
                .Where(i => !FloorPlanRules.FitsIn(i.X, i.Y, i.W, i.H, i.R, width, height))
                .Select(i => i.Label)
                .Distinct()
                .ToList();
            if (outside.Count > 0)
            {
                throw new ApiErrorException(ApiError.InvalidModification,
                    $"room {zone.Name}: these items would end up outside the room: {string.Join(", ", outside)}.");
            }
        }

        private async Task CheckZoneIsEmpty(Zone zone)
        {
            FloorPlanDraftContent? draft = await ReadDraftAsync();
            bool hasTable = await context.Tables.AnyAsync(t => t.ZoneId == zone.Id)
                || (draft?.Tables.Any(t => t.ZoneId == zone.Id) ?? false);
            if (hasTable)
            {
                throw new ApiErrorException(ApiError.InvalidModification,
                    $"room {zone.Name}: a room that has held a table cannot be deleted.");
            }

            // Une combinaison aux tables séparées garde sa salle d'origine : la cascade la supprimerait
            if (await context.Combinations.AnyAsync(c => c.ZoneId == zone.Id))
            {
                throw new ApiErrorException(ApiError.InvalidModification,
                    $"room {zone.Name}: a combination belongs to this room, it cannot be deleted.");
            }

            // La préférence d'une réservation, même ancienne, doit rester lisible
            if (await context.Reservations.AnyAsync(r => r.PreferredZoneId == zone.Id))
            {
                throw new ApiErrorException(ApiError.InvalidModification,
                    $"room {zone.Name}: some reservations ask for this room, it cannot be deleted.");
            }
        }

        private async Task<FloorPlanDraftContent?> ReadDraftAsync()
        {
            FloorPlanDraft? draft = await context.FloorPlanDrafts
                .FirstOrDefaultAsync(d => d.RestaurantId == CurrentRestaurantId);
            return draft?.ReadContent();
        }

        // ---- BROUILLON (EDIT-15 à EDIT-17) ----

        [HttpGet("draft")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType<FloorPlanDraftResponse>(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> GetDraft()
        {
            FloorPlanDraft? draft = await context.FloorPlanDrafts
                .FirstOrDefaultAsync(d => d.RestaurantId == CurrentRestaurantId);
            return draft == null ? NoContent() : Ok(draft.ToResponse());
        }

        /// <summary>Contrôle structurel seulement : un brouillon à moitié fait doit toujours s'enregistrer</summary>
        [HttpPut("draft")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType<FloorPlanDraftResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> SaveDraft(FloorPlanDraftContent request)
        {
            // Un décor dont la salle a été supprimée entre-temps part avec elle, il ne bloque pas l'enregistrement
            List<Guid> zoneIds = await context.Zones
                .Where(z => z.RestaurantId == CurrentRestaurantId)
                .Select(z => z.Id)
                .ToListAsync();
            request.Decors.RemoveAll(d => !zoneIds.Contains(d.ZoneId));

            await CheckDraftStructure(request);

            FloorPlanDraft? draft = await context.FloorPlanDrafts
                .FirstOrDefaultAsync(d => d.RestaurantId == CurrentRestaurantId);
            if (draft == null)
            {
                draft = new FloorPlanDraft { RestaurantId = CurrentRestaurantId };
                context.FloorPlanDrafts.Add(draft);
            }
            draft.Content = JsonSerializer.Serialize(request, ModelWrapper.DraftJsonOptions);
            draft.UpdatedAt = DateTime.UtcNow;
            draft.UpdatedById = CurrentUserId;

            // Pas de notification : le brouillon ne concerne pas le service (EDIT-17)
            await context.SaveChangesAsync();
            return Ok(draft.ToResponse());
        }

        [HttpDelete("draft")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> DiscardDraft()
        {
            FloorPlanDraft? draft = await context.FloorPlanDrafts
                .FirstOrDefaultAsync(d => d.RestaurantId == CurrentRestaurantId);
            if (draft != null)
            {
                context.FloorPlanDrafts.Remove(draft);
                await context.SaveChangesAsync();
            }
            return NoContent();
        }

        [HttpPost("publish")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType<List<ZoneResponse>>(StatusCodes.Status200OK)]
        public async Task<IActionResult> Publish()
        {
            FloorPlanDraft draft = await context.FloorPlanDrafts
                .GetOrThrowAsync(d => d.RestaurantId == CurrentRestaurantId, "no floor plan draft to publish.");
            FloorPlanDraftContent content = draft.ReadContent();

            await CheckDraftStructure(content);
            Dictionary<Guid, Zone> zones = await context.Zones
                .Where(z => z.RestaurantId == CurrentRestaurantId)
                .ToDictionaryAsync(z => z.Id);
            CheckPublishable(content, zones);

            Dictionary<Guid, Table> existing = await context.Tables
                .Where(t => t.Zone.RestaurantId == CurrentRestaurantId)
                .ToDictionaryAsync(t => t.Id);
            foreach (DraftTableItem item in content.Tables)
            {
                if (!existing.TryGetValue(item.Id, out Table? table))
                {
                    table = new Table { Id = item.Id, IsActive = true };
                    context.Tables.Add(table);
                    // les combinaisons nouvelles peuvent réunir des tables nouvelles
                    existing[item.Id] = table;
                }
                table.ZoneId = item.ZoneId;
                table.Name = item.Name.Trim();
                table.Capacity = item.Capacity;
                table.Shape = item.Shape;
                table.X = item.X;
                table.Y = item.Y;
                table.Width = item.Width;
                table.Height = item.Height;
                table.Rotation = item.Rotation;
            }

            // Le décor ne porte aucun historique : un décor publié absent du brouillon est supprimé
            List<Decor> existingDecors = await context.Decors
                .Where(d => d.Zone.RestaurantId == CurrentRestaurantId)
                .ToListAsync();
            HashSet<Guid> draftDecorIds = content.Decors.Select(d => d.Id).ToHashSet();
            context.Decors.RemoveRange(existingDecors.Where(d => !draftDecorIds.Contains(d.Id)));
            Dictionary<Guid, Decor> decorsById = existingDecors.ToDictionary(d => d.Id);
            foreach (DraftDecorItem item in content.Decors)
            {
                if (!decorsById.TryGetValue(item.Id, out Decor? decor))
                {
                    decor = new Decor { Id = item.Id };
                    context.Decors.Add(decor);
                }
                decor.ZoneId = item.ZoneId;
                decor.Type = item.Type;
                decor.Label = string.IsNullOrWhiteSpace(item.Label) ? null : item.Label.Trim();
                decor.X = item.X;
                decor.Y = item.Y;
                decor.Width = item.Width;
                decor.Height = item.Height;
                decor.Rotation = item.Rotation;
            }

            // Combinaisons : jamais supprimées ; l'éditeur décide de ce qui est collé en ce moment
            Dictionary<Guid, Combination> combinationsById = await context.Combinations
                .Include(c => c.Tables)
                .Where(c => c.Zone.RestaurantId == CurrentRestaurantId)
                .ToDictionaryAsync(c => c.Id);
            foreach (DraftCombinationItem item in content.Combinations)
            {
                List<Table> members = item.TableIds.Select(id => existing[id]).ToList();
                if (!combinationsById.TryGetValue(item.Id, out Combination? combination))
                {
                    combination = new Combination { Id = item.Id, ZoneId = members[0].ZoneId, IsActive = item.IsActive, Tables = members };
                    context.Combinations.Add(combination);
                }
                else if (combination.IsActive != item.IsActive)
                {
                    // Coller ou séparer dans l'éditeur annule le rapprochement ou la séparation que le service avait prévus
                    combination.IsActive = item.IsActive;
                    combination.ActivateAt = null;
                    combination.DeactivateAt = null;
                }
                combination.Name = item.Name.Trim();
                combination.Capacity = item.Capacity;
                // Tables dans plusieurs salles (forcément inactive) : elle garde sa salle d'origine
                if (members.All(t => t.ZoneId == members[0].ZoneId))
                {
                    combination.ZoneId = members[0].ZoneId;
                }
            }

            context.FloorPlanDrafts.Remove(draft);

            // Un seul SaveChanges : tout est publié, ou rien
            await context.SaveChangesAsync();
            await NotifyChangedAsync(DataScope.FloorPlan);
            return Ok(await LoadPublishedAsync());
        }

        private async Task CheckDraftStructure(FloorPlanDraftContent content)
        {
            HashSet<Guid> zoneIds = (await context.Zones
                .Where(z => z.RestaurantId == CurrentRestaurantId)
                .Select(z => z.Id)
                .ToListAsync()).ToHashSet();

            var published = await context.Tables
                .Where(t => t.Zone.RestaurantId == CurrentRestaurantId)
                .Select(t => new { t.Id, t.Name, t.IsActive })
                .ToListAsync();
            var publishedById = published.ToDictionary(t => t.Id);

            if (content.Tables.Select(t => t.Id).Distinct().Count() != content.Tables.Count)
            {
                throw new ApiErrorException(ApiError.InvalidModification, "the draft lists the same table twice.");
            }

            List<Guid> newIds = content.Tables.Select(t => t.Id).Where(id => !publishedById.ContainsKey(id)).ToList();
            if (newIds.Count > 0 && await context.Tables.AnyAsync(t => newIds.Contains(t.Id)))
            {
                throw new ApiErrorException(ApiError.InvalidModification, "the draft uses a table id that belongs elsewhere.");
            }

            foreach (DraftTableItem table in content.Tables)
            {
                if (!zoneIds.Contains(table.ZoneId))
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"table {table.Name}: unknown room.");
                }
                if (publishedById.TryGetValue(table.Id, out var known) && !known.IsActive)
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"table {table.Name}: a deactivated table cannot be edited.");
                }
            }

            HashSet<Guid> draftIds = content.Tables.Select(t => t.Id).ToHashSet();
            var removed = published.FirstOrDefault(t => t.IsActive && !draftIds.Contains(t.Id));
            if (removed != null)
            {
                throw new ApiErrorException(ApiError.InvalidModification, $"table {removed.Name}: a published table cannot be removed from the plan.");
            }

            if (content.Decors.Select(d => d.Id).Distinct().Count() != content.Decors.Count)
            {
                throw new ApiErrorException(ApiError.InvalidModification, "the draft lists the same decor twice.");
            }
            HashSet<Guid> ownDecorIds = (await context.Decors
                .Where(d => d.Zone.RestaurantId == CurrentRestaurantId)
                .Select(d => d.Id)
                .ToListAsync()).ToHashSet();
            List<Guid> newDecorIds = content.Decors.Select(d => d.Id).Where(id => !ownDecorIds.Contains(id)).ToList();
            if (newDecorIds.Count > 0 && await context.Decors.AnyAsync(d => newDecorIds.Contains(d.Id)))
            {
                throw new ApiErrorException(ApiError.InvalidModification, "the draft uses a decor id that belongs elsewhere.");
            }
            foreach (DraftDecorItem decor in content.Decors)
            {
                if (!zoneIds.Contains(decor.ZoneId))
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"decor {decor.Label ?? decor.Type.ToString()}: unknown room.");
                }
            }

            var publishedCombinations = await context.Combinations
                .Where(c => c.Zone.RestaurantId == CurrentRestaurantId)
                .Select(c => new { c.Id, c.Name, TableIds = c.Tables.Select(t => t.Id).ToList() })
                .ToListAsync();
            if (content.Combinations.Select(c => c.Id).Distinct().Count() != content.Combinations.Count)
            {
                throw new ApiErrorException(ApiError.InvalidModification, "the draft lists the same combination twice.");
            }
            HashSet<Guid> publishedCombinationIds = publishedCombinations.Select(c => c.Id).ToHashSet();
            List<Guid> newCombinationIds = content.Combinations.Select(c => c.Id).Where(id => !publishedCombinationIds.Contains(id)).ToList();
            if (newCombinationIds.Count > 0 && await context.Combinations.AnyAsync(c => newCombinationIds.Contains(c.Id)))
            {
                throw new ApiErrorException(ApiError.InvalidModification, "the draft uses a combination id that belongs elsewhere.");
            }
            foreach (DraftCombinationItem combination in content.Combinations)
            {
                if (combination.TableIds.Count < 2 || combination.TableIds.Distinct().Count() != combination.TableIds.Count
                    || !combination.TableIds.All(draftIds.Contains))
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"combination {combination.Name}: it must join at least two different tables of the plan.");
                }
                var known = publishedCombinations.FirstOrDefault(c => c.Id == combination.Id);
                if (known != null && !known.TableIds.ToHashSet().SetEquals(combination.TableIds))
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"combination {combination.Name}: the tables of a published combination cannot change.");
                }
            }
            var removedCombination = publishedCombinations.FirstOrDefault(c => !content.Combinations.Any(d => d.Id == c.Id));
            if (removedCombination != null)
            {
                throw new ApiErrorException(ApiError.InvalidModification, $"combination {removedCombination.Name}: a published combination cannot be removed from the plan.");
            }
            var sameTables = content.Combinations
                .GroupBy(c => string.Join("|", c.TableIds.OrderBy(id => id)))
                .FirstOrDefault(g => g.Count() > 1);
            if (sameTables != null)
            {
                throw new ApiErrorException(ApiError.InvalidModification, $"combination {sameTables.First().Name}: another combination already joins these tables.");
            }
        }

        private static void CheckPublishable(FloorPlanDraftContent content, Dictionary<Guid, Zone> zones)
        {
            foreach (DraftTableItem table in content.Tables)
            {
                string name = table.Name?.Trim() ?? string.Empty;
                string label = $"table {(name.Length == 0 ? "sans nom" : name)}";
                if (name.Length == 0)
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: a table needs a name.");
                }
                if (name.Length > MaxTableNameLength)
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: name cannot exceed {MaxTableNameLength} characters.");
                }
                if (!Enum.IsDefined(table.Shape))
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: unknown shape.");
                }
                if (table.Capacity < MinCapacity || table.Capacity > MaxCapacity)
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: seats must be between {MinCapacity} and {MaxCapacity}.");
                }
                if (table.Width < MinTableSize || table.Width > MaxTableSize || table.Height < MinTableSize || table.Height > MaxTableSize)
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: width and depth must be between {MinTableSize} and {MaxTableSize} m.");
                }
                if (table.Shape == TableShape.Round && !FloorPlanRules.AreEqual(table.Width, table.Height))
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: a round table must be as wide as it is deep.");
                }
                if (!FloorPlanRules.IsValidRotation(table.Rotation))
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: rotation must be a multiple of {FloorPlanRules.RotationStep} degrees in [0, 360).");
                }
                Zone zone = zones[table.ZoneId];
                if (!FloorPlanRules.FitsIn(table.X, table.Y, table.Width, table.Height, table.Rotation, zone.Width, zone.Height))
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: the table goes beyond room {zone.Name}.");
                }
            }

            foreach (DraftCombinationItem combination in content.Combinations)
            {
                string name = combination.Name?.Trim() ?? string.Empty;
                string label = $"combination {(name.Length == 0 ? "sans nom" : name)}";
                if (name.Length == 0)
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: a combination needs a name.");
                }
                if (name.Length > MaxCombinationNameLength)
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: name cannot exceed {MaxCombinationNameLength} characters.");
                }
                if (combination.Capacity < MinCombinationCapacity || combination.Capacity > MaxCombinationCapacity)
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: seats must be between {MinCombinationCapacity} and {MaxCombinationCapacity}.");
                }
            }

            // Une combinaison active, ce sont des tables collées en ce moment : toutes dans une salle, et chacune dans une seule (§3.4)
            Dictionary<Guid, DraftTableItem> tablesById = content.Tables.ToDictionary(t => t.Id);
            List<DraftCombinationItem> active = content.Combinations.Where(c => c.IsActive).ToList();
            foreach (DraftCombinationItem combination in active)
            {
                if (combination.TableIds.Select(id => tablesById[id].ZoneId).Distinct().Count() > 1)
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"combination {combination.Name.Trim()}: an active combination needs all its tables in the same room.");
                }
            }
            var shared = active.SelectMany(c => c.TableIds).GroupBy(id => id).FirstOrDefault(g => g.Count() > 1);
            if (shared != null)
            {
                throw new ApiErrorException(ApiError.InvalidModification, $"table {tablesById[shared.Key].Name.Trim()}: it belongs to two active combinations.");
            }

            // Toutes les tables actives et toutes les combinaisons sont dans le brouillon : l'unicité se vérifie sur lui seul.
            // Une réservation affiche une table ou une combinaison : un nom ne désigne qu'une seule chose
            var duplicate = content.Tables.Select(t => t.Name)
                .Concat(content.Combinations.Select(c => c.Name))
                .GroupBy(n => n.Trim().ToLowerInvariant())
                .FirstOrDefault(g => g.Count() > 1);
            if (duplicate != null)
            {
                throw new ApiErrorException(ApiError.InvalidModification, $"name {duplicate.First().Trim()}: another table or combination already has this name.");
            }

            foreach (DraftDecorItem decor in content.Decors)
            {
                string label = $"decor {decor.Label?.Trim() ?? decor.Type.ToString()}";
                Zone zone = zones[decor.ZoneId];
                if (!Enum.IsDefined(decor.Type))
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: unknown decor type.");
                }
                if (decor.Label?.Trim().Length > MaxDecorLabelLength)
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: label cannot exceed {MaxDecorLabelLength} characters.");
                }
                if (decor.Width < MinDecorSize || decor.Height < MinDecorSize || decor.Width > zone.Width || decor.Height > zone.Height)
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: size must be between {MinDecorSize} m and the room size.");
                }
                if (!FloorPlanRules.IsValidRotation(decor.Rotation))
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: rotation must be a multiple of {FloorPlanRules.RotationStep} degrees in [0, 360).");
                }
                if (!FloorPlanRules.FitsIn(decor.X, decor.Y, decor.Width, decor.Height, decor.Rotation, zone.Width, zone.Height))
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"{label}: the decor goes beyond room {zone.Name}.");
                }
            }
        }
    }
}
