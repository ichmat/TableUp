namespace TUROAPI.Models.Requests
{
    /// <summary>Paramètres › Règles de réservation : la fenêtre que le widget proposera (PAR-10)</summary>
    public class BookingWindowRequest
    {
        public int MinNoticeMinutes { get; set; }
        public int HorizonDays { get; set; }
    }
}
