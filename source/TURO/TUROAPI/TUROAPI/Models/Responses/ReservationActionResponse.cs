namespace TUROAPI.Models.Responses
{
    /// <summary>Réponse de toute écriture : la fiche, et la ligne de journal que le bandeau peut défaire (`null` si rien n'a changé)</summary>
    public class ReservationActionResponse
    {
        public ReservationResponse Reservation { get; set; } = null!;
        public Guid? EventId { get; set; }
    }
}
