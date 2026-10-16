namespace TUROAPI.Models.Enums
{
    public enum EventType
    {
        Creation,
        Acceptance,
        Refusal,
        Reminder,
        ClientConfirmation,
        Placement,
        Move,
        Arrival,
        Release,
        NoShow,
        Cancellation,
        Modification,
        // « Rouvrir » une réservation close par erreur (§6.5)
        Reopening
    }
}
