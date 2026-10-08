using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Responses
{
    /// <summary>La fiche réservation (§6.5)</summary>
    public class ReservationResponse
    {
        public Guid Id { get; set; }
        public DateTime Start { get; set; }
        public DateOnly ServiceDay { get; set; }
        public int Covers { get; set; }
        public int Duration { get; set; }
        public ReservationStatus Status { get; set; }
        public ReservationSource Source { get; set; }
        public string? Note { get; set; }
        public Guid? PreferredZoneId { get; set; }
        public string? PreferredZoneName { get; set; }
        public DateTime CreatedAt { get; set; }
        public CancelledBy? CancelledBy { get; set; }
        public uint Version { get; set; }
        /// <summary>Table ou combinaison de l'affectation la plus récente ; `null` si la réservation n'est pas placée</summary>
        public ReservationPlaceResponse? Place { get; set; }
        /// <summary>FICHE-06 : placée, et plus de couverts que la table n'a de places</summary>
        public bool PlaceTooSmall { get; set; }
        /// <summary>FICHE-05 : le no-show n'existe qu'à partir de `Start + LateGrace`</summary>
        public DateTime NoShowFrom { get; set; }
        /// <summary>`null` pour un client de passage</summary>
        public ReservationClientResponse? Client { get; set; }
        /// <summary>Du plus ancien au plus récent</summary>
        public List<ReservationEventResponse> Events { get; set; } = [];
    }

    public class ReservationPlaceResponse
    {
        public string Name { get; set; } = string.Empty;
        public int Capacity { get; set; }
    }

    /// <summary>Le bandeau client de la fiche (§6.5) et l'allergie épinglée (§6.6)</summary>
    public class ReservationClientResponse
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Allergies { get; set; }
        public List<ClientTag> Tags { get; set; } = [];
        public int VisitCount { get; set; }
        public int NoShowCount { get; set; }
        public bool AtRisk { get; set; }
        /// <summary>Jour de service de la visite (assise ou terminée) la plus récente</summary>
        public DateOnly? LastVisitDay { get; set; }
    }

    public class ReservationEventResponse
    {
        public Guid Id { get; set; }
        public DateTime Timestamp { get; set; }
        public EventType Type { get; set; }
        /// <summary>`null` : *système*</summary>
        public string? AuthorLogin { get; set; }
        public string? Details { get; set; }
    }
}
