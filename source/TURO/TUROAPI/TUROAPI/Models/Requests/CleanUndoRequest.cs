namespace TUROAPI.Models.Requests
{
    /// <summary>Annuler « Nettoyée » : la date d'avant, renvoyée par le geste</summary>
    public class CleanUndoRequest
    {
        public DateTime Since { get; set; }
    }
}
