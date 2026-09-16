export type DecorType = 'Wall' | 'Door' | 'Bar' | 'Pass' | 'Pillar' | 'Stairs' | 'Other';

/**
 * Un repère non réservable.
 * @see ℹ️ Pas de capacité, jamais proposé au placement, pas cliquable en service
 */
export interface Decor {
    id: string,
    zoneId: string,
    type: DecorType,
    /** Optionnel, affiché sur la forme */
    label: string | null,
    x: number,
    y: number,
    width: number,
    height: number,
    /** Rotation en degrés */
    rotation: number,
}
