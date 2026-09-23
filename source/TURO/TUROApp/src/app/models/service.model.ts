export type DayWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

/**
 * Le mode d'occupation, détermine si la réservation occupe tout le service (`SingleService`)
 * ou un certain temps de rotation (`Rotate`)
 */
export type OccupancyMode = 'Rotate' | 'SingleService';

/** Représente les horraires de service du restaurant */
export interface RestaurantService {
    id: string,
    restaurantId: string,
    /** Le jour de la semaine du service */
    day: DayWeek,
    /** Heure d'ouverture du service @example '11:30' */
    open: string,
    /** Heure de fermeture du service @example '14:00' */
    close: string,
    /**
     * Détermine le pas pour chaque créneau, 15 ou 30 min
     * @example 30 -> représente `30 min`, donc entre 12h et 13h, il y a le créneau :
     * - 12h
     * - 12h30
     * - 13h
     * */
    stepTimeSlotMin: number,
    /**
     * Mode d'occupation
     * @see ℹ️ Voir `OccupancyMode` pour plus d'info
     * */
    occupancyMode: OccupancyMode,
    /** Détermine le temps moyen d'une réservation. `null` hérite de `Restaurant.defaultRotation` */
    plannedRotationMin: number | null,
    /** Plafond nombre de couverts par créneau (avertissement seulement) */
    thersholdCoversTimeSlot: number | null,
    /** Plafond nombre de couverts (avertissement seulement) */
    thersholdCovers: number | null,
}
