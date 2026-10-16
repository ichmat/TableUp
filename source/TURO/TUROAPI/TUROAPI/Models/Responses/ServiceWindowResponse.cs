namespace TUROAPI.Models.Responses
{
    /// <summary>Une plage ouverte d'un jour et ses créneaux : la bande d'heures du formulaire (§8.3)</summary>
    public class ServiceWindowResponse
    {
        public TimeOnly Opening { get; set; }
        public TimeOnly Closing { get; set; }
        public int SlotStep { get; set; }
        /// <summary>Durée par défaut d'un repas sur cette plage, en minutes</summary>
        public int Duration { get; set; }
        public List<TimeOnly> Slots { get; set; } = [];
    }
}
