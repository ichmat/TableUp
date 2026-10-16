namespace TUROAPI.Models.Enums
{
    /// <summary>Les périodes de l'écran Réservations (§6.1) : à partir d'aujourd'hui, aujourd'hui seul, avant aujourd'hui</summary>
    public enum ReservationPeriod
    {
        Upcoming,
        Today,
        Past
    }
}
