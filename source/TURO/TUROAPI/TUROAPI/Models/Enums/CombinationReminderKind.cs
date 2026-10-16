namespace TUROAPI.Models.Enums
{
    /// <summary>Les rappels d'une combinaison (§3.4) : le logiciel sonne, l'utilisateur répond</summary>
    public enum CombinationReminderKind
    {
        // En sommeil, une réservation l'attend : « Rapprocher 12 et 13 »
        Approach,
        // Collée, une réservation ultérieure prend une de ses tables seule
        Separate,
        // Collée pour un client qui ne viendra pas
        AfterNoShow
    }
}
