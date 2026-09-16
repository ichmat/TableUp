using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using TUROAPI.Models.Enums;

namespace TUROAPI.Models
{
    public class Reservation
    {
        [Key]
        public Guid Id { get; set; }

        [ForeignKey(nameof(Restaurant))]
        public Guid RestaurantId { get; set; }
        public Restaurant Restaurant { get; set; } = null!;

        // Null for a walk-in: no client record is created
        [ForeignKey(nameof(Client))]
        public Guid? ClientId { get; set; }
        public Client? Client { get; set; }

        // UTC
        public DateTime Start { get; set; }

        // Minutes, copied from Restaurant.DefaultRotation at creation (RES-04)
        public int Duration { get; set; }

        // Local date of the service: a dinner started at 00:30 belongs to the day before (RES-02)
        public DateOnly ServiceDay { get; set; }

        public int Covers { get; set; }
        public ReservationStatus Status { get; set; }
        public ReservationSource Source { get; set; }

        // A preference, never a promise
        [ForeignKey(nameof(PreferredZone))]
        public Guid? PreferredZoneId { get; set; }
        public Zone? PreferredZone { get; set; }

        public DateTime? ReminderSentAt { get; set; }

        // Reply to the reminder. Null does not mean no-show
        public DateTime? ConfirmedByClientAt { get; set; }

        public DateTime? CancelledAt { get; set; }
        public CancelledBy? CancelledBy { get; set; }

        // Null when created by the restaurant
        [ForeignKey(nameof(CancellationConditions))]
        public Guid? CancellationConditionsId { get; set; }
        public CancellationConditions? CancellationConditions { get; set; }
        public DateTime? ConditionsAcceptedAt { get; set; }

        public string? Note { get; set; }

        public DateTime? SeatedAt { get; set; }

        // Null when closed automatically: the end time is unknown
        public DateTime? FinishedAt { get; set; }

        // Closed by the opening of the next service
        public bool AutoClosed { get; set; }

        public List<Assignment> Assignments { get; set; } = [];
        public List<EventLog> Events { get; set; } = [];
    }
}
