using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Requests
{
    /// <summary>Corps de `POST /api/reservations/{id}/cancel` : un client qui se désiste n'est pas un restaurant qui annule</summary>
    public class CancelReservationRequest
    {
        public CancelledBy By { get; set; }
    }
}
