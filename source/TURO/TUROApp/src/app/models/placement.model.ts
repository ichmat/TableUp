/** Verdict de places d'une table ou d'une combinaison (§4.3), miroir de `PlacementFit` */
export type PlacementFit = 'TooSmall' | 'Perfect' | 'WithinTolerance' | 'NotAdvised';

/** Miroir de `PlacementEntityKind` */
export type PlacementEntityKind = 'Table' | 'Combination';

/** Une table ou une combinaison active, jugée par l'API pour l'aperçu de la tolérance (PAR-08) */
export interface PlacementPreviewItem {
    id: string,
    name: string,
    capacity: number,
    kind: PlacementEntityKind,
    fit: PlacementFit,
}

/** PUT /api/restaurant/settings/placement */
export interface PlacementSettingsRequest {
    defaultRotation: number,
    seatTolerance: number,
    lateGrace: number,
    suggestCombinations: boolean,
    /** « Libérer » passe la table « à nettoyer » */
    trackTableCleaning: boolean,
}

/** PUT /api/restaurant/settings/booking-window */
export interface BookingWindowRequest {
    minNoticeMinutes: number,
    horizonDays: number,
}

/** Mêmes bornes que l'API (`SettingsController`) */
export const PLACEMENT_LIMITS = {
    minRotation: 30,
    maxRotation: 360,
    rotationStep: 15,
    minSeatTolerance: 1,
    maxSeatTolerance: 20,
    maxLateGrace: 120,
    minPreviewCovers: 1,
    maxPreviewCovers: 50,
    maxMinNotice: 2880,
    minHorizon: 1,
    maxHorizon: 365,
} as const;

/** §3.5 : le verdict d'une table ou d'une combinaison pour une réservation */
export type PlacementLevel = 'Excluded' | 'Perfect' | 'WithReserve' | 'NotAdvised';

export type PlacementReasonKind = 'ExtraSeats' | 'BeyondTolerance' | 'NeedsCleaning' | 'OtherZone' | 'NextSoon' | 'Glued';

/** Une raison et ses données, rédigée par `placement-reasons.ts` ; seuls les champs de son `kind` sont remplis */
export interface PlacementReason {
    kind: PlacementReasonKind,
    count?: number | null,
    tolerance?: number | null,
    noneLeftOfCapacity?: boolean | null,
    since?: string | null,
    guest?: string | null,
    leftAt?: string | null,
    requestedZone?: string | null,
    note?: string | null,
    start?: string | null,
    margin?: number | null,
    defaultRotation?: number | null,
    combination?: string | null,
    with?: string[] | null,
}

/** « Ensuite 22:30 · marge 30 min » */
export interface PlacementNext {
    start: string,
    margin: number,
    guest: string | null,
}

export interface PlacementEntity {
    tableId: string | null,
    combinationId: string | null,
    zoneId: string,
    name: string,
    capacity: number,
    level: PlacementLevel,
    reasons: PlacementReason[],
    next: PlacementNext | null,
}

/** GET /api/service/placement/{id} */
export interface Placement {
    reservationId: string,
    guestName: string | null,
    /** L'intervalle testé, ISO 8601 UTC */
    start: string,
    end: string,
    covers: number,
    note: string | null,
    preferredZoneId: string | null,
    entities: PlacementEntity[],
}

/** POST /api/reservations/{id}/place */
export type PlaceTarget = { tableId: string } | { combinationId: string };

/** Ce que le canevas dessine d'une entité pendant un placement */
export interface PlacementMark {
    level: PlacementLevel,
    /** « Ensuite 22:30 · marge 30 min » */
    next: string | null,
}
