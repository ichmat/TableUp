using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TUROAPI.Models
{
    // One row per save of the text: never modified, never deleted (COND-01)
    public class CancellationConditions
    {
        [Key]
        public Guid Id { get; set; }

        [ForeignKey(nameof(Restaurant))]
        public Guid RestaurantId { get; set; }
        public Restaurant Restaurant { get; set; } = null!;

        public int Version { get; set; }

        // Empty allowed
        public string Text { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }
        [ForeignKey(nameof(CreatedBy))]
        public Guid CreatedById { get; set; }
        public UserStaff CreatedBy { get; set; } = null!;
    }
}
