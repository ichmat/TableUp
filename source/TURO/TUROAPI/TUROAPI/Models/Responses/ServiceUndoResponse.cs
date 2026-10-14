namespace TUROAPI.Models.Responses
{
    /// <summary>Un geste du service (rappel, mode édition) : de quoi le défaire pendant le bandeau</summary>
    public class ServiceUndoResponse
    {
        public Guid UndoId { get; set; }
    }
}
