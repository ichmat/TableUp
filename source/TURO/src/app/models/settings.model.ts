/** Modèle pour lister les sous pages de la page Paramètres */
export type SettingsPages = 'Openings' | 'Services & time slots' | 'Room & tables' | 'Placement';

export type DayWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

/**
 * Le mode d'occupation, détermine si la réservation occupe tout le service (`SingleService`) 
 * ou un certain temps de rotation (`rotate`)
 */
export type OccupancyMode = 'Rotate' | 'SingleService';

export type ExceptionalClosureType = 'closure' | 'temporaryService'

/** Représente les horraires de service du restaurant */
export interface RestaurantService {
    /** Le jour de la semaine du service */
    day: DayWeek,
    /** Heure d'ouverture du service */
    open: string,
    /** Heure de fermeture du service */
    close: string,
    /** 
     * Détermine le pas pour chaque créneau 
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
    /** Détermine le temps moyen d'une réservation */
    plannedRotationMin: number | null,
    /** Plafond nombre de couverts par créneau (avertissement seulement) */
    thersholdCoversTimeSlot: number | null,
    /** Plafond nombre de couverts (avertissement seulement) */
    thersholdCovers: number | null,
}

/** Changement d'horraires ou fermeture exceptionnel */
export interface ExceptionalClosure {
    from: Date,
    to: Date,
    type: ExceptionalClosureType,
    /** La raison de la fermeture */
    reason: string,
    /** Les détail de la fermeture */
    reasonDetail: string,
    /** Le message à envoyer aux clients */
    clientMessage: string
}