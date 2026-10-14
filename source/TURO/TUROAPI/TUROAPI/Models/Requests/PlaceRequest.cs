namespace TUROAPI.Models.Requests
{
    /// <summary>POST /api/reservations/{id}/place : exactement une cible</summary>
    public class PlaceRequest
    {
        public Guid? TableId { get; set; }
        /// <summary>Une combinaison collée, ou en sommeil (rapprochement prévu)</summary>
        public Guid? CombinationId { get; set; }
        /// <summary>PLACE-08 : une paire qu'aucune combinaison ne réunit ; elle naît en sommeil avec ce nom et ces places</summary>
        public NewCombinationRequest? NewCombination { get; set; }
    }

    public class NewCombinationRequest
    {
        public List<Guid> TableIds { get; set; } = [];
        public string Name { get; set; } = string.Empty;
        public int Capacity { get; set; }
    }
}
