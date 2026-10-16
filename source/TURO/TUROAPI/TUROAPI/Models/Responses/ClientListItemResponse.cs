using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Responses
{
    /// <summary>Une ligne de la liste des clients (CLI-01)</summary>
    public class ClientListItemResponse
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public List<ClientTag> Tags { get; set; } = [];
        public bool HasAllergy { get; set; }
        /// <summary>Le texte, pour la carte du formulaire de réservation (§8.5)</summary>
        public string? Allergies { get; set; }
        public int VisitCount { get; set; }
        public int NoShowCount { get; set; }
        public bool AtRisk { get; set; }
        /// <summary>Jour de service de la réservation la plus récente, à venir comprise</summary>
        public DateOnly? LastServiceDay { get; set; }
    }
}
