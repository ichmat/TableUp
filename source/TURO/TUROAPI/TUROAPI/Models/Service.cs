using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using TUROAPI.Models.Enums;

namespace TUROAPI.Models
{
    public class Service
    {
        [Key]
        public Guid Id { get; set; }

        [ForeignKey(nameof(Restaurant))]
        public Guid RestaurantId { get; set; }
        public Restaurant Restaurant { get; set; } = null!;

        public DayOfWeek Day { get; set; }
        public TimeOnly Opening { get; set; }
        public TimeOnly Closing { get; set; }

        // 15 or 30 minutes
        public int SlotStep { get; set; }

        public OccupancyMode OccupancyMode { get; set; }

        // Null inherits Restaurant.DefaultRotation
        public int? ExpectedDuration { get; set; }

        // Warnings only, never decide availability
        public int? MaxCadence { get; set; }
        public int? CoverCap { get; set; }
    }
}
