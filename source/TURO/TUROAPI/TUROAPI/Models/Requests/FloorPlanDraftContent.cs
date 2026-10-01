using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Requests
{
    /// <summary>
    /// L'état complet du plan à publier : toutes les tables actives du restaurant. Corps de PUT /draft et format stocké
    /// </summary>
    public class FloorPlanDraftContent
    {
        public List<DraftTableItem> Tables { get; set; } = [];
        // Un brouillon enregistré avant le décor se relit avec une liste vide
        public List<DraftDecorItem> Decors { get; set; } = [];
    }

    /// <summary>Un repère non réservable (MOD-04). Contrairement à une table, un décor absent du brouillon est supprimé</summary>
    public class DraftDecorItem
    {
        public Guid Id { get; set; }
        public Guid ZoneId { get; set; }
        public DecorType Type { get; set; }
        public string? Label { get; set; }
        public double X { get; set; }
        public double Y { get; set; }
        public double Width { get; set; }
        public double Height { get; set; }
        public double Rotation { get; set; }
    }

    /// <summary>Un Id absent de la base est une table nouvelle, généré par le front</summary>
    public class DraftTableItem
    {
        public Guid Id { get; set; }
        public Guid ZoneId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public TableShape Shape { get; set; }
        public double X { get; set; }
        public double Y { get; set; }
        public double Width { get; set; }
        public double Height { get; set; }
        public double Rotation { get; set; }
    }
}
