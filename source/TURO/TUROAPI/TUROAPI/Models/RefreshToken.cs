using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TUROAPI.Models
{
    public class RefreshToken
    {
        [Key]
        public required string Token { get; set; }

        [ForeignKey(nameof(User))]
        public Guid UserId { get; set; }
        public UserStaff User { get; set; } = null!;

        public DateTime CreatedAt { get; set; }
        public DateTime? DestroyAt { get; set; }
        public DateTime? UsedAt { get; set; }
    }
}
