import { PlanCombination, PlanDecor, PlanTable } from './floor-plan.model';
import { ReservationListClient, ReservationSource, ReservationStatus } from './reservation.model';

/** L'état d'un service vu de maintenant (§4.3) */
export type ServiceState = 'Finished' | 'InProgress' | 'Upcoming';

/** Le statut d'une table à une heure (§3.2) : jamais stocké, calculé depuis les occupations */
export type TableStatus = 'Free' | 'Reserved' | 'Occupied' | 'ToClean';

export interface ServiceInfo {
    /** `HH:mm:ss` */
    opening: string,
    closing: string,
    slotStep: number,
    state: ServiceState,
    /** Couverts confirmés, assis et terminés */
    expectedCovers: number,
    /** Places des tables actives, toutes salles */
    capacity: number,
}

/** Une plage du jour, dans le sélecteur */
export interface ServiceWindowState {
    opening: string,
    closing: string,
    state: ServiceState,
    expectedCovers: number,
}

/** Un créneau de la frise (§5.4) */
export interface ServiceSlot {
    /** `HH:mm:ss`, heure locale */
    time: string,
    /** ISO 8601 UTC : l'instant du créneau, calculé par l'API */
    at: string,
    covers: number,
    takenTables: number,
    /** Une réservation confirmée sans table commence dans ce créneau : le `!` violet */
    hasUnplaced: boolean,
}

/** Ce qui occupe une table, résolu par l'API (combinaisons comprises, §3.3) : `[start, end)` */
export interface TableOccupation {
    reservationId: string,
    start: string,
    end: string,
    status: ReservationStatus,
    /** L'anneau « en retard » à partir de cet instant ; `null` sauf pour une confirmée */
    lateFrom: string | null,
    /** « 12-13 » pour une combinaison */
    placeName: string,
    /** `null` : client de passage */
    guestName: string | null,
    covers: number,
    hasAllergy: boolean,
}

export interface ServiceTable extends PlanTable {
    /** ISO 8601 ; ignorée si le restaurant ne suit pas le nettoyage */
    needsCleaningSince: string | null,
    occupations: TableOccupation[],
}

export interface ServiceZone {
    id: string,
    name: string,
    width: number,
    height: number,
    tables: ServiceTable[],
    decors: PlanDecor[],
    /** Les combinaisons collées en ce moment */
    combinations: PlanCombination[],
}

/** Une pastille de la colonne « À placer » (§5.7) */
export interface ServiceReservation {
    id: string,
    start: string,
    covers: number,
    source: ReservationSource,
    client: ReservationListClient | null,
}

/** Une ligne de la fenêtre Allergies (§5.3) */
export interface ServiceAllergy {
    reservationId: string,
    start: string,
    guestName: string | null,
    allergies: string,
    /** `null` : « À placer » */
    placeName: string | null,
}

/** GET /api/service */
export interface ServiceSnapshot {
    /** `AAAA-MM-JJ` : le jour affiché, même fermé */
    day: string,
    /** L'horloge de l'API, ISO 8601 UTC */
    now: string,
    trackTableCleaning: boolean,
    lateGrace: number,
    /** Faux : l'en-tête propose « Aujourd'hui » */
    isDefault: boolean,
    service: ServiceInfo | null,
    windows: ServiceWindowState[],
    slots: ServiceSlot[],
    zones: ServiceZone[],
    toPlace: ServiceReservation[],
    pending: ServiceReservation[],
    allergies: ServiceAllergy[],
}

/** Rien : le service par défaut. `focus` : la plage de cette réservation */
export interface ServiceQuery {
    day: string | null,
    /** `HH:mm` */
    opening: string | null,
    focus: string | null,
}

/** POST /api/service/tables/{id}/clean : la date d'avant, pour l'annulation */
export interface TableCleaned {
    tableId: string,
    since: string,
}

/** Ce que le canevas dessine d'une table en service */
export interface TableMark {
    status: TableStatus,
    late: boolean,
    /** « Moreau · 20:00 » ; `null` pour une table sans occupation à cette heure */
    label: string | null,
    allergy: boolean,
}
