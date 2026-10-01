using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TUROAPI.Models
{
    // The single unpublished floor plan of a restaurant (EDIT-15). Content is a serialized FloorPlanDraftContent
    public class FloorPlanDraft
    {
        [Key]
        public Guid RestaurantId { get; set; }
        public Restaurant Restaurant { get; set; } = null!;

        [Column(TypeName = "jsonb")]
        public string Content { get; set; } = "{}";

        public DateTime UpdatedAt { get; set; }

        [ForeignKey(nameof(UpdatedBy))]
        public Guid? UpdatedById { get; set; }
        public UserStaff? UpdatedBy { get; set; }
    }
}
