using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Responses
{
    /// <summary>`GET /api/reservations` : des jours entiers, et la file des demandes</summary>
    public class ReservationPageResponse
    {
        public List<ReservationDayResponse> Days { get; set; } = [];
        public bool HasMore { get; set; }
        public PendingRequestsResponse Pending { get; set; } = new();
    }

    /// <summary>L'en-tête de jour (§6.1) et ses lignes</summary>
    public class ReservationDayResponse
    {
        public DateOnly ServiceDay { get; set; }
        /// <summary>Couverts confirmés, assis et terminés parmi les lignes affichées : une demande n'occupe rien</summary>
        public int Covers { get; set; }
        /// <summary>Confirmées sans table parmi les lignes affichées</summary>
        public int ToPlace { get; set; }
        public List<ReservationListItemResponse> Items { get; set; } = [];
    }

    /// <summary>Toutes les demandes à venir, sans tenir compte des filtres : le bandeau violet</summary>
    public class PendingRequestsResponse
    {
        public int Count { get; set; }
        public DateTime? OldestCreatedAt { get; set; }
    }

    /// <summary>Une ligne de l'écran Réservations (§6.1)</summary>
    public class ReservationListItemResponse
    {
        public Guid Id { get; set; }
        public DateTime Start { get; set; }
        public DateOnly ServiceDay { get; set; }
        public int Covers { get; set; }
        public ReservationStatus Status { get; set; }
        public ReservationSource Source { get; set; }
        public string? Note { get; set; }
        public string? PlaceName { get; set; }
        /// <summary>`null` pour un client de passage</summary>
        public ReservationListClientResponse? Client { get; set; }
        public DateTime NoShowFrom { get; set; }
    }

    /// <summary>Ce qu'il faut pour le nom et les marques qui voyagent avec la réservation (§5.6)</summary>
    public class ReservationListClientResponse
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public List<ClientTag> Tags { get; set; } = [];
        public bool HasAllergy { get; set; }
        public int VisitCount { get; set; }
        public int NoShowCount { get; set; }
        public bool AtRisk { get; set; }
    }
}
