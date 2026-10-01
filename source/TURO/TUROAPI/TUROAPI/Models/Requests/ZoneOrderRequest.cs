namespace TUROAPI.Models.Requests
{
    public class ZoneOrderRequest
    {
        // Toutes les salles du restaurant, dans l'ordre des onglets
        public List<Guid> ZoneIds { get; set; } = [];
    }
}
