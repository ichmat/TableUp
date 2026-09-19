/**
 * Le lien réservation ↔ entité réservable.
 * @see ⚠️ Exactement un de `tableId` / `combinationId` est rempli. Un groupe sur deux
 * tables passe par une combinaison, jamais par deux affectations
 */
export interface Assignment {
    id: string,
    reservationId: string,
    tableId: string | null,
    combinationId: string | null,
    /** L'utilisateur qui a placé la réservation */
    assignedById: string | null,
    /** Horodatage ISO 8601 du placement */
    assignedAt: string,
}
