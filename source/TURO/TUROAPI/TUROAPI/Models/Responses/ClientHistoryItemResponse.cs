using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Responses
{
    /// <summary>Une ligne d'historique de la fiche client (CLI-08)</summary>
    public class ClientHistoryItemResponse
    {
        public Guid Id { get; set; }
        public DateTime Start { get; set; }
        public DateOnly ServiceDay { get; set; }
        public int Covers { get; set; }
        public ReservationStatus Status { get; set; }
        /// <summary>Table ou combinaison de la dernière affectation ; `null` si la réservation n'est pas placée</summary>
        public string? PlaceName { get; set; }
    }
}
