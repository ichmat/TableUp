export type DayWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

/** Jours dans l'ordre d'affichage, la semaine commençant le lundi */
export const DAYS_OF_WEEK: readonly DayWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Pas de créneau acceptés par l'API (PAR-04) */
export const SLOT_STEPS = [15, 30] as const;

/**
 * Le mode d'occupation, détermine si la réservation occupe tout le service (`SingleService`)
 * ou un certain temps de rotation (`Rotation`). Miroir de `TUROAPI/Models/Enums/OccupancyMode.cs`
 */
export type OccupancyMode = 'Rotation' | 'SingleService';

/** Représente les horraires de service du restaurant */
export interface RestaurantService {
    id: string,
    restaurantId: string,
    /** Le jour de la semaine du service */
    day: DayWeek,
    /** Heure d'ouverture du service @example '11:30' */
    opening: string,
    /** Heure de fermeture du service @example '14:00' */
    closing: string,
    /**
     * Détermine le pas pour chaque créneau, 15 ou 30 min (voir `SLOT_STEPS`)
     * @example 30 -> représente `30 min`, donc entre 12h et 13h, il y a le créneau :
     * - 12h
     * - 12h30
     * - 13h
     * */
    slotStep: number,
    /**
     * Mode d'occupation
     * @see ℹ️ Voir `OccupancyMode` pour plus d'info
     * */
    occupancyMode: OccupancyMode,
    /** Détermine le temps moyen d'une réservation. `null` hérite de `Restaurant.defaultRotation` */
    expectedDuration: number | null,
    /** Plafond nombre de couverts par créneau (avertissement seulement) */
    maxCadence: number | null,
    /** Plafond nombre de couverts (avertissement seulement) */
    coverCap: number | null,
}
