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

        private readonly ServiceUndo _undo;

        public ServiceController(TuroDBContext context, ServiceUndo undo) : base(context)
        {
            _undo = undo;
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
                        held.Select(t => t.Id).Where(activeTables.Contains).ToList(), assignment?.CombinationId);
                })
                .ToList();
            HashSet<Guid> heldCombinations = bookings
                .Where(b => b.Interval != null && b.CombinationId != null)
                .Select(b => b.CombinationId!.Value)
                .ToHashSet();

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

            ServiceView.Bounds? chosenBounds = chosen == null ? null : ServiceView.BoundsOf(chosen.Day, chosen.Window, timeZone);
            bool inProgress = chosenBounds != null && ServiceView.StateOf(chosenBounds, now) == ServiceState.InProgress;

            response.Zones = zones.Select(z => new ServiceZoneResponse
            {
                Id = z.Id,
                Name = z.Name,
                Width = z.Width,
                Height = z.Height,
                Decors = z.Decors.Select(d => d.ToResponse()).ToList(),
                Combinations = z.Combinations.Where(c => c.IsActive).Select(c => c.ToResponse()).ToList(),
                AgendaCombinations = chosenBounds == null ? [] : z.Combinations
                    .Where(c => ServiceView.ShowsOnAgenda(c, chosenBounds, inProgress, heldCombinations))
                    .OrderBy(c => c.Name).Select(c => c.ToResponse()).ToList(),
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
                            CombinationId = b.CombinationId,
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
            PlacementEngine.Settings settings = PlacementEngine.SettingsOf(restaurant) with { TrackCleaning = restaurant.TrackTableCleaning && forNow };
            List<PlacementEngine.Verdict> verdicts = PlacementEngine.Judge(request, floor.Candidates, floor.Occupations, settings);
            List<PlacementEngine.ApproachVerdict> approaches = PlacementEngine.JudgeApproaches(request, floor.Approaches, floor.Candidates, floor.Occupations, settings);

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
                Approaches = approaches.Select(ToApproachResponse).ToList(),
            });
        }

        /// <summary>COMB-06 : les rappels en cours ou à venir du restaurant — ils parlent de la salle maintenant, quel que soit le service affiché</summary>
        [HttpGet("reminders")]
        [ProducesResponseType<List<CombinationReminderResponse>>(StatusCodes.Status200OK)]
        public async Task<IActionResult> GetReminders()
        {
            DateTime now = DateTime.UtcNow;
            CombinationFloor.Floor floor = await CombinationFloor.LoadAsync(context, CurrentRestaurantId, now);
            return Ok(floor.Combinations
                .Select(c => CombinationFloor.ReminderOf(c, floor, now))
                .OfType<CombinationReminderResponse>()
                .OrderBy(r => r.DueAt).ThenBy(r => r.Name)
                .ToList());
        }

        /// <summary>
        /// COMB-07 : la réponse à un rappel dû. Deux tablettes qui répondent au même rappel : la seconde trouve un rappel changé.
        /// Le logiciel ne bascule `IsActive` que sur cette réponse humaine
        /// </summary>
        [HttpPost("combinations/{id:guid}/reminder")]
        [ProducesResponseType<ServiceUndoResponse>(StatusCodes.Status200OK)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status409Conflict)]
        public async Task<IActionResult> AnswerReminder([FromRoute] Guid id, [FromBody] ReminderAnswerRequest request)
        {
            bool fits = request.Kind == CombinationReminderKind.Approach
                ? request.Answer is ReminderAnswer.Done or ReminderAnswer.Later or ReminderAnswer.Abandon
                : request.Answer is ReminderAnswer.Separate or ReminderAnswer.KeepTogether;
            if (!fits)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, $"{request.Answer} does not answer a {request.Kind} reminder.");
            }

            await using var transaction = await context.Database.BeginTransactionAsync();
            DateTime now = DateTime.UtcNow;
            // « Finalement non » retire les affectations d'une réservation : elle se verrouille avant les combinaisons
            Guid? abandoned = null;
            if (request.Answer == ReminderAnswer.Abandon)
            {
                CombinationFloor.Floor seen = await CombinationFloor.LoadAsync(context, CurrentRestaurantId, now);
                abandoned = seen.Combinations.FirstOrDefault(c => c.Id == id) is Combination c ? CombinationFloor.ReminderOf(c, seen, now)?.Reservation?.Id : null;
                if (abandoned is Guid abandonedId)
                {
                    await context.Database.ExecuteSqlAsync($"SELECT 1 FROM \"Reservations\" WHERE \"Id\" = {abandonedId} FOR UPDATE");
                }
                // L'étage se relit sous verrou : rien de ce coup d'œil ne doit rester suivi
                context.ChangeTracker.Clear();
            }
            await CombinationFloor.LockAsync(context, CurrentRestaurantId);
            CombinationFloor.Floor floor = await CombinationFloor.LoadAsync(context, CurrentRestaurantId, now);
            Combination combination = floor.Combinations.FirstOrDefault(c => c.Id == id)
                ?? throw new ApiErrorException(ApiError.NotFound, "Combination not found.");
            CombinationReminderResponse? current = CombinationFloor.ReminderOf(combination, floor, now);
            if (current == null || current.Kind != request.Kind || current.DueAt > now
                || (request.Answer == ReminderAnswer.Abandon && current.Reservation?.Id != abandoned))
            {
                throw new ApiErrorException(ApiError.ReminderChanged, combination.Name);
            }
            if (request.Answer == ReminderAnswer.Abandon && current.Reservation is { Status: not ReservationStatus.Confirmed })
            {
                throw new ApiErrorException(ApiError.ReservationActionNotAllowed, "the guests are already seated.");
            }

            Dictionary<Guid, CombinationFields> before = floor.Combinations.ToDictionary(c => c.Id, CombinationFields.Of);
            var removed = new List<AssignmentCopy>();
            var lines = new List<Guid>();
            bool touchesClients = false;
            switch (request.Answer)
            {
                case ReminderAnswer.Done:
                    Glue(floor, combination);
                    break;
                case ReminderAnswer.Later:
                    combination.SnoozedUntil = TruncateToMicroseconds(now.AddMinutes(CombinationFloor.SnoozeMinutes));
                    break;
                case ReminderAnswer.Abandon:
                    // Seulement celle du rappel : les autres réservations de la combinaison gardent leur place
                    List<Guid> waiting = current.Reservation is { } asked ? [asked.Id] : [];
                    // Toutes les affectations : la précédente redeviendrait sinon la plus récente. L'historique reste au journal
                    List<Assignment> assignments = await context.Assignments.Where(a => waiting.Contains(a.ReservationId)).ToListAsync();
                    removed.AddRange(assignments.Select(AssignmentCopy.Of));
                    context.Assignments.RemoveRange(assignments);
                    touchesClients = await context.Reservations.AnyAsync(r => waiting.Contains(r.Id) && r.ClientId != null);
                    foreach (Guid reservationId in waiting)
                    {
                        var line = new EventLog
                        {
                            Id = Guid.NewGuid(), ReservationId = reservationId, Timestamp = now, Type = EventType.Placement,
                            AuthorId = CurrentUserId, Details = $"Rapprochement {combination.Name} abandonné",
                        };
                        context.EventLogs.Add(line);
                        lines.Add(line.Id);
                    }
                    break;
                case ReminderAnswer.Separate:
                    CombinationFloor.SetActive(combination, false);
                    break;
                case ReminderAnswer.KeepTogether:
                    if (request.Kind == CombinationReminderKind.Separate)
                    {
                        combination.KeepGluedFor = current.Reservation?.Id;
                    }
                    else
                    {
                        combination.SeparateAfterNoShowOf = null;
                    }
                    break;
            }
            await context.SaveChangesAsync();
            await CombinationFloor.ApplyAsync(context, CurrentRestaurantId, now);
            await context.SaveChangesAsync();
            await transaction.CommitAsync();

            Guid undoId = Guid.NewGuid();
            Dictionary<Guid, CombinationFields> changed = floor.Combinations
                .Where(c => before[c.Id] != CombinationFields.Of(c))
                .ToDictionary(c => c.Id, CombinationFields.Of);
            _undo.Remember(undoId, new ServiceUndoEntry(CurrentUserId, CurrentRestaurantId)
            {
                CombinationsBefore = changed.Keys.ToDictionary(k => k, k => before[k]),
                CombinationsAfter = changed,
                RemovedAssignments = removed,
                EventIds = lines,
                TouchesReservations = removed.Count > 0,
            });
            await NotifyChangedAsync(DataScope.FloorPlan);
            if (removed.Count > 0)
            {
                await NotifyChangedAsync(DataScope.Reservations);
            }
            if (touchesClients)
            {
                await NotifyChangedAsync(DataScope.Clients);
            }
            return Ok(new ServiceUndoResponse { UndoId = undoId });
        }

        /// <summary>
        /// Le mode édition du service, pour les deux rôles (§4.7) : la position est définitive et passe aussi dans le brouillon.
        /// Coller ou séparer est la réponse humaine que les rappels attendent : le logiciel ne le décide jamais seul
        /// </summary>
        [HttpPost("layout")]
        [ProducesResponseType<ServiceUndoResponse>(StatusCodes.Status200OK)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Layout([FromBody] LayoutRequest request)
        {
            if (request.Glue != null && request.Separate != null)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, "glue or separate, not both.");
            }
            if (request.Moves.Count == 0 && request.Glue == null && request.Separate == null)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, "nothing to change.");
            }
            List<Guid> movedIds = request.Moves.Select(m => m.TableId).Distinct().ToList();
            if (movedIds.Count != request.Moves.Count)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, "a table is moved twice.");
            }

            await using var transaction = await context.Database.BeginTransactionAsync();
            DateTime now = DateTime.UtcNow;
            // Les tables déplacées et celles d'une paire à créer, puis les combinaisons : l'ordre des verrous des gestes
            Guid[] lockedTables = [.. movedIds.Concat(request.Glue is { CombinationId: null } pair ? pair.TableIds : []).Distinct()];
            await context.Database.ExecuteSqlAsync($"SELECT 1 FROM \"Tables\" WHERE \"Id\" = ANY({lockedTables}) ORDER BY \"Id\" FOR UPDATE");
            await CombinationFloor.LockAsync(context, CurrentRestaurantId);
            Dictionary<Guid, Table> moved = await context.Tables
                .Include(t => t.Zone)
                .Where(t => movedIds.Contains(t.Id) && t.Zone.RestaurantId == CurrentRestaurantId && t.IsActive)
                .ToDictionaryAsync(t => t.Id);
            if (moved.Count != movedIds.Count)
            {
                throw new ApiErrorException(ApiError.NotFound, "Table not found.");
            }
            var positionsBefore = new Dictionary<Guid, TablePosition>();
            foreach (TableMoveRequest move in request.Moves)
            {
                Table table = moved[move.TableId];
                if (!FloorPlanRules.FitsIn(move.X, move.Y, table.Width, table.Height, table.Rotation, table.Zone.Width, table.Zone.Height))
                {
                    throw new ApiErrorException(ApiError.InvalidModification, $"table {table.Name}: the table goes beyond room {table.Zone.Name}.");
                }
                positionsBefore[table.Id] = new TablePosition(table.X, table.Y);
                table.X = move.X;
                table.Y = move.Y;
            }

            CombinationFloor.Floor floor = await CombinationFloor.LoadAsync(context, CurrentRestaurantId, now);
            Dictionary<Guid, CombinationFields> before = floor.Combinations.ToDictionary(c => c.Id, CombinationFields.Of);
            Combination? created = null;
            if (request.Glue is GlueRequest glue)
            {
                Combination target;
                if (glue.CombinationId is Guid combinationId)
                {
                    target = floor.Combinations.FirstOrDefault(c => c.Id == combinationId)
                        ?? throw new ApiErrorException(ApiError.NotFound, "Combination not found.");
                }
                else
                {
                    // Une table collée contre une combinaison active : trois tables, comme dans l'éditeur
                    List<Table> members = await CombinationRules.CheckPairAsync(context, CurrentRestaurantId, glue.TableIds, 2);
                    string name = await CombinationRules.CheckNewAsync(context, CurrentRestaurantId, glue.Name, glue.Capacity);
                    created = new Combination { Id = Guid.NewGuid(), ZoneId = members[0].ZoneId, Name = name, Capacity = glue.Capacity, Tables = members };
                    context.Combinations.Add(created);
                    floor.Combinations.Add(created);
                    target = created;
                }
                if (target.Tables.Any(t => !t.IsActive) || target.Tables.Select(t => t.ZoneId).Distinct().Count() > 1)
                {
                    throw new ApiErrorException(ApiError.InvalidRequest, "glued tables must be active tables of one room.");
                }
                Glue(floor, target);
            }
            if (request.Separate is SeparateRequest separate)
            {
                Combination target = floor.Combinations.FirstOrDefault(c => c.Id == separate.CombinationId)
                    ?? throw new ApiErrorException(ApiError.NotFound, "Combination not found.");
                CombinationFloor.SetActive(target, false);
                if (separate.ReactivateId is Guid reactivateId)
                {
                    Combination rest = floor.Combinations.FirstOrDefault(c => c.Id == reactivateId)
                        ?? throw new ApiErrorException(ApiError.NotFound, "Combination not found.");
                    if (!rest.Tables.All(t => target.Tables.Any(m => m.Id == t.Id)))
                    {
                        throw new ApiErrorException(ApiError.InvalidRequest, "only the tables left glued can stay together.");
                    }
                    Glue(floor, rest);
                }
            }

            await DraftSync.ApplyAsync(context, CurrentRestaurantId, draft =>
            {
                foreach (DraftTableItem item in draft.Tables.Where(t => moved.ContainsKey(t.Id)))
                {
                    (item.X, item.Y) = (moved[item.Id].X, moved[item.Id].Y);
                }
                foreach (DraftCombinationItem item in draft.Combinations)
                {
                    Combination? live = floor.Combinations.FirstOrDefault(c => c.Id == item.Id);
                    if (live != null && before.TryGetValue(item.Id, out CombinationFields? was) && was.IsActive != live.IsActive)
                    {
                        item.IsActive = live.IsActive;
                    }
                }
                if (created != null)
                {
                    draft.Combinations.Add(new DraftCombinationItem
                    {
                        Id = created.Id, Name = created.Name, Capacity = created.Capacity, TableIds = created.Tables.Select(t => t.Id).ToList(), IsActive = true,
                    });
                }
            });
            await context.SaveChangesAsync();
            await CombinationFloor.ApplyAsync(context, CurrentRestaurantId, now);
            await context.SaveChangesAsync();
            await transaction.CommitAsync();

            Guid undoId = Guid.NewGuid();
            Dictionary<Guid, CombinationFields> changed = floor.Combinations
                .Where(c => c != created && before[c.Id] != CombinationFields.Of(c))
                .ToDictionary(c => c.Id, CombinationFields.Of);
            if (created != null)
            {
                // Née du geste : défaire la remet en sommeil, puis la retire
                before[created.Id] = new CombinationFields(false, null, null, null);
                changed[created.Id] = CombinationFields.Of(created);
            }
            _undo.Remember(undoId, new ServiceUndoEntry(CurrentUserId, CurrentRestaurantId)
            {
                PositionsBefore = positionsBefore,
                PositionsAfter = moved.Values.ToDictionary(t => t.Id, t => new TablePosition(t.X, t.Y)),
                CombinationsBefore = changed.Keys.ToDictionary(k => k, k => before[k]),
                CombinationsAfter = changed,
                CreatedCombinationId = created?.Id,
            });
            await NotifyChangedAsync(DataScope.FloorPlan);
            return Ok(new ServiceUndoResponse { UndoId = undoId });
        }

        /// <summary>COMB-04 : coller ces tables sépare la combinaison collée qui en partage une</summary>
        private static void Glue(CombinationFloor.Floor floor, Combination target)
        {
            foreach (Combination other in floor.Combinations.Where(o => o != target && o.IsActive && o.Tables.Any(t => target.Tables.Any(m => m.Id == t.Id))))
            {
                CombinationFloor.SetActive(other, false);
            }
            CombinationFloor.SetActive(target, true);
        }

        /// <summary>Le bandeau « Annuler » des gestes du service : refusé si une table ou une combinaison touchée a changé depuis</summary>
        [HttpPost("undo/{undoId:guid}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status409Conflict)]
        public async Task<IActionResult> Undo([FromRoute] Guid undoId)
        {
            ServiceUndoEntry entry = _undo.Find(undoId) is ServiceUndoEntry found && found.UserId == CurrentUserId && found.RestaurantId == CurrentRestaurantId
                ? found
                : throw new ApiErrorException(ApiError.UndoExpired);

            await using var transaction = await context.Database.BeginTransactionAsync();
            // L'ordre des verrous des gestes : réservations, tables, puis combinaisons.
            // Un second « Annuler » simultané attend ici, puis voit les affectations déjà remises
            Guid[] reservations = [.. entry.RemovedAssignments.Select(a => a.ReservationId).Distinct()];
            await context.Database.ExecuteSqlAsync($"SELECT 1 FROM \"Reservations\" WHERE \"Id\" = ANY({reservations}) ORDER BY \"Id\" FOR UPDATE");
            Guid[] tableIds = [.. entry.PositionsAfter.Keys];
            await context.Database.ExecuteSqlAsync($"SELECT 1 FROM \"Tables\" WHERE \"Id\" = ANY({tableIds}) ORDER BY \"Id\" FOR UPDATE");
            await CombinationFloor.LockAsync(context, CurrentRestaurantId);

            List<Table> tables = await context.Tables.Where(t => tableIds.Contains(t.Id)).ToListAsync();
            Guid[] combinationIds = [.. entry.CombinationsAfter.Keys];
            List<Combination> all = await context.Combinations
                .Where(c => c.Zone.RestaurantId == CurrentRestaurantId)
                .Include(c => c.Tables)
                .ToListAsync();
            List<Combination> combinations = all.Where(c => combinationIds.Contains(c.Id)).ToList();
            const double epsilon = 1e-6;
            bool moved = tables.Any(t => Math.Abs(t.X - entry.PositionsAfter[t.Id].X) > epsilon || Math.Abs(t.Y - entry.PositionsAfter[t.Id].Y) > epsilon);
            bool changed = combinations.Count != combinationIds.Length || combinations.Any(c => CombinationFields.Of(c) != entry.CombinationsAfter[c.Id]);
            bool replaced = await context.Assignments.AnyAsync(a => reservations.Contains(a.ReservationId));
            if (moved || changed || replaced)
            {
                throw new ApiErrorException(ApiError.UndoExpired);
            }

            foreach (Table table in tables)
            {
                (table.X, table.Y) = (entry.PositionsBefore[table.Id].X, entry.PositionsBefore[table.Id].Y);
            }
            foreach (Combination combination in combinations)
            {
                entry.CombinationsBefore[combination.Id].ApplyTo(combination);
            }
            // COMB-04 : une combinaison recollée ne reprend pas une table qu'une autre, collée depuis, tient
            List<Combination> others = all.Where(o => !combinationIds.Contains(o.Id) && o.IsActive).ToList();
            if (combinations.Any(c => c.IsActive && others.Any(o => o.Tables.Any(t => c.Tables.Any(m => m.Id == t.Id)))))
            {
                throw new ApiErrorException(ApiError.UndoExpired);
            }
            context.Assignments.AddRange(entry.RemovedAssignments.Select(a => a.ToAssignment()));
            await context.EventLogs.Where(e => entry.EventIds.Contains(e.Id)).ExecuteDeleteAsync();
            if (entry.CreatedCombinationId is Guid createdId
                && await context.Combinations.Include(c => c.Assignments).FirstOrDefaultAsync(c => c.Id == createdId) is Combination born
                && born.Assignments.Count == 0)
            {
                context.Combinations.Remove(born);
            }
            await DraftSync.ApplyAsync(context, CurrentRestaurantId, draft =>
            {
                foreach (DraftTableItem item in draft.Tables.Where(t => entry.PositionsBefore.ContainsKey(t.Id)))
                {
                    (item.X, item.Y) = (entry.PositionsBefore[item.Id].X, entry.PositionsBefore[item.Id].Y);
                }
                foreach (DraftCombinationItem item in draft.Combinations.Where(c => entry.CombinationsBefore.ContainsKey(c.Id)))
                {
                    item.IsActive = entry.CombinationsBefore[item.Id].IsActive;
                }
                draft.Combinations.RemoveAll(c => c.Id == entry.CreatedCombinationId);
            });
            await context.SaveChangesAsync();
            await CombinationFloor.ApplyAsync(context, CurrentRestaurantId, DateTime.UtcNow);
            await context.SaveChangesAsync();
            await transaction.CommitAsync();

            _undo.Forget(undoId);
            await NotifyChangedAsync(DataScope.FloorPlan);
            if (entry.TouchesReservations)
            {
                await NotifyChangedAsync(DataScope.Reservations);
            }
            return NoContent();
        }

        /// <summary>PostgreSQL garde la microseconde : ce qu'on retient pour l'annulation doit être ce qu'il relira</summary>
        private static DateTime TruncateToMicroseconds(DateTime value) => new(value.Ticks - value.Ticks % 10, value.Kind);

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

        private static PlacementReasonResponse ToReasonResponse(PlacementEngine.Reason r) => new()
        {
            Kind = r.Kind, Count = r.Count, Tolerance = r.Tolerance, NoneLeftOfCapacity = r.NoneLeftOfCapacity,
            Since = r.Since, Guest = r.Guest, LeftAt = r.LeftAt, RequestedZone = r.RequestedZone, Note = r.Note,
            Start = r.Start, Margin = r.Margin, DefaultRotation = r.DefaultRotation, Combination = r.Combination,
            With = r.With?.ToList(),
        };

        private static PlacementEntityResponse ToEntityResponse(PlacementEngine.Verdict verdict) => new()
        {
            TableId = verdict.Candidate.TableId,
            CombinationId = verdict.Candidate.CombinationId,
            ZoneId = verdict.Candidate.ZoneId,
            Name = verdict.Candidate.Name,
            Capacity = verdict.Candidate.Capacity,
            Level = verdict.Level,
            Reasons = verdict.Reasons.Select(ToReasonResponse).ToList(),
            Next = verdict.Next == null ? null : new PlacementNextResponse { Start = verdict.Next.Start, Margin = verdict.Next.Margin, Guest = verdict.Next.Guest },
        };

        private static PlacementApproachResponse ToApproachResponse(PlacementEngine.ApproachVerdict verdict) => new()
        {
            CombinationId = verdict.Approach.CombinationId,
            TableIds = [.. verdict.Approach.TableIds],
            ZoneId = verdict.Approach.ZoneId,
            Name = verdict.Approach.Name,
            Capacity = verdict.Approach.Capacity,
            Level = verdict.Level,
            Reasons = verdict.Reasons.Select(ToReasonResponse).ToList(),
            Next = verdict.Next == null ? null : new PlacementNextResponse { Start = verdict.Next.Start, Margin = verdict.Next.Margin, Guest = verdict.Next.Guest },
            Distance = verdict.Approach.Distance,
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
