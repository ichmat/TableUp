using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Responses
{
    /// <summary>Une autre fiche active qui partage exactement un numéro ou un e-mail (§7.8)</summary>
    public class ClientMergeCandidateResponse
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public ClientSharedKey SharedKey { get; set; }
    }
}
