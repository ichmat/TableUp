using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
    [Route("api/restaurant/settings")]
    [Authorize(Roles = "Admin")]
    public class SettingsController : NeedAuthController
    {
        public SettingsController(TuroDBContext context) : base(context)
        {
        }

        [HttpPost("service")]
        [ProducesResponseType<ServiceResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> AddService(AddOrUpdateServiceRequest request)
        {
            await CheckModificationValidity(request);

            Service service = new()
            {
                Id = Guid.NewGuid(),
                RestaurantId = CurrentRestaurantId,
                Day = request.Day,
                Opening = request.Opening,
                Closing = request.Closing,
                SlotStep = request.SlotStep,
                OccupancyMode = request.OccupancyMode,
                ExpectedDuration = request.ExpectedDuration,
                MaxCadence = request.MaxCadence,
                CoverCap = request.CoverCap
            };

            context.Services.Add(service);
            await context.SaveChangesAsync();
            await NotifyChangedAsync(DataScope.Restaurant);
            return Ok(service.ToResponse());
        }

        [HttpPut("service/{id:guid}")]
        [ProducesResponseType<ServiceResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> UpdateService([FromRoute] Guid id, [FromBody] AddOrUpdateServiceRequest request)
        {
            Service service = await context.Services
                .GetOrThrowAsync(x => x.Id == id && x.RestaurantId == CurrentRestaurantId);
            await CheckModificationValidity(request, service);

            service.Opening = request.Opening;
            service.Closing = request.Closing;
            service.SlotStep = request.SlotStep;
            service.OccupancyMode = request.OccupancyMode;
            service.ExpectedDuration = request.ExpectedDuration;
            service.MaxCadence = request.MaxCadence;
            service.CoverCap = request.CoverCap;

            await context.SaveChangesAsync();
            await NotifyChangedAsync(DataScope.Restaurant);
            return Ok(service.ToResponse());
        }

        [HttpDelete("service/{id:guid}")]
        [ProducesResponseType<ServiceResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> DeleteService([FromRoute] Guid id)
        {
            Service service = await context.Services
                .GetOrThrowAsync(x => x.Id == id && x.RestaurantId == CurrentRestaurantId);
            await CheckImpactedReservations(service);

            context.Services.Remove(service);

            await context.SaveChangesAsync();
            await NotifyChangedAsync(DataScope.Restaurant);
            return Ok(service.ToResponse());
        }

        [HttpPut("placement")]
        [ProducesResponseType<RestaurantReponses>(StatusCodes.Status200OK)]
        public async Task<IActionResult> UpdatePlacement(PlacementSettingsRequest request)
        {
            CheckRange(request.DefaultRotation, MinRotation, MaxRotation, "default rotation (minutes)");
            if (request.DefaultRotation % RotationStep != 0)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, $"default rotation must be a multiple of {RotationStep} minutes.");
            }
            CheckRange(request.SeatTolerance, MinSeatTolerance, MaxSeatTolerance, "seat tolerance");
            CheckRange(request.LateGrace, 0, MaxLateGrace, "late grace (minutes)");

            Restaurant restaurant = await LoadRestaurantAsync();
            // PAR-09 : les réservations gardent la durée reçue à leur création, les services leur durée propre
            restaurant.DefaultRotation = request.DefaultRotation;
            restaurant.SeatTolerance = request.SeatTolerance;
            restaurant.LateGrace = request.LateGrace;
            restaurant.SuggestCombinations = request.SuggestCombinations;
            // Désactiver ne vide pas les tables déjà marquées : elles sont ignorées, et reviennent si on réactive
            restaurant.TrackTableCleaning = request.TrackTableCleaning;

            await context.SaveChangesAsync();
            await NotifyChangedAsync(DataScope.Restaurant);
            return Ok(restaurant.ToResponse());
        }

        [HttpPut("booking-window")]
        [ProducesResponseType<RestaurantReponses>(StatusCodes.Status200OK)]
        public async Task<IActionResult> UpdateBookingWindow(BookingWindowRequest request)
        {
            CheckRange(request.MinNoticeMinutes, 0, MaxMinNotice, "minimum notice (minutes)");
            CheckRange(request.HorizonDays, MinHorizon, MaxHorizon, "booking horizon (days)");

            Restaurant restaurant = await LoadRestaurantAsync();
            restaurant.MinBookingNoticeMinutes = request.MinNoticeMinutes;
            restaurant.BookingHorizonDays = request.HorizonDays;

            await context.SaveChangesAsync();
            await NotifyChangedAsync(DataScope.Restaurant);
            return Ok(restaurant.ToResponse());
        }

        /// <summary>
        /// L'aperçu de tolerance_places sur les vraies tables (PAR-08). La tolérance vient de la requête : l'écran montre
        /// l'effet d'une valeur avant de l'enregistrer. Une combinaison active est collée : elle se place comme une table
        /// </summary>
        [HttpGet("placement/preview")]
        [ProducesResponseType<List<PlacementPreviewItemResponse>>(StatusCodes.Status200OK)]
        public async Task<IActionResult> PreviewPlacement([FromQuery] int covers, [FromQuery] int tolerance)
        {
            CheckRange(covers, MinPreviewCovers, MaxPreviewCovers, "covers");
            CheckRange(tolerance, MinSeatTolerance, MaxSeatTolerance, "seat tolerance");

            var tables = await context.Tables
                .Where(t => t.Zone.RestaurantId == CurrentRestaurantId && t.IsActive)
                .Select(t => new { t.Id, t.Name, t.Capacity, Kind = PlacementEntityKind.Table })
                .ToListAsync();
            var combinations = await context.Combinations
                .Where(c => c.Zone.RestaurantId == CurrentRestaurantId && c.IsActive)
                .Select(c => new { c.Id, c.Name, c.Capacity, Kind = PlacementEntityKind.Combination })
                .ToListAsync();

            // Tri en mémoire, ordinal : le même ordre quelle que soit la collation de la base
            return Ok(tables.Concat(combinations)
                .OrderBy(e => e.Capacity)
                .ThenBy(e => e.Name, StringComparer.Ordinal)
                .Select(e => new PlacementPreviewItemResponse
                {
                    Id = e.Id,
                    Name = e.Name,
                    Capacity = e.Capacity,
                    Kind = e.Kind,
                    Fit = PlacementVerdict.Of(covers, e.Capacity, tolerance),
                })
                .ToList());
        }

        private async Task<Restaurant> LoadRestaurantAsync() =>
            await context.Restaurants.WithFullInfo().FirstOrDefaultAsync(r => r.Id == CurrentRestaurantId)
            ?? throw new ApiErrorException(ApiError.CriticalDataInternalError, $"Restaurant of user {CurrentUserId} not found");

        private static void CheckRange(int value, int min, int max, string what)
        {
            if (value < min || value > max)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, $"{what} must be between {min} and {max}.");
            }
        }

        // Bornes de Paramètres › Placement et Règles de réservation (miroir front : PLACEMENT_LIMITS)
        private const int MinRotation = 30;
        private const int MaxRotation = 6 * 60;
        private const int RotationStep = 15;
        private const int MinSeatTolerance = 1;
        private const int MaxSeatTolerance = 20;
        private const int MinPreviewCovers = 1;
        private const int MaxPreviewCovers = 50;
        private const int MaxLateGrace = 2 * 60;
        private const int MaxMinNotice = 48 * 60;
        private const int MinHorizon = 1;
        private const int MaxHorizon = 365;

        /// <param name="existing">Le service modifié, null pour une création</param>
        private async Task CheckModificationValidity(AddOrUpdateServiceRequest request, Service? existing = null)
        {
            // Le jour d'un service existant n'est pas modifiable (UpdateService ne le reporte pas)
            DayOfWeek day = existing?.Day ?? request.Day;
            Guid? excludeId = existing?.Id;

            // Finalement non parce que le service peut être ouvert toute la nuit,
            // donc on ne peut pas vérifier que l'heure de fermeture est après l'heure d'ouverture
            //if (request.Closing <= request.Opening)
            //{
            //    throw new ApiErrorException(ApiError.InvalidModification, "closing time must be after opening time.");
            //}

            CheckSlotSettings(request);

            // Comparées sur la semaine : un service qui passe minuit occupe aussi le début du lendemain
            (int Start, int End) span = WeeklyHours.SpanOf(day, request.Opening, request.Closing);
            List<Service> others = await context.Services
                .Where(s => s.RestaurantId == CurrentRestaurantId && (!excludeId.HasValue || s.Id != excludeId.Value))
                .AsNoTracking()
                .ToListAsync();
            Service? conflictServices = others.FirstOrDefault(s => WeeklyHours.Overlap(span, WeeklyHours.SpanOf(s.Day, s.Opening, s.Closing)));

            if (conflictServices != null)
            {
                throw new ApiErrorException(ApiError.InvalidModification,
                    "service time conflicts with existing service. " + Environment.NewLine +
                    $"Conflicting service: {conflictServices.Opening.ToShortTimeString()} - {conflictServices.Closing.ToShortTimeString()}" + Environment.NewLine +
                    $"Current service: {request.Opening.ToShortTimeString()} - {request.Closing.ToShortTimeString()}");
            }

            // Une création n'ôte aucun horaire : elle ne peut pas laisser de réservation hors service
            if (existing != null)
            {
                await CheckImpactedReservations(existing, request);
            }
        }

        /// <summary>
        /// Réglages de créneaux d'un service (§9.4) : pas de la frise, durée prévue et avertissements de cuisine
        /// </summary>
        private static void CheckSlotSettings(AddOrUpdateServiceRequest request)
        {
            // PAR-04 : la frise ne connaît que ces deux densités
            if (!AllowedSlotSteps.Contains(request.SlotStep))
            {
                throw new ApiErrorException(ApiError.InvalidModification, "slot step must be 15 or 30 minutes.");
            }

            if (!Enum.IsDefined(request.OccupancyMode))
            {
                throw new ApiErrorException(ApiError.InvalidModification, "unknown occupancy mode.");
            }

            // Null hérite de Restaurant.DefaultRotation (PAR-06)
            if (request.ExpectedDuration is <= 0 or > MaxExpectedDuration)
            {
                throw new ApiErrorException(ApiError.InvalidModification, $"expected duration must be between 1 and {MaxExpectedDuration} minutes.");
            }

            // Null désactive l'avertissement (PAR-07)
            if (request.MaxCadence is <= 0 || request.CoverCap is <= 0)
            {
                throw new ApiErrorException(ApiError.InvalidModification, "kitchen warning thresholds must be positive.");
            }
        }

        private static readonly int[] AllowedSlotSteps = [15, 30];

        // Une journée : au-delà, la durée n'a plus de sens pour un repas
        private const int MaxExpectedDuration = 24 * 60;

        /// <summary>
        /// Refuse la modification si des réservations actives, prises dans les horaires actuels du service,
        /// tomberaient hors des nouveaux horaires 
        /// </summary>
        private async Task CheckImpactedReservations(Service existing, AddOrUpdateServiceRequest? request = null)
        {
            TimeZoneInfo timeZone = await ReservationImpact.GetTimeZoneAsync(context, CurrentRestaurantId);
            var activeReservations = await ReservationImpact.ActiveAsync(
                context, CurrentRestaurantId, timeZone, ReservationImpact.Today(timeZone));

            // TimeOnly.IsBetween gère les services qui passent minuit (fin exclue)
            var impacted = activeReservations
                .Where(x => x.Reservation.ServiceDay.DayOfWeek == existing.Day)
                // Sans nouveaux horaires (suppression), toute réservation du service est impactée
                .Where(x => x.LocalStart.IsBetween(existing.Opening, existing.Closing)
                    && (request == null || !x.LocalStart.IsBetween(request.Opening, request.Closing)))
                .Select(x => x.Reservation)
                .ToList();

            if (impacted.Count > 0)
            {
                throw new ApiErrorException(ApiError.ReservationsImpacted,
                    impacted.Count.ToString(), impacted.Sum(r => r.Covers).ToString());
            }
        }
    }
}
