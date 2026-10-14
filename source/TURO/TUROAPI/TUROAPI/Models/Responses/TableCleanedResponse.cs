namespace TUROAPI.Models.Responses
{
    /// <summary>« Nettoyée » : la date d'avant, que le bandeau « Annuler » renvoie pour défaire</summary>
    public class TableCleanedResponse
    {
        public Guid TableId { get; set; }
        public DateTime Since { get; set; }
    }
}
