/** Le restaurant, et ses réglages globaux */
export interface Restaurant {
    id: string,
    name: string,
    /** Fuseau horaire local au format IANA @example 'Europe/Paris' */
    timeZone: string,
    /** Durée par défaut d'un repas, en minutes @example 105 */
    defaultRotationMin: number,
    /** Places en trop tolérées avant de dégrader le verdict de placement en `~✓` */
    seatTolerance: number,
    /** Minutes après l'heure avant d'afficher l'anneau « en retard » */
    lateGraceMin: number,
    /** Active le rappel envoyé avant la réservation */
    reminderEnabled: boolean,
    /** Délai du rappel, en heures avant la réservation */
    reminderDelayHours: number,
    /** Confirme d'office une demande web posée sur un créneau franchement libre */
    autoConfirmation: boolean,
}
