export type TableShape = 'Round' | 'Square' | 'Rectangular';

/**
 * Une table physique, indivisible.
 * @see ℹ️ Une table ne se supprime jamais, elle se désactive (`isActive`)
 */
export interface Table {
    id: string,
    zoneId: string,
    /** @example '7', 'T12', 'Bar 3' */
    name: string,
    capacity: number,
    shape: TableShape,
    /** Position horizontale sur le plan, en mètres */
    x: number,
    /** Position verticale sur le plan, en mètres */
    y: number,
    width: number,
    height: number,
    /** Rotation en degrés */
    rotation: number,
    /**
     * Horodatage ISO 8601 depuis lequel la table est à nettoyer, `null` sinon.
     * C'est **le seul état physique stocké**
     */
    needsCleaningSince: string | null,
    /** Une table se désactive, ne se supprime jamais */
    isActive: boolean,
}
