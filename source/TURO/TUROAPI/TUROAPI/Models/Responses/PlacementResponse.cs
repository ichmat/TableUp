using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Responses
{
    /// <summary>GET /api/service/placement/{id} : les halos d'une réservation (§3.5)</summary>
    public class PlacementResponse
    {
        public Guid ReservationId { get; set; }
        /// <summary>`null` : client de passage</summary>
        public string? GuestName { get; set; }
        /// <summary>L'intervalle testé, UTC</summary>
        public DateTime Start { get; set; }
        public DateTime End { get; set; }
        public int Covers { get; set; }
        public string? Note { get; set; }
        public Guid? PreferredZoneId { get; set; }
        public List<PlacementEntityResponse> Entities { get; set; } = [];
        /// <summary>RAPP-01 : combinaisons en sommeil et paires inédites, du plus proche au plus loin ; jamais ✓</summary>
        public List<PlacementApproachResponse> Approaches { get; set; } = [];
    }

    public class PlacementEntityResponse
    {
        public Guid? TableId { get; set; }
        public Guid? CombinationId { get; set; }
        public Guid ZoneId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public PlacementLevel Level { get; set; }
        public List<PlacementReasonResponse> Reasons { get; set; } = [];
        public PlacementNextResponse? Next { get; set; }
    }

    /// <summary>Une raison et ses données ; le front la rédige</summary>
    public class PlacementReasonResponse
    {
        public PlacementReasonKind Kind { get; set; }
        public int? Count { get; set; }
        public int? Tolerance { get; set; }
        public bool? NoneLeftOfCapacity { get; set; }
        public DateTime? Since { get; set; }
        public string? Guest { get; set; }
        public DateTime? LeftAt { get; set; }
        public string? RequestedZone { get; set; }
        public string? Note { get; set; }
        public DateTime? Start { get; set; }
        public int? Margin { get; set; }
        public int? DefaultRotation { get; set; }
        public string? Combination { get; set; }
        public List<string>? With { get; set; }
    }

    public class PlacementApproachResponse
    {
        /// <summary>`null` : une paire de tables qu'aucune combinaison ne réunit encore</summary>
        public Guid? CombinationId { get; set; }
        public List<Guid> TableIds { get; set; } = [];
        public Guid ZoneId { get; set; }
        /// <summary>« 12-13 » : le nom de la combinaison, ou celui qu'on proposera de lui donner</summary>
        public string Name { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public PlacementLevel Level { get; set; }
        public List<PlacementReasonResponse> Reasons { get; set; } = [];
        public PlacementNextResponse? Next { get; set; }
        /// <summary>En mètres, entre les centres les plus éloignés (RAPP-03)</summary>
        public double Distance { get; set; }
    }

    public class PlacementNextResponse
    {
        public DateTime Start { get; set; }
        public int Margin { get; set; }
        public string? Guest { get; set; }
    }
}
