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

namespace TUROAPI.Controllers
{
    /// <summary>
    /// Réservations (§6, §8) : l'API est l'autorité du cycle de vie. Chaque écriture verrouille la réservation, ajuste
    /// les compteurs du client par incrément en base, écrit une ligne de journal et se défait pendant 30 s.
    /// Les deux rôles y ont accès (§4.7)
    /// </summary>
    [Route("api/reservations")]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status401Unauthorized)]
    public class ReservationsController : NeedAuthController
    {
        public const int MaxCovers = 99;
        public const int MinDuration = 15;
        public const int MaxDuration = 600;
        public const int MaxNoteLength = 500;
        public const int MaxListDays = 366;

        // SRC-01 : web et google sont écrits par le logiciel, jamais choisis
        private static readonly ReservationSource[] ManualSources =
            [ReservationSource.Phone, ReservationSource.WalkIn, ReservationSource.Platform, ReservationSource.Other];

        private readonly ReservationUndo _undo;

        public ReservationsController(TuroDBContext context, ReservationUndo undo) : base(context)
        {
            _undo = undo;
        }

        /// <summary>Les plages ouvertes d'un jour et leurs créneaux : la bande d'heures du formulaire (§8.3)</summary>
        [HttpGet("slots")]
        [ProducesResponseType<List<ServiceWindowResponse>>(StatusCodes.Status200OK)]
        public async Task<IActionResult> GetSlots([FromQuery] DateOnly day)
        {
            Restaurant restaurant = await LoadRestaurantAsync();
            return Ok((await WindowsAsync(restaurant, day)).Select(w => w.ToResponse()).ToList());
        }

        /// <summary>
        /// §6.1 : des jours de service entiers, dans l'ordre de la période (les passées de la plus récente à la plus ancienne),
        /// et la file des demandes à venir, qui ne dépend d'aucun filtre
        /// </summary>
        [HttpGet]
        [ProducesResponseType<ReservationPageResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> GetReservations([FromQuery] ReservationListQuery query)
        {
            if (query.Days < 1 || query.Days > MaxListDays)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, $"days must be between 1 and {MaxListDays}.");
            }

            Restaurant restaurant = await LoadRestaurantAsync();
            // « Aujourd'hui » est le jour du service en cours : à 00:20, le dîner de la veille qui passe minuit
            DateOnly today = await ServiceDayAsync(restaurant, TimeZoneInfo.FindSystemTimeZoneById(restaurant.TimeZone));
            IQueryable<Reservation> reservations = context.Reservations.Where(r => r.RestaurantId == CurrentRestaurantId);
            reservations = query.Period switch
            {
                ReservationPeriod.Today => reservations.Where(r => r.ServiceDay == today),
                ReservationPeriod.Past => reservations.Where(r => r.ServiceDay < today),
                _ => reservations.Where(r => r.ServiceDay >= today),
            };
            if (query.Status is ReservationStatus status)
            {
                reservations = reservations.Where(r => r.Status == status);
            }
            if (query.Source is ReservationSource source)
            {
                reservations = reservations.Where(r => r.Source == source);
            }
            if (query.ZoneId is Guid zoneId)
            {
                // La salle souhaitée, ou celle de la dernière affectation : une réservation déplacée a changé de salle
                reservations = reservations.Where(r => r.PreferredZoneId == zoneId
                    || r.Assignments
                        .OrderByDescending(a => a.AssignedAt)
                        .Select(a => a.Table != null ? (Guid?)a.Table.ZoneId : a.Combination!.ZoneId)
                        .FirstOrDefault() == zoneId);
            }
            string search = query.Search?.Trim() ?? string.Empty;
            if (search.Any(char.IsAsciiDigit))
            {
                // Quand le téléphone sonne, on a le numéro avant le nom ; espaces et points ignorés
                string key = PhoneNumber.SearchKey(search);
                reservations = reservations.Where(r => r.Client != null && r.Client.Phone != null && r.Client.Phone.Contains(key));
            }
            else if (search.Length > 0)
            {
                string pattern = "%" + search.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
                reservations = reservations.Where(r => r.Client != null && EF.Functions.ILike(r.Client.Name, pattern));
            }

            IQueryable<DateOnly> serviceDays = reservations.Select(r => r.ServiceDay).Distinct();
            List<DateOnly> days = await (query.Period == ReservationPeriod.Past
                    ? serviceDays.OrderByDescending(d => d)
                    : serviceDays.OrderBy(d => d))
                .Take(query.Days + 1)
                .ToListAsync();
            bool hasMore = days.Count > query.Days;
            days = days.Take(query.Days).ToList();

            List<Reservation> rows = await reservations
                .Where(r => days.Contains(r.ServiceDay))
                .Include(r => r.Client)
                .Include(r => r.Assignments).ThenInclude(a => a.Table)
                .Include(r => r.Assignments).ThenInclude(a => a.Combination)
                .AsSplitQuery()
                .AsNoTracking()
                .ToListAsync();

            IQueryable<Reservation> pending = context.Reservations.Where(r =>
                r.RestaurantId == CurrentRestaurantId && r.Status == ReservationStatus.Pending && r.ServiceDay >= today);

            return Ok(new ReservationPageResponse
            {
                Days = days.Select(day =>
                {
                    List<Reservation> ofDay = rows.Where(r => r.ServiceDay == day).OrderBy(r => r.Start).ToList();
                    return new ReservationDayResponse
                    {
                        ServiceDay = day,
                        Covers = ofDay
                            .Where(r => r.Status is ReservationStatus.Confirmed or ReservationStatus.Seated or ReservationStatus.Finished)
                            .Sum(r => r.Covers),
                        ToPlace = ofDay.Count(r => r.Status == ReservationStatus.Confirmed && r.Assignments.Count == 0),
                        Items = ofDay.Select(r => r.ToListItem(restaurant.LateGrace)).ToList(),
                    };
                }).ToList(),
                HasMore = hasMore,
                Pending = new PendingRequestsResponse
                {
                    Count = await pending.CountAsync(),
                    OldestCreatedAt = await pending.MinAsync(r => (DateTime?)r.CreatedAt),
                },
            });
        }

        [HttpGet("{id:guid}")]
        [ProducesResponseType<ReservationResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> GetReservation([FromRoute] Guid id)
        {
            return Ok(await DetailAsync(id));
        }

        /// <summary>
        /// Une réservation prise par le restaurant (§8) : confirmée d'office, rattachée au client par son numéro (§7.2).
        /// « Complet » ne bloque jamais (§8.4) ; seuls un jour passé, un jour fermé ou une heure hors service sont refusés
        /// </summary>
        [HttpPost]
        [ProducesResponseType<ReservationActionResponse>(StatusCodes.Status201Created)]
        public async Task<IActionResult> AddReservation(ReservationRequest request)
        {
            if (!ManualSources.Contains(request.Source))
            {
                throw new ApiErrorException(ApiError.InvalidRequest, $"the source {request.Source} is written by the software, never chosen.");
            }
            string name = request.Name?.Trim() ?? string.Empty;
            if (name.Length == 0)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, "name is required.");
            }
            if (name.Length > ClientsController.MaxNameLength)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, $"name is longer than {ClientsController.MaxNameLength} characters.");
            }
            // FORM-03 : sans numéro, ni rappel ni changement d'horaire possibles
            string? phone = PhoneNumber.Normalize(request.Phone);
            if (phone == null || request.Phone!.Trim().Length > ClientsController.MaxPhoneLength)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, "a readable phone number is required.");
            }
            string? email = ContactList.NormalizeEmail(request.Email);
            if (email != null && (email.Length > ClientsController.MaxEmailLength || !email.Contains('@') || email.Contains(ContactList.Separator)))
            {
                throw new ApiErrorException(ApiError.InvalidRequest, $"« {email} » is not a valid e-mail.");
            }

            Restaurant restaurant = await LoadRestaurantAsync();
            TimeZoneInfo timeZone = TimeZoneInfo.FindSystemTimeZoneById(restaurant.TimeZone);
            (DateTime start, ReservationClock.Window window) = await ScheduleAsync(restaurant, timeZone, request.ServiceDay, request.Time);
            int duration = request.Duration ?? window.Duration;
            CheckBooking(request.Covers, duration, request.Note);
            Guid? zoneId = await CheckZoneAsync(request.PreferredZoneId);

            Client? client = await ClientIdentity.FindOrCreateAsync(context, CurrentRestaurantId, name, phone, email);
            bool clientIsNew = client != null && context.Entry(client).State == EntityState.Added;
            await CheckNoOverlapAsync(client?.Id, null, start, duration, timeZone);
            var reservation = new Reservation
            {
                Id = Guid.NewGuid(),
                RestaurantId = CurrentRestaurantId,
                Client = client,
                Start = start,
                Duration = duration,
                ServiceDay = request.ServiceDay,
                Covers = request.Covers,
                Status = ReservationStatus.Confirmed,
                Source = request.Source,
                PreferredZoneId = zoneId,
                Note = Optional(request.Note),
                CreatedAt = DateTime.UtcNow,
            };
            EventLog creation = NewEvent(reservation.Id, EventType.Creation, ReservationJournal.SourceLabel(request.Source));
            context.Reservations.Add(reservation);
            context.EventLogs.Add(creation);
            await context.SaveChangesAsync();

            _undo.Remember(creation.Id, new UndoEntry(reservation.Id, CurrentUserId, UndoKind.Creation)
            {
                CreatedClientId = clientIsNew ? client!.Id : null,
            });
            await NotifyAsync(client != null);
            var response = new ReservationActionResponse { Reservation = await DetailAsync(reservation.Id), EventId = creation.Id };
            return Created($"/api/reservations/{reservation.Id}", response);
        }

        /// <summary>
        /// Couverts, date, heure, durée, note et salle souhaitée (§13 tranché). L'identité et la source ne bougent pas ici ;
        /// une assise garde sa date et son heure ; une close ne change plus. L'affectation n'est jamais touchée (FICHE-06)
        /// </summary>
        [HttpPut("{id:guid}")]
        [ProducesResponseType<ReservationActionResponse>(StatusCodes.Status200OK)]
        public async Task<IActionResult> UpdateReservation([FromRoute] Guid id, [FromBody] ReservationRequest request)
        {
            // Le formulaire renvoie toute la réservation : enregistré sur une version périmée, il effacerait ce qu'un autre poste vient d'écrire
            if (request.Version is null)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, "the version read with the reservation is required.");
            }

            await using var transaction = await context.Database.BeginTransactionAsync();
            Reservation reservation = await LockAsync(id);
            if (request.Version != reservation.Version)
            {
                throw new ApiErrorException(ApiError.ReservationChanged);
            }
            if (ReservationTransitions.IsClosed(reservation.Status))
            {
                throw new ApiErrorException(ApiError.ReservationActionNotAllowed, "a closed reservation cannot be modified; reopen it first.");
            }

            Restaurant restaurant = await LoadRestaurantAsync();
            TimeZoneInfo timeZone = TimeZoneInfo.FindSystemTimeZoneById(restaurant.TimeZone);
            TimeOnly localTime = ReservationClock.LocalTime(reservation.Start, timeZone);
            bool moves = request.ServiceDay != reservation.ServiceDay || request.Time != localTime;
            if (moves && reservation.Status == ReservationStatus.Seated)
            {
                throw new ApiErrorException(ApiError.ReservationActionNotAllowed, "a seated reservation keeps its day and time.");
            }
            DateTime start = moves
                ? (await ScheduleAsync(restaurant, timeZone, request.ServiceDay, request.Time)).Start
                : reservation.Start;
            int duration = request.Duration ?? reservation.Duration;
            CheckBooking(request.Covers, duration, request.Note);
            await CheckNoOverlapAsync(reservation.ClientId, id, start, duration, timeZone);
            Guid? zoneId = await CheckZoneAsync(request.PreferredZoneId);
            string? note = Optional(request.Note);

            Dictionary<Guid, string> zoneNames = await context.Zones
                .Where(z => z.RestaurantId == CurrentRestaurantId)
                .ToDictionaryAsync(z => z.Id, z => z.Name);
            string? NameOf(Guid? zone) => zone is Guid z && zoneNames.TryGetValue(z, out string? name) ? name : null;
            string? changes = ReservationJournal.Changes(
                new ReservationJournal.Fields(reservation.ServiceDay, localTime, reservation.Covers, reservation.Duration,
                    reservation.Note, reservation.PreferredZoneId, NameOf(reservation.PreferredZoneId)),
                new ReservationJournal.Fields(request.ServiceDay, request.Time, request.Covers, duration, note, zoneId, NameOf(zoneId)));
            if (changes == null)
            {
                return Ok(new ReservationActionResponse { Reservation = await DetailAsync(id), EventId = null });
            }

            ReservationValues before = ReservationValues.Of(reservation);
            reservation.ServiceDay = request.ServiceDay;
            reservation.Start = start;
            reservation.Covers = request.Covers;
            reservation.Duration = duration;
            reservation.Note = note;
            reservation.PreferredZoneId = zoneId;
            EventLog line = NewEvent(id, EventType.Modification, changes);
            context.EventLogs.Add(line);
            await context.SaveChangesAsync();
            await transaction.CommitAsync();

            _undo.Remember(line.Id, new UndoEntry(id, CurrentUserId, UndoKind.Modification) { ValuesBefore = before });
            await NotifyAsync(reservation.ClientId != null);
            return Ok(new ReservationActionResponse { Reservation = await DetailAsync(id), EventId = line.Id });
        }

        [HttpPost("{id:guid}/accept")]
        [ProducesResponseType<ReservationActionResponse>(StatusCodes.Status200OK)]
        public Task<IActionResult> Accept([FromRoute] Guid id) => ActAsync(id, ReservationGesture.Accept);

        [HttpPost("{id:guid}/refuse")]
        [ProducesResponseType<ReservationActionResponse>(StatusCodes.Status200OK)]
        public Task<IActionResult> Refuse([FromRoute] Guid id) => ActAsync(id, ReservationGesture.Refuse);

        [HttpPost("{id:guid}/arrive")]
        [ProducesResponseType<ReservationActionResponse>(StatusCodes.Status200OK)]
        public Task<IActionResult> Arrive([FromRoute] Guid id) => ActAsync(id, ReservationGesture.Arrive);

        [HttpPost("{id:guid}/release")]
        [ProducesResponseType<ReservationActionResponse>(StatusCodes.Status200OK)]
        public Task<IActionResult> Release([FromRoute] Guid id) => ActAsync(id, ReservationGesture.Release);

        [HttpPost("{id:guid}/no-show")]
        [ProducesResponseType<ReservationActionResponse>(StatusCodes.Status200OK)]
        public Task<IActionResult> NoShow([FromRoute] Guid id) => ActAsync(id, ReservationGesture.NoShow);

        [HttpPost("{id:guid}/cancel")]
        [ProducesResponseType<ReservationActionResponse>(StatusCodes.Status200OK)]
        public Task<IActionResult> Cancel([FromRoute] Guid id, [FromBody] CancelReservationRequest request) =>
            ActAsync(id, ReservationGesture.Cancel, request.By);

        [HttpPost("{id:guid}/reopen")]
        [ProducesResponseType<ReservationActionResponse>(StatusCodes.Status200OK)]
        public Task<IActionResult> Reopen([FromRoute] Guid id) => ActAsync(id, ReservationGesture.Reopen);

        /// <summary>
        /// Le bandeau « Annuler » (§6.7) : défait la dernière écriture de son auteur, dans les 30 s, si rien ne l'a suivie.
        /// Une action défaite ne laisse aucune trace au journal
        /// </summary>
        [HttpPost("{id:guid}/undo/{eventId:guid}")]
        [ProducesResponseType<ReservationResponse>(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> Undo([FromRoute] Guid id, [FromRoute] Guid eventId)
        {
            UndoEntry entry = _undo.Find(eventId) is UndoEntry found && found.ReservationId == id && found.UserId == CurrentUserId
                ? found
                : throw new ApiErrorException(ApiError.UndoExpired);

            await using var transaction = await context.Database.BeginTransactionAsync();
            Reservation reservation = await LockAsync(id);
            // Toute écriture ajoute une ligne : si celle-ci n'est plus la dernière, quelque chose l'a suivie
            Guid? last = await context.EventLogs
                .Where(e => e.ReservationId == id)
                .OrderByDescending(e => e.Timestamp)
                .Select(e => (Guid?)e.Id)
                .FirstOrDefaultAsync();
            if (last != eventId)
            {
                throw new ApiErrorException(ApiError.ReservationChanged);
            }

            Guid? clientId = reservation.ClientId;
            if (entry.Kind == UndoKind.Creation)
            {
                // Le journal et les affectations partent avec la réservation (suppression en cascade)
                context.Reservations.Remove(reservation);
                await context.SaveChangesAsync();
                if (entry.CreatedClientId is Guid createdId)
                {
                    await context.Clients
                        .Where(c => c.Id == createdId && !c.Reservations.Any())
                        .ExecuteDeleteAsync();
                }
            }
            else
            {
                ReservationStatus after = reservation.Status;
                (DateTime Start, int Duration, Guid? ClientId) slotAfter = (reservation.Start, reservation.Duration, reservation.ClientId);
                entry.ValuesBefore?.ApplyTo(reservation);
                entry.StateBefore?.ApplyTo(reservation);
                // Défaire une annulation ou un déplacement reprend un créneau : il a pu être repris par le même client entre-temps
                bool takesASlotAgain = ActiveStatuses.Contains(reservation.Status)
                    && (!ActiveStatuses.Contains(after) || slotAfter != (reservation.Start, reservation.Duration, reservation.ClientId));
                if (takesASlotAgain)
                {
                    TimeZoneInfo timeZone = TimeZoneInfo.FindSystemTimeZoneById((await LoadRestaurantAsync()).TimeZone);
                    await CheckNoOverlapAsync(reservation.ClientId, id, reservation.Start, reservation.Duration, timeZone);
                }
                foreach (Table table in TablesOf(reservation.LatestAssignment()))
                {
                    if (entry.TablesBefore.TryGetValue(table.Id, out DateTime? cleaningSince))
                    {
                        table.NeedsCleaningSince = cleaningSince;
                    }
                }
                context.EventLogs.Remove(await context.EventLogs.FirstAsync(e => e.Id == eventId));
                await context.SaveChangesAsync();

                // Le client est relu sous verrou : après une fusion, c'est la fiche gardée qui rend le compteur
                (int Visits, int NoShows) delta = ClientCounters.Delta(after, reservation.Status);
                await ApplyCountersAsync(reservation.ClientId, delta);
                clientId = reservation.ClientId;
            }
            await transaction.CommitAsync();

            _undo.Forget(eventId);
            await NotifyAsync(clientId != null);
            return entry.Kind == UndoKind.Creation ? NoContent() : Ok(await DetailAsync(id));
        }

        /// <summary>
        /// Un geste : verrou, règle du geste sur le statut relu, écriture, compteurs en base, journal — dans une transaction.
        /// Le même geste envoyé deux fois trouve, la seconde fois, un statut qui ne l'admet plus : 409
        /// </summary>
        private async Task<IActionResult> ActAsync(Guid id, ReservationGesture gesture, CancelledBy by = CancelledBy.Client)
        {
            await using var transaction = await context.Database.BeginTransactionAsync();
            Reservation reservation = await LockAsync(id);
            ReservationStatus from = reservation.Status;
            bool closedByRefusal = gesture == ReservationGesture.Reopen && from == ReservationStatus.Cancelled
                && await context.EventLogs
                    .Where(e => e.ReservationId == id && (e.Type == EventType.Refusal || e.Type == EventType.Cancellation))
                    .OrderByDescending(e => e.Timestamp)
                    .Select(e => (EventType?)e.Type)
                    .FirstOrDefaultAsync() == EventType.Refusal;
            ReservationStatus to = ReservationTransitions.Target(gesture, from, closedByRefusal)
                ?? throw new ApiErrorException(ApiError.ReservationActionNotAllowed, $"{gesture} is not possible on a {from} reservation.");

            if (gesture == ReservationGesture.Reopen)
            {
                TimeZoneInfo timeZone = TimeZoneInfo.FindSystemTimeZoneById((await LoadRestaurantAsync()).TimeZone);
                await CheckNoOverlapAsync(reservation.ClientId, id, reservation.Start, reservation.Duration, timeZone);
            }
            Assignment? assignment = reservation.LatestAssignment();
            DateTime now = DateTime.UtcNow;
            if (gesture == ReservationGesture.Arrive && assignment == null)
            {
                throw new ApiErrorException(ApiError.ReservationActionNotAllowed, "the reservation is not placed at a table yet.");
            }
            if (gesture == ReservationGesture.NoShow)
            {
                int lateGrace = await context.Restaurants.Where(r => r.Id == CurrentRestaurantId).Select(r => r.LateGrace).FirstAsync();
                // FICHE-05 : un no-show inscrit trop tôt reste dans l'historique d'un client fidèle
                if (now < reservation.Start.AddMinutes(lateGrace))
                {
                    throw new ApiErrorException(ApiError.ReservationActionNotAllowed, "a no-show can only be noted once the late grace has passed.");
                }
            }

            ReservationState before = ReservationState.Of(reservation);
            var tablesBefore = new Dictionary<Guid, DateTime?>();
            reservation.Status = to;
            switch (gesture)
            {
                case ReservationGesture.Arrive:
                    reservation.SeatedAt = now;
                    break;
                case ReservationGesture.Release:
                    reservation.FinishedAt = now;
                    // DISPO-03 / NET-01 : libérer passe la table, ou chaque table du groupe, « à nettoyer » si le restaurant le suit
                    if (await context.Restaurants.Where(r => r.Id == CurrentRestaurantId).Select(r => r.TrackTableCleaning).FirstAsync())
                    {
                        foreach (Table table in TablesOf(assignment))
                        {
                            tablesBefore[table.Id] = table.NeedsCleaningSince;
                            table.NeedsCleaningSince = now;
                        }
                    }
                    break;
                case ReservationGesture.Refuse:
                    reservation.CancelledAt = now;
                    reservation.CancelledBy = CancelledBy.Restaurant;
                    break;
                case ReservationGesture.Cancel:
                    reservation.CancelledAt = now;
                    reservation.CancelledBy = by;
                    break;
                case ReservationGesture.Reopen:
                    reservation.FinishedAt = null;
                    reservation.AutoClosed = false;
                    reservation.CancelledAt = null;
                    reservation.CancelledBy = null;
                    break;
            }
            string? details = gesture == ReservationGesture.Cancel
                ? (by == CancelledBy.Client ? "par le client" : "par le restaurant")
                : null;
            EventLog line = NewEvent(id, ReservationTransitions.EventOf(gesture), details);
            context.EventLogs.Add(line);
            await context.SaveChangesAsync();

            (int Visits, int NoShows) delta = ClientCounters.Delta(from, to);
            await ApplyCountersAsync(reservation.ClientId, delta);
            await transaction.CommitAsync();

            _undo.Remember(line.Id, new UndoEntry(id, CurrentUserId, UndoKind.Transition)
            {
                StateBefore = before,
                TablesBefore = tablesBefore,
            });
            await NotifyAsync(reservation.ClientId != null);
            return Ok(new ReservationActionResponse { Reservation = await DetailAsync(id), EventId = line.Id });
        }

        private static readonly ReservationStatus[] ActiveStatuses = [ReservationStatus.Pending, ReservationStatus.Confirmed, ReservationStatus.Seated];

        /// <summary>
        /// Un client ne tient pas deux tables à la fois : une autre de ses réservations actives qui chevauche ce créneau
        /// est un doublon. Bout à bout, ou le midi et le soir, c'est permis ; un client de passage n'est jamais concerné
        /// </summary>
        private async Task CheckNoOverlapAsync(Guid? clientId, Guid? reservationId, DateTime start, int duration, TimeZoneInfo timeZone)
        {
            if (clientId is not Guid id)
            {
                return;
            }
            DateTime end = start.AddMinutes(duration);
            // Une réservation dure moins d'un jour : celles commencées la veille suffisent à couvrir le début du créneau
            var others = await context.Reservations
                .Where(r => r.ClientId == id && r.Id != reservationId && ActiveStatuses.Contains(r.Status)
                    && r.Start < end && r.Start > start.AddDays(-1))
                .Select(r => new { r.Start, r.Duration, r.ServiceDay, r.Client!.Name })
                .ToListAsync();
            var clash = others.Where(r => r.Start.AddMinutes(r.Duration) > start).OrderBy(r => r.Start).FirstOrDefault();
            if (clash != null)
            {
                throw new ApiErrorException(ApiError.ClientAlreadyBooked, clash.Name,
                    ReservationClock.LocalTime(clash.Start, timeZone).ToString("HH:mm"), clash.ServiceDay.ToString("yyyy-MM-dd"));
            }
        }

        /// <summary>
        /// Les listes de réservations se rechargent ; les écrans Clients aussi quand la réservation est celle d'un client :
        /// sa fiche montre son historique et sa liste le jour de sa dernière réservation, même quand aucun compteur ne bouge
        /// </summary>
        private async Task NotifyAsync(bool ofAClient)
        {
            await NotifyChangedAsync(DataScope.Reservations);
            if (ofAClient)
            {
                await NotifyChangedAsync(DataScope.Clients);
            }
        }

        /// <summary>
        /// Verrouille la réservation jusqu'à la fin de la transaction de l'appelant, puis la lit avec ses affectations :
        /// deux écritures sur la même réservation passent l'une après l'autre, et la seconde relit ce qu'a laissé la première
        /// </summary>
        private async Task<Reservation> LockAsync(Guid id)
        {
            await context.Database.ExecuteSqlAsync(
                $"SELECT 1 FROM \"Reservations\" WHERE \"Id\" = {id} AND \"RestaurantId\" = {CurrentRestaurantId} FOR UPDATE");
            return await context.Reservations
                .Where(r => r.Id == id && r.RestaurantId == CurrentRestaurantId)
                .Include(r => r.Assignments).ThenInclude(a => a.Table)
                .Include(r => r.Assignments).ThenInclude(a => a.Combination).ThenInclude(c => c!.Tables)
                .AsSplitQuery()
                .FirstOrDefaultAsync()
                ?? throw new ApiErrorException(ApiError.NotFound, "Reservation not found.");
        }

        /// <summary>Les tables physiques d'une affectation : la table, ou les membres de la combinaison</summary>
        private static IEnumerable<Table> TablesOf(Assignment? assignment) =>
            assignment?.Table is Table table ? [table] : assignment?.Combination?.Tables ?? [];

        /// <summary>CPT-02 : l'incrément se fait en base, jamais lu puis réécrit — deux réservations du même client ne perdent rien</summary>
        private async Task ApplyCountersAsync(Guid? clientId, (int Visits, int NoShows) delta)
        {
            if (clientId is not Guid id || delta == (0, 0))
            {
                return;
            }
            await context.Clients
                .Where(c => c.Id == id)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.VisitCount, c => c.VisitCount + delta.Visits)
                    .SetProperty(c => c.NoShowCount, c => c.NoShowCount + delta.NoShows));
        }

        private async Task<Restaurant> LoadRestaurantAsync() =>
            await context.Restaurants.Include(r => r.Services).AsNoTracking().FirstAsync(r => r.Id == CurrentRestaurantId);

        /// <summary>Le jour de service en cours : la veille tant qu'une de ses plages passe minuit et dure encore (§4.3)</summary>
        private async Task<DateOnly> ServiceDayAsync(Restaurant restaurant, TimeZoneInfo timeZone)
        {
            DateOnly yesterday = ReservationImpact.Today(timeZone).AddDays(-1);
            return ServiceView.ServiceDayAt(DateTime.UtcNow, timeZone, await WindowsAsync(restaurant, yesterday));
        }

        private async Task<List<ReservationClock.Window>> WindowsAsync(Restaurant restaurant, DateOnly day)
        {
            List<Closure> closures = await context.Closures
                .Where(c => c.RestaurantId == CurrentRestaurantId && c.From <= day && c.To >= day)
                .AsNoTracking()
                .ToListAsync();
            return ReservationClock.WindowsOf(day, restaurant.Services, closures, restaurant.DefaultRotation);
        }

        /// <summary>Le début UTC et la plage d'un repas ; un jour passé, fermé, ou une heure hors des plages ouvertes sont refusés</summary>
        private async Task<(DateTime Start, ReservationClock.Window Window)> ScheduleAsync(
            Restaurant restaurant, TimeZoneInfo timeZone, DateOnly day, TimeOnly time)
        {
            if (day < await ServiceDayAsync(restaurant, timeZone))
            {
                throw new ApiErrorException(ApiError.OutsideService, "this day is past.");
            }
            ReservationClock.Window window = ReservationClock.WindowAt(await WindowsAsync(restaurant, day), time)
                ?? throw new ApiErrorException(ApiError.OutsideService, $"no opening on {day:yyyy-MM-dd} at {time.ToString("HH:mm")}.");
            return (ReservationClock.StartUtc(day, time, window, timeZone), window);
        }

        private static void CheckBooking(int covers, int duration, string? note)
        {
            if (covers < 1 || covers > MaxCovers)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, $"covers must be between 1 and {MaxCovers}.");
            }
            if (duration < MinDuration || duration > MaxDuration)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, $"duration must be between {MinDuration} and {MaxDuration} minutes.");
            }
            if (Optional(note)?.Length > MaxNoteLength)
            {
                throw new ApiErrorException(ApiError.InvalidRequest, $"note is longer than {MaxNoteLength} characters.");
            }
        }

        private async Task<Guid?> CheckZoneAsync(Guid? zoneId)
        {
            if (zoneId is Guid id && !await context.Zones.AnyAsync(z => z.Id == id && z.RestaurantId == CurrentRestaurantId))
            {
                throw new ApiErrorException(ApiError.InvalidRequest, "unknown zone.");
            }
            return zoneId;
        }

        private EventLog NewEvent(Guid reservationId, EventType type, string? details) => new()
        {
            Id = Guid.NewGuid(),
            ReservationId = reservationId,
            Timestamp = DateTime.UtcNow,
            Type = type,
            AuthorId = CurrentUserId,
            Details = details,
        };

        /// <summary>La fiche relue en base, sans suivi : les compteurs viennent d'être incrémentés par la base</summary>
        private async Task<ReservationResponse> DetailAsync(Guid id)
        {
            Reservation reservation = await context.Reservations
                .Where(r => r.Id == id && r.RestaurantId == CurrentRestaurantId)
                .Include(r => r.Client)
                .Include(r => r.PreferredZone)
                .Include(r => r.Assignments).ThenInclude(a => a.Table)
                .Include(r => r.Assignments).ThenInclude(a => a.Combination)
                .Include(r => r.Events).ThenInclude(e => e.Author)
                .AsSplitQuery()
                .AsNoTracking()
                .FirstOrDefaultAsync()
                ?? throw new ApiErrorException(ApiError.NotFound, "Reservation not found.");
            int lateGrace = await context.Restaurants.Where(r => r.Id == CurrentRestaurantId).Select(r => r.LateGrace).FirstAsync();
            DateOnly? lastVisitDay = reservation.ClientId is Guid clientId
                ? await context.Reservations
                    .Where(r => r.ClientId == clientId && (r.Status == ReservationStatus.Seated || r.Status == ReservationStatus.Finished))
                    .MaxAsync(r => (DateOnly?)r.ServiceDay)
                : null;
            return reservation.ToResponse(lateGrace, lastVisitDay);
        }

        private static string? Optional(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();
    }
}
