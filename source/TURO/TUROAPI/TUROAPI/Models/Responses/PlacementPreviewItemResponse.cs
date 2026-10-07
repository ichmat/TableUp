using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Responses
{
    /// <summary>Une table ou une combinaison active, jugée pour l'aperçu de la tolérance (PAR-08)</summary>
    public class PlacementPreviewItemResponse
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public PlacementEntityKind Kind { get; set; }
        public PlacementFit Fit { get; set; }
    }
}
