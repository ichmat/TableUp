using System.Text.Json;
using System.Text.Json.Serialization;
using TUROAPI.Models.Requests;
using TUROAPI.Models.Responses;
using TUROAPI.Services;

namespace TUROAPI.Models.Wrapper
{
    public static class ModelWrapper
    {
        // Les enums partent en chaînes, comme dans le reste de l'API
        public static readonly JsonSerializerOptions DraftJsonOptions =
            new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

        public static FloorPlanDraftContent ReadContent(this FloorPlanDraft draft)
        {
            return JsonSerializer.Deserialize<FloorPlanDraftContent>(draft.Content, DraftJsonOptions) ?? new FloorPlanDraftContent();
        }

        public static FloorPlanDraftResponse ToResponse(this FloorPlanDraft draft)
        {
            FloorPlanDraftContent content = draft.ReadContent();
            return new FloorPlanDraftResponse
            {
                Tables = content.Tables,
                Decors = content.Decors,
                Combinations = content.Combinations,
                UpdatedAt = draft.UpdatedAt,
            };
        }

        public static UserStaffResponse ToResponse(this UserStaff user)
        {
            return new UserStaffResponse
            {
                Id = user.Id,
                RestaurantId = user.RestaurantId,
                Role = user.Role
            };
        }

        public static CancellationConditionsResponse ToResponse(this CancellationConditions condition)
        {
            return new CancellationConditionsResponse
            {
                Id = condition.Id,
                RestaurantId = condition.RestaurantId,
                Version = condition.Version,
                Text = condition.Text,
                CreatedAt = condition.CreatedAt,
                CreatedById = condition.CreatedById
            };
        }

        public static ServiceResponse ToResponse(this Service service)
        {
            return new ServiceResponse
            {
                Id = service.Id,
                RestaurantId = service.RestaurantId,
                Day = service.Day,
                Opening = service.Opening,
                Closing = service.Closing,
                SlotStep = service.SlotStep,
                OccupancyMode = service.OccupancyMode,
                ExpectedDuration = service.ExpectedDuration,
                MaxCadence = service.MaxCadence,
                CoverCap = service.CoverCap
            };
        }

        public static ClosureResponse ToResponse(this Closure closure)
        {
            return new ClosureResponse
            {
                Id = closure.Id,
                RestaurantId = closure.RestaurantId,
                From = closure.From,
                To = closure.To,
                Type = closure.Type,
                ReplacementHours = closure.ReplacementHours?
                    .Select(h => new ReplacementHoursResponse { Opening = h.Opening, Closing = h.Closing })
                    .ToList(),
                Reason = closure.Reason,
                ReasonDetail = closure.ReasonDetail,
                CustomerMessage = closure.CustomerMessage
            };
        }

        public static ImpactedReservationResponse ToImpactedResponse(this ReservationImpact.LocalReservation impacted)
        {
            Reservation reservation = impacted.Reservation;
            return new ImpactedReservationResponse
            {
                Id = reservation.Id,
                ServiceDay = reservation.ServiceDay,
                LocalStart = impacted.LocalStart,
                Covers = reservation.Covers,
                ClientName = reservation.Client?.Name,
                ClientPhone = reservation.Client?.Phone,
                Tables = reservation.Assignments
                    .Select(a => a.Table?.Name ?? a.Combination?.Name)
                    .OfType<string>()
                    .ToList()
            };
        }

        public static ZoneResponse ToResponse(this Zone zone)
        {
            return new ZoneResponse
            {
                Id = zone.Id,
                RestaurantId = zone.RestaurantId,
                Name = zone.Name,
                Order = zone.Order,
                Width = zone.Width,
                Height = zone.Height,
                Tables = zone.Tables.Select(t => t.ToResponse()).ToList(),
                Combinations = zone.Combinations.Select(c => c.ToResponse()).ToList(),
                Decors = zone.Decors.Select(d => d.ToResponse()).ToList()
            };
        }

        public static TableResponse ToResponse(this Table table)
        {
            return new TableResponse
            {
                Id = table.Id,
                ZoneId = table.ZoneId,
                Name = table.Name,
                Capacity = table.Capacity,
                Shape = table.Shape,
                X = table.X,
                Y = table.Y,
                Width = table.Width,
                Height = table.Height,
                Rotation = table.Rotation,
                NeedsCleaningSince = table.NeedsCleaningSince,
                IsActive = table.IsActive
            };
        }

