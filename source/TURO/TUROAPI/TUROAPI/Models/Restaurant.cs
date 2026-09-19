using System.ComponentModel.DataAnnotations;

namespace TUROAPI.Models
{
    public class Restaurant
    {
        [Key]
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;

        // IANA time zone, e.g. "Europe/Paris"
        public string TimeZone { get; set; } = string.Empty;

        // Default meal duration, in minutes
        public int DefaultRotation { get; set; }

        // Extra seats tolerated before the placement verdict degrades to "~✓"
        public int SeatTolerance { get; set; }

        // Minutes after the reservation time before showing the "late" ring
        public int LateGrace { get; set; }

        public bool ReminderEnabled { get; set; }
        public int ReminderDelayHours { get; set; }

        // Auto-confirms a web request placed on a clearly free slot
        public bool AutoConfirmation { get; set; }

        public List<Zone> Zones { get; set; } = [];
        public List<Service> Services { get; set; } = [];
        public List<Closure> Closures { get; set; } = [];
        public List<Reservation> Reservations { get; set; } = [];
        public List<Client> Clients { get; set; } = [];
        public List<CancellationConditions> CancellationConditions { get; set; } = [];
        public List<UserStaff> Users { get; set; } = [];
    }
}
