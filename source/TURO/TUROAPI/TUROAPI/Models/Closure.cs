using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using TUROAPI.Models.Enums;

namespace TUROAPI.Models
{
    // Exceptional closure or modified opening hours
    public class Closure
    {
        [Key]
        public Guid Id { get; set; }

        [ForeignKey(nameof(Restaurant))]
        public Guid RestaurantId { get; set; }
        public Restaurant Restaurant { get; set; } = null!;

        public DateOnly From { get; set; }
        public DateOnly To { get; set; }
        public ClosureType Type { get; set; }

        public List<ReplacementHours>? ReplacementHours { get; set; }

        // Reason and detail never leave the software (NOTIF-06)
        public ClosureReason Reason { get; set; }
        public string? ReasonDetail { get; set; }

        // What the affected customers receive
        public string? CustomerMessage { get; set; }
    }

    public class ReplacementHours
    {
        public TimeOnly Opening { get; set; }
        public TimeOnly Closing { get; set; }
    }
}
