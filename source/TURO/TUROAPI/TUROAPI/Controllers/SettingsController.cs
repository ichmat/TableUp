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

            var conflictServices = await context.Services
                .Where(s =>
                    s.RestaurantId == CurrentRestaurantId && s.Day == day
                    && (!excludeId.HasValue || s.Id != excludeId.Value)
                    && (
                        (request.Opening >= s.Opening && request.Opening < s.Closing) ||
                        (request.Closing > s.Opening && request.Closing <= s.Closing) ||
                        (request.Opening <= s.Opening && request.Closing >= s.Closing))
                    )
                .FirstOrDefaultAsync();

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
