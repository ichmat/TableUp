using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using TUROAPI.Models.Enums;

namespace TUROAPI.Models
{
    // One row per fact in a reservation's history
    public class EventLog
    {
        [Key]
        public Guid Id { get; set; }

        [ForeignKey(nameof(Reservation))]
        public Guid ReservationId { get; set; }
        public Reservation Reservation { get; set; } = null!;

        public DateTime Timestamp { get; set; }
        public EventType Type { get; set; }

        // Null when the author is the system
        [ForeignKey(nameof(Author))]
        public Guid? AuthorId { get; set; }
        public UserStaff? Author { get; set; }

        public string? Details { get; set; }
    }
}