        public static CombinationResponse ToResponse(this Combination combination)
        {
            return new CombinationResponse
            {
                Id = combination.Id,
                ZoneId = combination.ZoneId,
                Name = combination.Name,
                Capacity = combination.Capacity,
                TableIds = combination.Tables.Select(t => t.Id).ToList(),
                IsActive = combination.IsActive,
                ActivateAt = combination.ActivateAt,
                DeactivateAt = combination.DeactivateAt
            };
        }

        public static DecorResponse ToResponse(this Decor decor)
        {
            return new DecorResponse
            {
                Id = decor.Id,
                ZoneId = decor.ZoneId,
                Type = decor.Type,
                Label = decor.Label,
                X = decor.X,
                Y = decor.Y,
                Width = decor.Width,
                Height = decor.Height,
                Rotation = decor.Rotation
            };
        }

        public static RestaurantReponses ToResponse(this Restaurant restaurant)
        {
            return new RestaurantReponses
            {
                Id = restaurant.Id,
                Name = restaurant.Name,
                TimeZone = restaurant.TimeZone,
                DefaultRotation = restaurant.DefaultRotation,
                SeatTolerance = restaurant.SeatTolerance,
                LateGrace = restaurant.LateGrace,
                ReminderEnabled = restaurant.ReminderEnabled,
                ReminderDelayHours = restaurant.ReminderDelayHours,
                AutoConfirmation = restaurant.AutoConfirmation,
                SuggestCombinations = restaurant.SuggestCombinations,
                MinBookingNoticeMinutes = restaurant.MinBookingNoticeMinutes,
                BookingHorizonDays = restaurant.BookingHorizonDays,
                Zones = restaurant.Zones.Select(z => z.ToResponse()).ToList(),
                Services = restaurant.Services.Select(s => s.ToResponse()).ToList(),
                CancellationConditions = restaurant.CancellationConditions.Select(c => c.ToResponse()).ToList(),
                Users = restaurant.Users.Select(u => u.ToResponse()).ToList()
            };
        }

        public static ClientListItemResponse ToListItem(this Client client, DateOnly? lastServiceDay)
        {
            return new ClientListItemResponse
            {
                Id = client.Id,
                Name = client.Name,
                Phone = ContactList.Split(client.Phone).FirstOrDefault(),
                Tags = client.Tags,
                HasAllergy = !string.IsNullOrWhiteSpace(client.Allergies),
                Allergies = client.Allergies,
                VisitCount = client.VisitCount,
                NoShowCount = client.NoShowCount,
                AtRisk = ClientCounters.IsAtRisk(client),
                LastServiceDay = lastServiceDay,
            };
        }

        /// <summary>
        /// <paramref name="client"/> doit avoir ses réservations chargées, avec leurs affectations, tables et combinaisons
        /// </summary>
        public static ClientResponse ToResponse(this Client client, List<ClientMergeCandidateResponse> mergeCandidates)
        {
            List<Reservation> visits = client.Reservations.Where(r => ClientCounters.IsVisit(r.Status)).ToList();
            return new ClientResponse
            {
                Id = client.Id,
                Name = client.Name,
                Phones = ContactList.Split(client.Phone),
                Emails = ContactList.Split(client.Email),
                Allergies = client.Allergies,
                InternalNotes = client.InternalNotes,
                Tags = client.Tags,
                VisitCount = client.VisitCount,
                NoShowCount = client.NoShowCount,
                AverageCovers = visits.Count == 0 ? null : Math.Round((decimal)visits.Average(r => r.Covers), 1),
                AtRisk = ClientCounters.IsAtRisk(client),
                MarketingConsent = client.MarketingConsent,
                CreatedAt = client.CreatedAt,
                MergeCandidates = mergeCandidates,
                Version = client.Version,
                History = client.Reservations
                    .OrderByDescending(r => r.Start)
                    .Select(r => new ClientHistoryItemResponse
                    {
                        Id = r.Id,
                        Start = r.Start,
                        ServiceDay = r.ServiceDay,
                        Covers = r.Covers,
                        Status = r.Status,
                        PlaceName = r.Assignments
                            .OrderByDescending(a => a.AssignedAt)
                            .Select(a => a.Table?.Name ?? a.Combination?.Name)
                            .FirstOrDefault(),
                    })
                    .ToList(),
            };
        }

