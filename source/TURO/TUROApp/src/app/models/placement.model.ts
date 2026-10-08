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
