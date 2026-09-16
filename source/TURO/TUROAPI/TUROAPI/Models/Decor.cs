using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using TUROAPI.Models.Enums;

namespace TUROAPI.Models
{
    // Non-bookable landmark: no capacity, never offered for placement (MOD-04).
    public class Decor
    {
        [Key]
        public Guid Id { get; set; }

        [ForeignKey(nameof(Zone))]
        public Guid ZoneId { get; set; }
        public Zone Zone { get; set; } = null!;

        public DecorType Type { get; set; }
        public string? Label { get; set; }

        public double X { get; set; }
        public double Y { get; set; }
        public double Width { get; set; }
        public double Height { get; set; }
        public double Rotation { get; set; }
    }
}
