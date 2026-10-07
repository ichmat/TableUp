using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Responses
{
    /// <summary>La fiche client complète (§7.5)</summary>
    public class ClientResponse
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public List<string> Phones { get; set; } = [];
        public List<string> Emails { get; set; } = [];
        public string? Allergies { get; set; }
        // Ne sort jamais du logiciel : ni e-mail, ni widget, ni export
        public string? InternalNotes { get; set; }
        public List<ClientTag> Tags { get; set; } = [];
        public int VisitCount { get; set; }
        public int NoShowCount { get; set; }
        public decimal? AverageCovers { get; set; }
        public bool AtRisk { get; set; }
        public bool MarketingConsent { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<ClientMergeCandidateResponse> MergeCandidates { get; set; } = [];
        public List<ClientHistoryItemResponse> History { get; set; } = [];
        /// <summary>À renvoyer avec une modification : une fiche changée entre-temps est refusée (409)</summary>
        public uint Version { get; set; }
    }
}
