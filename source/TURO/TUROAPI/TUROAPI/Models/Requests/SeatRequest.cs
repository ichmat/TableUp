namespace TUROAPI.Models.Requests
{
    /// <summary>« Asseoir maintenant » (WALK-01) : les couverts, et l'accord donné quand la table est réservée plus tard</summary>
    public class SeatRequest
    {
        public int Covers { get; set; }
        public bool AcceptBookedLater { get; set; }
    }
}
