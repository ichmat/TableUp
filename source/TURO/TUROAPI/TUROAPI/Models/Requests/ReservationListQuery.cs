using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Requests
{
    /// <summary>Paramètres de `GET /api/reservations`</summary>
    public class ReservationListQuery
    {
        public ReservationPeriod Period { get; set; } = ReservationPeriod.Upcoming;
        public ReservationStatus? Status { get; set; }
        public ReservationSource? Source { get; set; }
        public Guid? ZoneId { get; set; }
        public string? Search { get; set; }
        /// <summary>Nombre de jours de service chargés (pagination par jours)</summary>
        public int Days { get; set; } = 14;
    }
}
