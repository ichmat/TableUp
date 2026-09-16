export type EventType =
    | 'Creation'
    | 'Acceptance'
    | 'Refusal'
    | 'Reminder'
    | 'ClientConfirmation'
    | 'Placement'
    | 'Move'
    | 'Arrival'
    | 'Release'
    | 'NoShow'
    | 'Cancellation'
    | 'Modification';

/** Le journal d'une réservation : une ligne par fait */
export interface EventLog {
    id: string,
    reservationId: string,
    /** Horodatage ISO 8601 */
    timestamp: string,
    type: EventType,
    /** `null` si l'auteur est le système */
    authorId: string | null,
    /** Ce qui a changé */
    details: string | null,
}
