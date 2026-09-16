using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TUROAPI.Models
{
    // Virtual table. No geometry of its own: drawn from its members' positions (MOD-02).
    public class Combination
    {
        [Key]
        public Guid Id { get; set; }

        [ForeignKey(nameof(Zone))]
        public Guid ZoneId { get; set; }
        public Zone Zone { get; set; } = null!;

        public string Name { get; set; } = string.Empty;

        // Entered at creation, never computed (MOD-03)
        public int Capacity { get; set; }

        public List<Table> Tables { get; set; } = [];

        // Tables pushed together right now
        public bool IsActive { get; set; }

        public DateTime? ActivateAt { get; set; }
        public DateTime? DeactivateAt { get; set; }

        public List<Assignment> Assignments { get; set; } = [];
    }
}
