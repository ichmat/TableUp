import { ReservationStatus } from './reservation.model';

/** Miroir de `CombinationReminderKind` (§3.4) */
export type CombinationReminderKind = 'Approach' | 'Separate' | 'AfterNoShow';

/** Miroir de `ReminderAnswer` */
export type ReminderAnswer = 'Done' | 'Later' | 'Abandon' | 'Separate' | 'KeepTogether';

export interface ReminderReservation {
    id: string,
    /** ISO 8601 UTC */
    start: string,
    /** `null` : client de passage */
    guestName: string | null,
    covers: number,
    /** « Finalement non » ne vaut que pour une réservation confirmée */
    status: ReservationStatus,
    /** `AAAA-MM-JJ` */
    serviceDay: string,
    /** `Separate` : la table membre que la réservation attend seule */
    claimedTable: string | null,
}

/** GET /api/service/reminders : un rappel par combinaison ; aucun n'expire (COMB-06) */
export interface CombinationReminder {
    combinationId: string,
    name: string,
    kind: CombinationReminderKind,
    /** ISO 8601 UTC : il s'affiche à partir de cet instant */
    dueAt: string,
    tableIds: string[],
    tableNames: string[],
    reservation: ReminderReservation | null,
    /** « Oui, c'est fait » sépare ces combinaisons collées (COMB-04) */
    separates: string[],
}

/** Une table déplacée, en mètres (coin haut-gauche du rectangle non tourné) */
export interface TableMove {
    tableId: string,
    x: number,
    y: number,
}

/** POST /api/service/layout : un lâcher du mode édition */
export interface LayoutRequest {
    moves: TableMove[],
    glue?: { combinationId: string } | { tableIds: string[], name: string, capacity: number },
    separate?: { combinationId: string, reactivateId: string | null },
}

/** Un geste du service : de quoi le défaire pendant le bandeau */
export interface ServiceUndoResult {
    undoId: string,
}
