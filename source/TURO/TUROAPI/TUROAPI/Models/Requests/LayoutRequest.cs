namespace TUROAPI.Models.Requests
{
    /// <summary>POST /api/service/layout : un lâcher du mode édition — des tables déplacées, et au plus un collage ou une séparation</summary>
    public class LayoutRequest
    {
        public List<TableMoveRequest> Moves { get; set; } = [];
        public GlueRequest? Glue { get; set; }
        public SeparateRequest? Separate { get; set; }
    }

    /// <summary>En mètres, coin haut-gauche du rectangle non tourné ; la salle ne change pas</summary>
    public class TableMoveRequest
    {
        public Guid TableId { get; set; }
        public double X { get; set; }
        public double Y { get; set; }
    }

    /// <summary>Une combinaison existante (`CombinationId`), ou des tables qu'aucune ne réunit, avec un nom et des places</summary>
    public class GlueRequest
    {
        public Guid? CombinationId { get; set; }
        public List<Guid> TableIds { get; set; } = [];
        public string? Name { get; set; }
        public int Capacity { get; set; }
    }

    /// <summary>`ReactivateId` : la combinaison des tables restées collées, qui redevient active</summary>
    public class SeparateRequest
    {
        public Guid CombinationId { get; set; }
        public Guid? ReactivateId { get; set; }
    }
}
