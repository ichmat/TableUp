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
        // Un brouillon enregistré avant les combinaisons se relit avec une liste vide
        public List<DraftCombinationItem> Combinations { get; set; } = [];
    }

    /// <summary>La table virtuelle (MOD-02, MOD-03) : un couple de tables et une capacité saisie, sans géométrie</summary>
    public class DraftCombinationItem
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public List<Guid> TableIds { get; set; } = [];
        /// <summary>Tables collées en ce moment : l'éditeur active en collant, désactive en séparant. Absent d'un ancien brouillon : false</summary>
        public bool IsActive { get; set; }
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
