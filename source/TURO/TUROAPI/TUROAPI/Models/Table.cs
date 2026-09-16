using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using TUROAPI.Models.Enums;

namespace TUROAPI.Models
{
    // Physical, indivisible table. Never deleted, only deactivated (MOD-01).
    public class Table
    {
        [Key]
        public Guid Id { get; set; }

        [ForeignKey(nameof(Zone))]
        public Guid ZoneId { get; set; }
        public Zone Zone { get; set; } = null!;

        public string Name { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public TableShape Shape { get; set; }

        public double X { get; set; }
        public double Y { get; set; }
        public double Width { get; set; }
        public double Height { get; set; }
        public double Rotation { get; set; }

        // The only physical state stored
        public DateTime? NeedsCleaningSince { get; set; }

        public bool IsActive { get; set; } = true;

        public List<Combination> Combinations { get; set; } = [];
        public List<Assignment> Assignments { get; set; } = [];
    }
}
