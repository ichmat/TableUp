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
    /** En mètres : coin haut-gauche du rectangle non tourné, depuis le coin haut-gauche de la salle */
    x: number,
    /** En mètres, voir `x` */
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
