namespace TUROAPI.Models.Enums
{
    /// <summary>§3.5 : le verdict d'une table ou d'une combinaison pour une réservation</summary>
    public enum PlacementLevel
    {
        // Prise sur l'intervalle, ou trop petite : estompée, ni dépôt ni toucher
        Excluded,
        // ✓ : dépôt immédiat, aucun popup
        Perfect,
        // ~✓ : au moins une raison à dire au dépôt
        WithReserve,
        // ! : au-delà de la tolérance de places, toujours plaçable
        NotAdvised
    }
}
