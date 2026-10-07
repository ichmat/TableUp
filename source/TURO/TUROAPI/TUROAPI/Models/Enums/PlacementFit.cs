namespace TUROAPI.Models.Enums
{
    /// <summary>Verdict de places d'une table ou d'une combinaison pour une réservation (§4.3)</summary>
    public enum PlacementFit
    {
        /// <summary>Moins de places que de couverts : jamais de tolérance vers le bas</summary>
        TooSmall,
        /// <summary>Au plus une place vide</summary>
        Perfect,
        /// <summary>Places vides dans tolerance_places : une alternative quand rien n'est parfait</summary>
        WithinTolerance,
        /// <summary>Au-delà de tolerance_places : toujours plaçable, mais déconseillée</summary>
        NotAdvised
    }
}
