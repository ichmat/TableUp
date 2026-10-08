using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Requests
{
    /// <summary>Paramètres de `GET /api/clients`</summary>
    public class ClientListQuery
    {
        public string? Search { get; set; }
        /// <summary>Numéro entier (normalisé) : la reconnaissance du formulaire de réservation, jamais un morceau</summary>
        public string? Phone { get; set; }
        public ClientSort Sort { get; set; } = ClientSort.Recent;
        public ClientTag? Tag { get; set; }
        public bool AtRisk { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; } = 50;
    }
}