        /// <summary>L'affectation la plus récente : un déplacement en ajoute une, c'est la dernière qui compte</summary>
        public static Assignment? LatestAssignment(this Reservation reservation) =>
            reservation.Assignments.OrderByDescending(a => a.AssignedAt).FirstOrDefault();

        /// <summary>
        /// <paramref name="reservation"/> doit avoir son client, sa salle souhaitée, ses affectations (table, combinaison)
        /// et son journal (auteur) chargés
        /// </summary>
        public static ReservationResponse ToResponse(this Reservation reservation, int lateGrace, DateOnly? lastVisitDay)
        {
            Assignment? assignment = reservation.LatestAssignment();
            ReservationPlaceResponse? place = assignment == null ? null : new ReservationPlaceResponse
            {
                Name = assignment.Table?.Name ?? assignment.Combination?.Name ?? string.Empty,
                Capacity = assignment.Table?.Capacity ?? assignment.Combination?.Capacity ?? 0,
            };
            Client? client = reservation.Client;
            return new ReservationResponse
            {
                Id = reservation.Id,
                Start = reservation.Start,
                ServiceDay = reservation.ServiceDay,
                Covers = reservation.Covers,
                Duration = reservation.Duration,
                Status = reservation.Status,
                Source = reservation.Source,
                Note = reservation.Note,
                PreferredZoneId = reservation.PreferredZoneId,
                PreferredZoneName = reservation.PreferredZone?.Name,
                CreatedAt = reservation.CreatedAt,
                CancelledBy = reservation.CancelledBy,
                Version = reservation.Version,
                Place = place,
                PlaceTooSmall = place != null && reservation.Covers > place.Capacity,
                NoShowFrom = reservation.Start.AddMinutes(lateGrace),
                Client = client == null ? null : new ReservationClientResponse
                {
                    Id = client.Id,
                    Name = client.Name,
                    Phone = ContactList.Split(client.Phone).FirstOrDefault(),
                    Allergies = client.Allergies,
                    Tags = client.Tags,
                    VisitCount = client.VisitCount,
                    NoShowCount = client.NoShowCount,
                    AtRisk = ClientCounters.IsAtRisk(client),
                    LastVisitDay = lastVisitDay,
                },
                Events = reservation.Events
                    .OrderBy(e => e.Timestamp)
                    .Select(e => new ReservationEventResponse
                    {
                        Id = e.Id,
                        Timestamp = e.Timestamp,
                        Type = e.Type,
                        AuthorLogin = e.Author?.Login,
                        Details = e.Details,
                    })
                    .ToList(),
            };
        }

        /// <summary><paramref name="reservation"/> doit avoir son client et ses affectations (table, combinaison) chargés</summary>
        public static ReservationListItemResponse ToListItem(this Reservation reservation, int lateGrace)
        {
            Assignment? assignment = reservation.LatestAssignment();
            Client? client = reservation.Client;
            return new ReservationListItemResponse
            {
                Id = reservation.Id,
                Start = reservation.Start,
                ServiceDay = reservation.ServiceDay,
                Covers = reservation.Covers,
                Status = reservation.Status,
                Source = reservation.Source,
                Note = reservation.Note,
                PlaceName = assignment?.Table?.Name ?? assignment?.Combination?.Name,
                NoShowFrom = reservation.Start.AddMinutes(lateGrace),
                Client = client == null ? null : new ReservationListClientResponse
                {
                    Id = client.Id,
                    Name = client.Name,
                    Phone = ContactList.Split(client.Phone).FirstOrDefault(),
                    Tags = client.Tags,
                    HasAllergy = !string.IsNullOrWhiteSpace(client.Allergies),
                    VisitCount = client.VisitCount,
                    NoShowCount = client.NoShowCount,
                    AtRisk = ClientCounters.IsAtRisk(client),
                },
            };
        }

        public static ServiceWindowResponse ToResponse(this ReservationClock.Window window)
        {
            return new ServiceWindowResponse
            {
                Opening = window.Opening,
                Closing = window.Closing,
                SlotStep = window.SlotStep,
                Duration = window.Duration,
                Slots = ReservationClock.Slots(window),
            };
        }
    }

}