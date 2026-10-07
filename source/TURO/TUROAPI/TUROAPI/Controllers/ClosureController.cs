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
    /// <summary>
    /// Horaires exceptionnels : fermetures et horaires modifiés (§9.3, §9.5, §9.7)
    /// </summary>
    [Route("api/restaurant/closures")]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status401Unauthorized)]
    public class ClosureController : NeedAuthController
    {
        private const int MaxClosureDays = 366;
        private const int MaxReasonDetailLength = 500;
        private const int MaxCustomerMessageLength = 2000;

        public ClosureController(TuroDBContext context) : base(context)
        {
        }

        [HttpGet]
        [ProducesResponseType<List<ClosureResponse>>(StatusCodes.Status200OK)]
        public async Task<IActionResult> GetClosures()
        {
            List<Closure> closures = await context.Closures
                .Where(c => c.RestaurantId == CurrentRestaurantId)
                .OrderBy(c => c.From)
                .ToListAsync();

            return Ok(closures.Select(c => c.ToResponse()).ToList());
        }

        /// <summary>
        /// Réservations actives que cette fermeture laisserait sans service, à confronter avant d'enregistrer (§9.5)
        /// </summary>
        [HttpPost("impact")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType<List<ImpactedReservationResponse>>(StatusCodes.Status200OK)]
        public async Task<IActionResult> GetImpact(AddOrUpdateClosureRequest request)
        {
            var impacted = await GetImpactedReservations(request, withDetails: true);
            return Ok(impacted.Select(x => x.ToImpactedResponse()).ToList());
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType<ClosureResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> AddClosure(AddOrUpdateClosureRequest request)
        {
            await CheckModificationValidity(request);

            Closure closure = new()
            {
                Id = Guid.NewGuid(),
                RestaurantId = CurrentRestaurantId
            };
            Apply(closure, request);
            context.Closures.Add(closure);

            await CancelImpactedReservations(request);

            await context.SaveChangesAsync();
            await NotifyChangedAsync(DataScope.Closures);
            return Ok(closure.ToResponse());
        }

        [HttpPut("{id:guid}")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType<ClosureResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> UpdateClosure([FromRoute] Guid id, [FromBody] AddOrUpdateClosureRequest request)
        {
            Closure closure = await context.Closures
                .GetOrThrowAsync(c => c.Id == id && c.RestaurantId == CurrentRestaurantId);
            await CheckModificationValidity(request, closure);

            Apply(closure, request);
            await CancelImpactedReservations(request);

            await context.SaveChangesAsync();
            await NotifyChangedAsync(DataScope.Closures);
            return Ok(closure.ToResponse());
        }

        /// <summary>
        /// Rouvre les jours concernés. Les réservations annulées par la fermeture le restent
        /// </summary>
        [HttpDelete("{id:guid}")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType<ClosureResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> DeleteClosure([FromRoute] Guid id)
        {
            Closure closure = await context.Closures
                .GetOrThrowAsync(c => c.Id == id && c.RestaurantId == CurrentRestaurantId);

            context.Closures.Remove(closure);

            await context.SaveChangesAsync();
            await NotifyChangedAsync(DataScope.Closures);
            return Ok(closure.ToResponse());
        }

        private static void Apply(Closure closure, AddOrUpdateClosureRequest request)
        {
            closure.From = request.From;
            closure.To = request.To;
            closure.Type = request.Type;
            closure.ReplacementHours = request.Type == ClosureType.ModifiedHours
                ? request.ReplacementHours!
                    .Select(h => new ReplacementHours { Opening = h.Opening, Closing = h.Closing })
                    .OrderBy(h => h.Opening)
                    .ToList()
                : null;
            closure.Reason = request.Reason;
            closure.ReasonDetail = string.IsNullOrWhiteSpace(request.ReasonDetail) ? null : request.ReasonDetail.Trim();
            closure.CustomerMessage = string.IsNullOrWhiteSpace(request.CustomerMessage) ? null : request.CustomerMessage.Trim();
        }

        /// <param name="existing">La fermeture modifiée, null pour une création</param>
        private async Task CheckModificationValidity(AddOrUpdateClosureRequest request, Closure? existing = null)
        {
            if (!Enum.IsDefined(request.Type) || !Enum.IsDefined(request.Reason))
            {
                throw new ApiErrorException(ApiError.InvalidModification, "unknown closure type or reason.");
            }

            if (request.To < request.From)
            {
                throw new ApiErrorException(ApiError.InvalidModification, "the last day must not be before the first day.");
            }

            if (request.To.DayNumber - request.From.DayNumber + 1 > MaxClosureDays)
            {
                throw new ApiErrorException(ApiError.InvalidModification, $"a closure cannot exceed {MaxClosureDays} days.");
            }

            TimeZoneInfo timeZone = await ReservationImpact.GetTimeZoneAsync(context, CurrentRestaurantId);
            DateOnly today = ReservationImpact.Today(timeZone);

            // Une fermeture déjà commencée garde son premier jour ; on ne prévoit rien dans le passé
            bool keepsStartedFrom = existing != null && existing.From == request.From;
            if (request.To < today || (request.From < today && !keepsStartedFrom))
            {
                throw new ApiErrorException(ApiError.InvalidModification, "a closure cannot be planned in the past.");
            }

            if (request.Type == ClosureType.ModifiedHours)
            {
                CheckReplacementHours(request.ReplacementHours);
            }

            if (request.ReasonDetail?.Length > MaxReasonDetailLength)
            {
                throw new ApiErrorException(ApiError.InvalidModification, $"reason detail cannot exceed {MaxReasonDetailLength} characters.");
            }

            if (request.CustomerMessage?.Length > MaxCustomerMessageLength)
            {
                throw new ApiErrorException(ApiError.InvalidModification, $"customer message cannot exceed {MaxCustomerMessageLength} characters.");
            }

            Guid? excludeId = existing?.Id;
            Closure? overlapping = await context.Closures
                .Where(c =>
                    c.RestaurantId == CurrentRestaurantId
                    && (!excludeId.HasValue || c.Id != excludeId.Value)
                    && c.From <= request.To && c.To >= request.From)
                .FirstOrDefaultAsync();

            if (overlapping != null)
            {
                throw new ApiErrorException(ApiError.InvalidModification,
                    $"these days overlap another exceptional closure ({overlapping.From:yyyy-MM-dd} - {overlapping.To:yyyy-MM-dd}).");
            }
        }

        private static void CheckReplacementHours(List<ReplacementHoursRequest>? hours)
        {
            if (hours == null || hours.Count == 0)
            {
                throw new ApiErrorException(ApiError.InvalidModification, "modified hours need at least one opening slot.");
            }

            if (hours.Any(h => h.Opening == h.Closing))
            {
                throw new ApiErrorException(ApiError.InvalidModification, "an opening slot cannot start and end at the same time.");
            }

            // TimeOnly.IsBetween gère les plages qui passent minuit (fin exclue)
            for (int i = 0; i < hours.Count; i++)
            {
                for (int j = i + 1; j < hours.Count; j++)
                {
                    if (hours[i].Opening.IsBetween(hours[j].Opening, hours[j].Closing)
                        || hours[j].Opening.IsBetween(hours[i].Opening, hours[i].Closing))
                    {
                        throw new ApiErrorException(ApiError.InvalidModification, "replacement opening slots overlap.");
                    }
                }
            }
        }

        /// <summary>
        /// Une fermeture touche toutes les réservations actives de ses jours ; des horaires modifiés,
        /// celles qui commencent hors des nouvelles plages
        /// </summary>
        private async Task<List<ReservationImpact.LocalReservation>> GetImpactedReservations(AddOrUpdateClosureRequest request, bool withDetails = false)
        {
            TimeZoneInfo timeZone = await ReservationImpact.GetTimeZoneAsync(context, CurrentRestaurantId);
            var active = await ReservationImpact.ActiveAsync(
                context, CurrentRestaurantId, timeZone, request.From, request.To, withDetails);

            if (request.Type == ClosureType.Closed)
            {
                return active;
            }

            List<ReplacementHoursRequest> hours = request.ReplacementHours ?? [];
            return active
                .Where(x => !hours.Any(h => x.LocalStart.IsBetween(h.Opening, h.Closing)))
                .ToList();
        }

        /// <summary>
        /// Refuse l'enregistrement si une réservation impactée n'a pas été montrée au restaurant (prise entre-temps),
        /// sinon annule celles qu'il a acceptées d'annuler. annule_par = restaurant : aucun compteur client ne bouge (§9.5)
        /// </summary>
        private async Task CancelImpactedReservations(AddOrUpdateClosureRequest request)
        {
            var impacted = await GetImpactedReservations(request);
            HashSet<Guid> accepted = request.CancelledReservationIds.ToHashSet();

            var notAccepted = impacted.Where(x => !accepted.Contains(x.Reservation.Id)).ToList();
            if (notAccepted.Count > 0)
            {
                throw new ApiErrorException(ApiError.ClosureImpactsReservations,
                    notAccepted.Count.ToString(), notAccepted.Sum(x => x.Reservation.Covers).ToString());
            }

            DateTime now = DateTime.UtcNow;
            foreach (Reservation reservation in impacted.Select(x => x.Reservation))
            {
                reservation.Status = ReservationStatus.Cancelled;
                reservation.CancelledAt = now;
                reservation.CancelledBy = CancelledBy.Restaurant;

                context.EventLogs.Add(new EventLog
                {
                    Id = Guid.NewGuid(),
                    ReservationId = reservation.Id,
                    Timestamp = now,
                    Type = EventType.Cancellation,
                    AuthorId = CurrentUserId,
                    Details = request.Type == ClosureType.Closed
                        ? "Fermeture exceptionnelle"
                        : "Horaires exceptionnels modifiés"
                });
            }
        }
    }
}
