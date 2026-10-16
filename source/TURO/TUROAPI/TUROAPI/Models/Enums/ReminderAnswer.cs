namespace TUROAPI.Models.Enums
{
    /// <summary>Les réponses à un rappel : Done / Later / Abandon au rapprochement, Separate / KeepTogether aux deux autres</summary>
    public enum ReminderAnswer
    {
        // « Oui, c'est fait »
        Done,
        // « Pas encore, me redemander dans 10 minutes »
        Later,
        // « Finalement non » : la réservation retourne dans « À placer »
        Abandon,
        // « Oui, les séparer »
        Separate,
        // « Non, les laisser ensemble »
        KeepTogether
    }
}
