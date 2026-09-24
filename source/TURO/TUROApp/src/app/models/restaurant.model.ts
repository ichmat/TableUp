import { CancellationConditions } from './cancellation-conditions.model';
import { RestaurantService } from './service.model';
import { UserStaff } from './user.model';
import { Zone } from './zone.model';

/** Le restaurant, et ses réglages globaux */
export interface Restaurant {
    id: string,
    name: string,
    /** Fuseau horaire local au format IANA @example 'Europe/Paris' */
    timeZone: string,
    /** Durée par défaut d'un repas, en minutes @example 105 */
    defaultRotation: number,
    /** Places en trop tolérées avant de dégrader le verdict de placement en `~✓` */
    seatTolerance: number,
    /** Minutes après l'heure avant d'afficher l'anneau « en retard » */
    lateGrace: number,
    /** Active le rappel envoyé avant la réservation */
    reminderEnabled: boolean,
    /** Délai du rappel, en heures avant la réservation */
    reminderDelayHours: number,
    /** Confirme d'office une demande web posée sur un créneau franchement libre */
    autoConfirmation: boolean,
    zones: Zone[],
    services: RestaurantService[],
    /** Historique des versions du texte d'annulation */
    cancellationConditions: CancellationConditions[],
    users: UserStaff[],
}
