namespace TUROAPI.Models.Enums
{
    /// <summary>Le catalogue des raisons (§3.5) : des données, que le front rédige</summary>
    public enum PlacementReasonKind
    {
        ExtraSeats,
        BeyondTolerance,
        NeedsCleaning,
        OtherZone,
        // Réservée juste après : moins de 15 min de marge
        NextSoon,
        // Table seule, collée dans une combinaison active : il faudra les séparer
        Glued
    }
}
