export type ReservationStatus = 'Pending' | 'Confirmed' | 'Seated' | 'Finished' | 'NoShow' | 'Cancelled';

export type ReservationSource = 'Web' | 'Phone' | 'WalkIn' | 'Google' | 'Platform' | 'Other';

/** Qui a annulé : deux événements distincts, seul `Client` bouge ses compteurs */
export type CancelledBy = 'Client' | 'Restaurant';

export interface Reservation {
    id: string,
    restaurantId: string,
    /** `null` pour un client de passage, qui ne crée aucune fiche */
    clientId: string | null,
    /** Début de la réservation, horodatage ISO 8601 **en UTC** */
    start: string,
    /**
     * Durée en minutes, copiée de `Restaurant.defaultRotationMin` à la création.
     * @see ℹ️ Changer la rotation par défaut ne modifie aucune réservation existante
     */
    durationMin: number,
    /**
     * **Date locale du service**, au format `AAAA-MM-JJ`.
     * Un dîner commencé à 00:30 appartient à la veille — tous les regroupements s'appuient dessus
     */
    serviceDay: string,
    covers: number,
    /** @see ℹ️ Une réservation `Pending` ne réserve **aucune** table */
    status: ReservationStatus,
    /** Obligatoire */
    source: ReservationSource,
    /** Préférence de salle, jamais une promesse */
    preferredZoneId: string | null,
    /** Horodatage ISO 8601 du rappel envoyé */
    reminderSentAt: string | null,
    /** Réponse du client au rappel. `null` n'est **pas** un no-show */
    confirmedByClientAt: string | null,
    /** Horodatage ISO 8601 de l'annulation */
    cancelledAt: string | null,
    cancelledBy: CancelledBy | null,
    /** Version des conditions acceptée. `null` pour une création restaurateur */
    cancellationConditionsId: string | null,
    /** Horodatage ISO 8601 de l'acceptation des conditions */
    conditionsAcceptedAt: string | null,
    /** Commentaire attaché à *cette* réservation */
    note: string | null,
    /** Horodatage ISO 8601 de l'arrivée en salle */
    seatedAt: string | null,
    /** `null` quand la clôture est automatique : l'heure de fin est inconnue */
    finishedAt: string | null,
    /** Vrai si close par l'ouverture du service suivant */
    autoClosed: boolean,
}
