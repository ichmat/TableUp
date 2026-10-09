using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TUROAPI.Context;
using TUROAPI.Controllers.Base;
using TUROAPI.Models;
using TUROAPI.Models.Enums;
using TUROAPI.Models.Requests;
using TUROAPI.Models.Responses;
using TUROAPI.Models.Wrapper;
using TUROAPI.Services;
using Window = TUROAPI.Services.ReservationClock.Window;

namespace TUROAPI.Controllers
{
    /// <summary>
    /// L'écran Service (§5) : un service, l'état de chaque table à chaque heure, et le geste « Nettoyée ».
    /// Les deux rôles y ont accès (§4.7)
    /// </summary>
    [Route("api/service")]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status401Unauthorized)]
    public class ServiceController : NeedAuthController
    {
        // Ce qui compte dans les couverts attendus d'un service
        private static readonly ReservationStatus[] Counted = [ReservationStatus.Confirmed, ReservationStatus.Seated, ReservationStatus.Finished];
        // ALRG : une allergie compte tant que le convive peut encore venir ou est à table
        private static readonly ReservationStatus[] WithAllergies = [ReservationStatus.Pending, ReservationStatus.Confirmed, ReservationStatus.Seated];

        public ServiceController(TuroDBContext context) : base(context)
        {
        }

        /// <summary>
        /// Sans paramètre : le service par défaut (§4.3). `focus` : le service de cette réservation.
        /// `day` + `opening` : cette plage. `day` seul : la plage du jour (§4.3)
        /// </summary>
        [HttpGet]
        [ProducesResponseType<ServiceSnapshotResponse>(StatusCodes.Status200OK)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetService([FromQuery] DateOnly? day, [FromQuery] TimeOnly? opening, [FromQuery] Guid? focus)
        {
            Restaurant restaurant = await context.Restaurants.Include(r => r.Services).AsNoTracking().FirstAsync(r => r.Id == CurrentRestaurantId);
            TimeZoneInfo timeZone = TimeZoneInfo.FindSystemTimeZoneById(restaurant.TimeZone);
            List<Closure> closures = await context.Closures.Where(c => c.RestaurantId == CurrentRestaurantId).AsNoTracking().ToListAsync();
            List<Window> WindowsOf(DateOnly d) => ReservationClock.WindowsOf(d, restaurant.Services, closures, restaurant.DefaultRotation);
            DateTime now = DateTime.UtcNow;
            DateOnly today = ReservationImpact.Today(timeZone);

            ServiceView.Choice? byDefault = ServiceView.DefaultService(now, timeZone, WindowsOf);
            ServiceView.Choice? chosen = null;
            if (opening is TimeOnly time)
            {
                DateOnly d = day ?? today;
                Window window = WindowsOf(d).FirstOrDefault(w => w.Opening == time)
                    ?? throw new ApiErrorException(ApiError.NotFound, $"No service opens at {time:HH:mm} on {d:yyyy-MM-dd}.");
                chosen = new ServiceView.Choice(d, window);
            }
            else if (focus is Guid focusId
                && await context.Reservations.Where(r => r.Id == focusId && r.RestaurantId == CurrentRestaurantId)
                    .Select(r => new { r.ServiceDay, r.Start }).FirstOrDefaultAsync() is { } focused
                && ReservationClock.WindowAt(WindowsOf(focused.ServiceDay), ReservationClock.LocalTime(focused.Start, timeZone)) is Window ofFocus)
            {
                chosen = new ServiceView.Choice(focused.ServiceDay, ofFocus);
            }
            else if (day is DateOnly d && ServiceView.WindowOfDay(d, WindowsOf(d), now, timeZone) is Window ofChosenDay)
            {
                chosen = new ServiceView.Choice(d, ofChosenDay);
            }
            else if (day == null)
            {
                chosen = byDefault;
            }
            DateOnly shown = chosen?.Day ?? day ?? today;
            List<Window> windows = WindowsOf(shown);

            List<Zone> zones = await context.Zones
                .Where(z => z.RestaurantId == CurrentRestaurantId)
                .Include(z => z.Tables)
                .Include(z => z.Decors)
                .Include(z => z.Combinations).ThenInclude(c => c.Tables)
                .OrderBy(z => z.Order)
                .AsSplitQuery()
                .AsNoTracking()
                .ToListAsync();
            HashSet<Guid> activeTables = zones.SelectMany(z => z.Tables).Where(t => t.IsActive).Select(t => t.Id).ToHashSet();

            List<Reservation> ofDay = await context.Reservations
                .Where(r => r.RestaurantId == CurrentRestaurantId && r.ServiceDay == shown)
                .Include(r => r.Client)
                .Include(r => r.Assignments).ThenInclude(a => a.Table)
                .Include(r => r.Assignments).ThenInclude(a => a.Combination).ThenInclude(c => c!.Tables)
                .AsSplitQuery()
                .AsNoTracking()
                .ToListAsync();

            var response = new ServiceSnapshotResponse
            {
                Day = shown,
                Now = now,
                TrackTableCleaning = restaurant.TrackTableCleaning,
                LateGrace = restaurant.LateGrace,
                IsDefault = chosen == byDefault,
                Windows = windows.Select(w => new ServiceWindowStateResponse
                {
                    Opening = w.Opening,
                    Closing = w.Closing,
                    State = ServiceView.StateOf(ServiceView.BoundsOf(shown, w, timeZone), now),
                    ExpectedCovers = ofDay
                        .Where(r => Counted.Contains(r.Status) && ServiceView.BelongsTo(r, new ServiceView.Choice(shown, w), windows, timeZone))
                        .Sum(r => r.Covers),
                }).ToList(),
            };

            List<ServiceView.Booking> bookings = chosen == null ? [] : ofDay
                .Where(r => ServiceView.BelongsTo(r, chosen, windows, timeZone))
                .OrderBy(r => r.Start).ThenBy(r => r.Client?.Name)
                .Select(r =>
                {
                    Assignment? assignment = r.LatestAssignment();
                    IEnumerable<Table> held = assignment?.Table is Table table ? [table] : assignment?.Combination?.Tables ?? [];
                    return new ServiceView.Booking(r, ServiceView.OccupationOf(r, now), assignment != null,
                        held.Select(t => t.Id).Where(activeTables.Contains).ToList());
                })
                .ToList();

            if (chosen != null)
            {
                response.Service = new ServiceInfoResponse
                {
                    Opening = chosen.Window.Opening,
                    Closing = chosen.Window.Closing,
                    SlotStep = chosen.Window.SlotStep,
                    DefaultDuration = chosen.Window.Duration,
                    State = ServiceView.StateOf(ServiceView.BoundsOf(chosen.Day, chosen.Window, timeZone), now),
                    ExpectedCovers = bookings.Where(b => Counted.Contains(b.Reservation.Status)).Sum(b => b.Reservation.Covers),
                    Capacity = zones.SelectMany(z => z.Tables).Where(t => t.IsActive).Sum(t => t.Capacity),
                };
                response.Slots = ServiceView.SlotsOf(chosen, timeZone, bookings)
                    .Select(s => new ServiceSlotResponse { Time = s.Time, At = s.At, Covers = s.Covers, TakenTables = s.TakenTables, HasUnplaced = s.HasUnplaced })
                    .ToList();
                response.ToPlace = bookings
                    .Where(b => b.Reservation.Status == ReservationStatus.Confirmed && !b.IsPlaced)
                    .Select(b => ToServiceReservation(b.Reservation)).ToList();
                response.Pending = bookings
                    .Where(b => b.Reservation.Status == ReservationStatus.Pending)
                    .Select(b => ToServiceReservation(b.Reservation)).ToList();
                response.Allergies = bookings
                    .Where(b => WithAllergies.Contains(b.Reservation.Status) && !string.IsNullOrWhiteSpace(b.Reservation.Client?.Allergies))
                    .Select(b => new ServiceAllergyResponse
                    {
                        ReservationId = b.Reservation.Id,
                        Start = b.Reservation.Start,
                        GuestName = b.Reservation.Client!.Name,
                        Allergies = b.Reservation.Client.Allergies!.Trim(),
                        PlaceName = PlaceNameOf(b.Reservation),
                    }).ToList();
            }

            response.Zones = zones.Select(z => new ServiceZoneResponse
            {
                Id = z.Id,
                Name = z.Name,
                Width = z.Width,
                Height = z.Height,
                Decors = z.Decors.Select(d => d.ToResponse()).ToList(),
                Combinations = z.Combinations.Where(c => c.IsActive).Select(c => c.ToResponse()).ToList(),
                Tables = z.Tables.Where(t => t.IsActive).OrderBy(t => t.Name).Select(t => new ServiceTableResponse
                {
                    Id = t.Id,
                    ZoneId = t.ZoneId,
                    Name = t.Name,
                    Capacity = t.Capacity,
                    Shape = t.Shape,
                    X = t.X,
                    Y = t.Y,
                    Width = t.Width,
                    Height = t.Height,
                    Rotation = t.Rotation,
                    NeedsCleaningSince = t.NeedsCleaningSince,
                    Occupations = bookings
                        .Where(b => b.Interval != null && b.TableIds.Contains(t.Id))
                        .Select(b => new ServiceOccupationResponse
                        {
                            ReservationId = b.Reservation.Id,
                            Start = b.Interval!.Start,
                            End = b.Interval.End,
                            Status = b.Reservation.Status,
                            LateFrom = b.Reservation.Status == ReservationStatus.Confirmed ? b.Reservation.Start.AddMinutes(restaurant.LateGrace) : null,
                            PlaceName = PlaceNameOf(b.Reservation) ?? t.Name,
                            GuestName = b.Reservation.Client?.Name,
                            Covers = b.Reservation.Covers,
                            HasAllergy = !string.IsNullOrWhiteSpace(b.Reservation.Client?.Allergies),
                        }).ToList(),
                }).ToList(),
            }).ToList();

            return Ok(response);
        }

        /// <summary>Les jours du mois portant une réservation vivante ou passée : le point sous le jour du sélecteur (§4.3)</summary>
        [HttpGet("calendar")]
        [ProducesResponseType<List<DateOnly>>(StatusCodes.Status200OK)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> GetCalendar([FromQuery] string? month)
        {
            if (month == null || !DateOnly.TryParseExact($"{month}-01", "yyyy-MM-dd", out DateOnly first))
            {
                throw new ApiErrorException(ApiError.InvalidRequest, "month must be YYYY-MM.");
            }
            DateOnly last = first.AddMonths(1).AddDays(-1);
            ReservationStatus[] marked = [ReservationStatus.Pending, .. Counted];
            List<DateOnly> days = await context.Reservations
                .Where(r => r.RestaurantId == CurrentRestaurantId && r.ServiceDay >= first && r.ServiceDay <= last && marked.Contains(r.Status))
                .Select(r => r.ServiceDay)
                .Distinct()
                .OrderBy(d => d)
                .ToListAsync();
            return Ok(days);
        }

        /// <summary>
        /// NET-02 : la table redevient libre. La date d'avant est renvoyée pour l'annulation ; l'écriture ne passe que si
        /// la table est toujours sale à cette date : deux tablettes ne nettoient pas deux fois
        /// </summary>
        [HttpPost("tables/{id:guid}/clean")]
        [ProducesResponseType<TableCleanedResponse>(StatusCodes.Status200OK)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status409Conflict)]
        public async Task<IActionResult> Clean([FromRoute] Guid id)
        {
            var table = await context.Tables
                .Where(t => t.Id == id && t.Zone.RestaurantId == CurrentRestaurantId)
                .Select(t => new { t.Name, t.NeedsCleaningSince })
                .FirstOrDefaultAsync()
                ?? throw new ApiErrorException(ApiError.NotFound, "Table not found.");
            if (!await context.Restaurants.Where(r => r.Id == CurrentRestaurantId).Select(r => r.TrackTableCleaning).FirstAsync())
            {
                throw new ApiErrorException(ApiError.TableCleaningDisabled);
            }
            if (table.NeedsCleaningSince is not DateTime since
                || await context.Tables
                    .Where(t => t.Id == id && t.NeedsCleaningSince == since)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.NeedsCleaningSince, (DateTime?)null)) == 0)
            {
                throw new ApiErrorException(ApiError.TableAlreadyClean, table.Name);
            }
            await NotifyChangedAsync(DataScope.Service);
            return Ok(new TableCleanedResponse { TableId = id, Since = since });
        }

        /// <summary>Le bandeau « Annuler » : la date d'avant revient, sauf si la table a été resalie entre-temps</summary>
        [HttpPost("tables/{id:guid}/clean/undo")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status409Conflict)]
        public async Task<IActionResult> UndoClean([FromRoute] Guid id, [FromBody] CleanUndoRequest request)
        {
            if (!await context.Tables.AnyAsync(t => t.Id == id && t.Zone.RestaurantId == CurrentRestaurantId))
            {
                throw new ApiErrorException(ApiError.NotFound, "Table not found.");
            }
            DateTime since = DateTime.SpecifyKind(request.Since, DateTimeKind.Utc);
            int restored = await context.Tables
                .Where(t => t.Id == id && t.NeedsCleaningSince == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.NeedsCleaningSince, since));
            if (restored == 0)
            {
                throw new ApiErrorException(ApiError.UndoExpired);
            }
            await NotifyChangedAsync(DataScope.Service);
            return NoContent();
        }

        /// <summary>
        /// §3.5 : le verdict de chaque table et de chaque combinaison active pour cette réservation — les halos.
        /// Calculé ici seulement ; le placement le refait sous verrou
        /// </summary>
        [HttpGet("placement/{reservationId:guid}")]
        [ProducesResponseType<PlacementResponse>(StatusCodes.Status200OK)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status409Conflict)]
        public async Task<IActionResult> GetPlacement([FromRoute] Guid reservationId)
        {
            Reservation reservation = await context.Reservations
                .Where(r => r.Id == reservationId && r.RestaurantId == CurrentRestaurantId)
                .Include(r => r.Client)
                .Include(r => r.PreferredZone)
                .AsNoTracking()
                .FirstOrDefaultAsync()
                ?? throw new ApiErrorException(ApiError.NotFound, "Reservation not found.");
            if (!PlacementEngine.Placeable.Contains(reservation.Status))
            {
                throw new ApiErrorException(ApiError.ReservationActionNotAllowed, $"a {reservation.Status} reservation cannot be placed.");
            }
            Restaurant restaurant = await context.Restaurants.Include(r => r.Services).AsNoTracking().FirstAsync(r => r.Id == CurrentRestaurantId);
            DateTime now = DateTime.UtcNow;
            // « Table non nettoyée » ne se dit que pour le service en cours : demain, elle aura été redressée
            bool forNow = reservation.ServiceDay == await CurrentServiceDayAsync(restaurant, now);
            PlacementFloor.Floor floor = await PlacementFloor.LoadAsync(context, CurrentRestaurantId, reservation.ServiceDay, now);
            PlacementEngine.Request request = PlacementEngine.RequestOf(reservation, reservation.PreferredZone?.Name, now);
            List<PlacementEngine.Verdict> verdicts = PlacementEngine.Judge(request, floor.Candidates, floor.Occupations,
                PlacementEngine.SettingsOf(restaurant) with { TrackCleaning = restaurant.TrackTableCleaning && forNow });

            return Ok(new PlacementResponse
            {
                ReservationId = reservation.Id,
                GuestName = reservation.Client?.Name,
                Start = request.Start,
                End = request.End,
                Covers = reservation.Covers,
                Note = reservation.Note,
                PreferredZoneId = reservation.PreferredZoneId,
                Entities = verdicts.Select(ToEntityResponse).ToList(),
            });
        }

        /// <summary>Le jour de service en cours : la veille tant qu'une de ses plages passe minuit et dure encore (§4.3)</summary>
        private async Task<DateOnly> CurrentServiceDayAsync(Restaurant restaurant, DateTime now)
        {
            TimeZoneInfo timeZone = TimeZoneInfo.FindSystemTimeZoneById(restaurant.TimeZone);
            DateOnly yesterday = ReservationImpact.Today(timeZone).AddDays(-1);
            List<Closure> closures = await context.Closures
                .Where(c => c.RestaurantId == CurrentRestaurantId && c.From <= yesterday && c.To >= yesterday)
                .AsNoTracking()
                .ToListAsync();
            return ServiceView.ServiceDayAt(now, timeZone, ReservationClock.WindowsOf(yesterday, restaurant.Services, closures, restaurant.DefaultRotation));
        }

        private static PlacementEntityResponse ToEntityResponse(PlacementEngine.Verdict verdict) => new()
        {
            TableId = verdict.Candidate.TableId,
            CombinationId = verdict.Candidate.CombinationId,
            ZoneId = verdict.Candidate.ZoneId,
            Name = verdict.Candidate.Name,
            Capacity = verdict.Candidate.Capacity,
            Level = verdict.Level,
            Reasons = verdict.Reasons.Select(r => new PlacementReasonResponse
            {
                Kind = r.Kind, Count = r.Count, Tolerance = r.Tolerance, NoneLeftOfCapacity = r.NoneLeftOfCapacity,
                Since = r.Since, Guest = r.Guest, LeftAt = r.LeftAt, RequestedZone = r.RequestedZone, Note = r.Note,
                Start = r.Start, Margin = r.Margin, DefaultRotation = r.DefaultRotation, Combination = r.Combination,
                With = r.With?.ToList(),
            }).ToList(),
            Next = verdict.Next == null ? null : new PlacementNextResponse { Start = verdict.Next.Start, Margin = verdict.Next.Margin, Guest = verdict.Next.Guest },
        };

        private static string? PlaceNameOf(Reservation reservation)
        {
            Assignment? assignment = reservation.LatestAssignment();
            return assignment?.Table?.Name ?? assignment?.Combination?.Name;
        }

        private static ServiceReservationResponse ToServiceReservation(Reservation reservation) => new()
        {
            Id = reservation.Id,
            Start = reservation.Start,
            Covers = reservation.Covers,
            Source = reservation.Source,
            Client = reservation.Client?.ToListClient(),
        };
    }
}
