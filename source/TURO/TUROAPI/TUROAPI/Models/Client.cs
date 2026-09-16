using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using TUROAPI.Models.Enums;

namespace TUROAPI.Models
{
    public class Client
    {
        [Key]
        public Guid Id { get; set; }

        [ForeignKey(nameof(Restaurant))]
        public Guid RestaurantId { get; set; }
        public Restaurant Restaurant { get; set; } = null!;

        public string Name { get; set; } = string.Empty;
        public string? Email { get; set; }

        // Identity key (email is the fallback key)
        public string? Phone { get; set; }

        public string? Allergies { get; set; }

        // Never leaves the software: no email, no widget
        public string? InternalNotes { get; set; }

        // Manual, never computed
        public List<ClientTag> Tags { get; set; } = [];

        // Stored cache, recountable
        public int VisitCount { get; set; }
        public int NoShowCount { get; set; }

        public bool MarketingConsent { get; set; }
        public DateTime? ConsentAt { get; set; }

        // Deleting a client = anonymizing it
        public DateTime? AnonymizedAt { get; set; }

        public List<Reservation> Reservations { get; set; } = [];
    }
}
