using TUROAPI.Models.Enums;

namespace TUROAPI.Services
{
    /// <summary>Les gestes sur une réservation (§6.4, §6.5) : un endpoint chacun. Jamais sérialisé</summary>
    public enum ReservationGesture
    {
        Accept,
        Refuse,
        Arrive,
        Release,
        NoShow,
        Cancel,
        Reopen
    }

    /// <summary>La table des gestes : depuis quel statut chacun est permis, et vers quoi il mène. Aucune base</summary>
    public static class ReservationTransitions
    {
        /// <summary>Le statut d'arrivée, `null` si le geste est impossible depuis <paramref name="from"/></summary>
        /// <param name="closedByRefusal">Pour « Rouvrir » une annulée : sa dernière clôture était-elle un refus ? Elle redevient alors une demande</param>
        public static ReservationStatus? Target(ReservationGesture gesture, ReservationStatus from, bool closedByRefusal = false) =>
            (gesture, from) switch
            {
                (ReservationGesture.Accept, ReservationStatus.Pending) => ReservationStatus.Confirmed,
                (ReservationGesture.Refuse, ReservationStatus.Pending) => ReservationStatus.Cancelled,
                (ReservationGesture.Arrive, ReservationStatus.Confirmed) => ReservationStatus.Seated,
                (ReservationGesture.Release, ReservationStatus.Seated) => ReservationStatus.Finished,
                (ReservationGesture.NoShow, ReservationStatus.Confirmed) => ReservationStatus.NoShow,
                (ReservationGesture.Cancel, ReservationStatus.Pending or ReservationStatus.Confirmed) => ReservationStatus.Cancelled,
                (ReservationGesture.Reopen, ReservationStatus.NoShow) => ReservationStatus.Confirmed,
                (ReservationGesture.Reopen, ReservationStatus.Finished) => ReservationStatus.Seated,
                (ReservationGesture.Reopen, ReservationStatus.Cancelled) => closedByRefusal ? ReservationStatus.Pending : ReservationStatus.Confirmed,
                _ => null,
            };

        public static EventType EventOf(ReservationGesture gesture) => gesture switch
        {
            ReservationGesture.Accept => EventType.Acceptance,
            ReservationGesture.Refuse => EventType.Refusal,
            ReservationGesture.Arrive => EventType.Arrival,
            ReservationGesture.Release => EventType.Release,
            ReservationGesture.NoShow => EventType.NoShow,
            ReservationGesture.Cancel => EventType.Cancellation,
            _ => EventType.Reopening,
        };

        /// <summary>Terminée, no-show ou annulée : lecture seule, sauf « Rouvrir »</summary>
        public static bool IsClosed(ReservationStatus status) =>
            status is ReservationStatus.Finished or ReservationStatus.NoShow or ReservationStatus.Cancelled;
    }
}
