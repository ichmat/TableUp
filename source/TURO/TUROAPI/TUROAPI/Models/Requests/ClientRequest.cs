using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Requests
{
    /// <summary>Création ou modification d'une fiche client. Le premier numéro et le premier e-mail sont les principaux</summary>
    public class ClientRequest
    {
        public string Name { get; set; } = string.Empty;
        public List<string> Phones { get; set; } = [];
        public List<string> Emails { get; set; } = [];
        public string? Allergies { get; set; }
        public string? InternalNotes { get; set; }
        public List<ClientTag> Tags { get; set; } = [];
        /// <summary>La version lue à l'ouverture du formulaire ; obligatoire pour une modification</summary>
        public uint? Version { get; set; }
    }
}
