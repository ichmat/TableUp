namespace TUROAPI.Models.Requests
{
    /// <summary>POST /api/reservations/{id}/place : exactement une cible</summary>
    public class PlaceRequest
    {
        public Guid? TableId { get; set; }
        public Guid? CombinationId { get; set; }
    }
}
