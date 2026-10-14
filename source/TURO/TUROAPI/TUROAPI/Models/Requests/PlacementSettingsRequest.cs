namespace TUROAPI.Models.Requests
{
    /// <summary>Paramètres › Placement (§13.4)</summary>
    public class PlacementSettingsRequest
    {
        public int DefaultRotation { get; set; }
        public int SeatTolerance { get; set; }
        public int LateGrace { get; set; }
        public bool SuggestCombinations { get; set; }
        public bool TrackTableCleaning { get; set; }
    }
}
