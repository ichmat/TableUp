using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TUROAPI.Models
{
    // Link between a reservation and a bookable entity.
    // Exactly one of TableId / CombinationId must be set.
    public class Assignment
    {
        [Key]
        public Guid Id { get; set; }

        [ForeignKey(nameof(Reservation))]
        public Guid ReservationId { get; set; }
        public Reservation Reservation { get; set; } = null!;

        [ForeignKey(nameof(Table))]
        public Guid? TableId { get; set; }
        public Table? Table { get; set; }

        [ForeignKey(nameof(Combination))]
        public Guid? CombinationId { get; set; }
        public Combination? Combination { get; set; }

        [ForeignKey(nameof(AssignedBy))]
        public Guid? AssignedById { get; set; }
        public UserStaff? AssignedBy { get; set; }
        public DateTime AssignedAt { get; set; }
    }
}
