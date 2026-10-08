// Types seulement : client.model importe déjà les statuts d'ici
import type { ClientTag } from './client.model';
import type { EventType } from './event-log.model';

export type ReservationStatus = 'Pending' | 'Confirmed' | 'Seated' | 'Finished' | 'NoShow' | 'Cancelled';

export type ReservationSource = 'Web' | 'Phone' | 'WalkIn' | 'Google' | 'Platform' | 'Other';

/** Qui a annulé : deux événements distincts, seul `Client` bouge ses compteurs */
export type CancelledBy = 'Client' | 'Restaurant';

/** Les périodes de l'écran Réservations (§6.1) */
export type ReservationPeriod = 'Upcoming' | 'Today' | 'Past';

/** Les gestes, un endpoint chacun (`cancel` a le sien, avec `CancelledBy`) */
export type ReservationGesture = 'accept' | 'refuse' | 'arrive' | 'release' | 'no-show' | 'reopen';

/** Ce qu'il faut pour le nom et les marques qui voyagent avec la réservation (§5.6) */
export interface ReservationListClient {
    id: string,
    name: string,
    /** Numéro principal, normalisé par l'API */
    phone: string | null,
    tags: ClientTag[],
    hasAllergy: boolean,
    visitCount: number,
    noShowCount: number,
    /** Calculé par l'API (CLI-05) */
    atRisk: boolean,
}

/** Une ligne de l'écran Réservations (§6.1) */
export interface ReservationListItem {
    id: string,
    /** ISO 8601, UTC */
    start: string,
    /** `AAAA-MM-JJ`, jour de service local */
    serviceDay: string,
    covers: number,
    status: ReservationStatus,
    source: ReservationSource,
    note: string | null,
    /** Table ou combinaison de la dernière affectation ; `null` si non placée */
    placeName: string | null,
    /** `null` pour un client de passage */
    client: ReservationListClient | null,
    /** ISO 8601 : le no-show n'existe qu'à partir de là (FICHE-05) */
    noShowFrom: string,
}

/** Un jour de la liste et son en-tête */
export interface ReservationDay {
    serviceDay: string,
    /** Couverts confirmés, assis et terminés parmi les lignes affichées */
    covers: number,
    /** Confirmées sans table parmi les lignes affichées */
    toPlace: number,
    items: ReservationListItem[],
}

/** Toutes les demandes à venir, indépendamment des filtres : le bandeau violet */
export interface PendingRequests {
    count: number,
    oldestCreatedAt: string | null,
}

export interface ReservationPage {
    days: ReservationDay[],
    hasMore: boolean,
    pending: PendingRequests,
}

export interface ReservationPlace {
    name: string,
    capacity: number,
}

/** Le bandeau client de la fiche (§6.5) et l'allergie épinglée (§6.6) */
export interface ReservationClient {
    id: string,
    name: string,
    phone: string | null,
    allergies: string | null,
    tags: ClientTag[],
    visitCount: number,
    noShowCount: number,
    atRisk: boolean,
    /** `AAAA-MM-JJ` de la dernière visite (assise ou terminée) */
    lastVisitDay: string | null,
}

export interface ReservationEvent {
    id: string,
    timestamp: string,
    type: EventType,
    /** `null` : *système* */
    authorLogin: string | null,
    details: string | null,
}

/** La fiche réservation (§6.5) */
export interface ReservationDetail {
    id: string,
    start: string,
    serviceDay: string,
    covers: number,
    /** Minutes */
    duration: number,
    status: ReservationStatus,
    source: ReservationSource,
    note: string | null,
    preferredZoneId: string | null,
    preferredZoneName: string | null,
    createdAt: string,
    cancelledBy: CancelledBy | null,
    /** Jeton de concurrence : à renvoyer tel quel pour modifier */
    version: number,
    place: ReservationPlace | null,
    /** FICHE-06 : placée, et plus de couverts que de places */
    placeTooSmall: boolean,
    noShowFrom: string,
    client: ReservationClient | null,
    /** Du plus ancien au plus récent */
    events: ReservationEvent[],
}

/** Corps de `POST` et `PUT /api/reservations` ; la modification ignore l'identité et la source */
export interface ReservationRequest {
    serviceDay: string,
    /** Un créneau de `GET /api/reservations/slots`, `HH:mm:ss` */
    time: string,
    covers: number,
    /** `null` : la durée de la plage */
    duration: number | null,
    note: string | null,
    preferredZoneId: string | null,
    source: ReservationSource,
    phone: string | null,
    name: string | null,
    email: string | null,
    /** Obligatoire pour modifier */
    version: number | null,
}

/** Réponse de toute écriture : la fiche, et la ligne de journal que le bandeau peut défaire */
export interface ReservationActionResult {
    reservation: ReservationDetail,
    /** `null` quand une modification n'a rien changé */
    eventId: string | null,
}

/** Une plage ouverte du jour et ses créneaux (`HH:mm:ss`) */
export interface ServiceWindow {
    opening: string,
    closing: string,
    slotStep: number,
    /** Durée par défaut d'un repas sur cette plage, en minutes */
    duration: number,
    slots: string[],
}

export interface ReservationQuery {
    period: ReservationPeriod,
    status: ReservationStatus | null,
    source: ReservationSource | null,
    zoneId: string | null,
    search: string,
    /** Jours de service chargés : « Afficher plus » en ajoute */
    days: number,
}

export const RESERVATION_LIMITS = {
    days: 14,
    maxDays: 366,
    maxCovers: 99,
    maxNote: 500,
    minDuration: 15,
    maxDuration: 600,
    durationStep: 15,
    maxName: 100,
    maxEmail: 254,
    /** Durée du bandeau « Annuler » (§6.7) ; l'API garde 30 s de marge */
    undoSeconds: 8,
} as const;

/** SRC-01 : les seules sources qu'on choisit ; web et google sont écrites par le logiciel */
export const MANUAL_SOURCES: ReservationSource[] = ['Phone', 'WalkIn', 'Platform', 'Other'];

/** Badge gris de la liste (BADGE-02) */
export const SOURCE_LABEL: Record<ReservationSource, string> = {
    Web: 'WEB', Phone: 'TÉL', WalkIn: 'SUR PLACE', Google: 'GOOGLE', Platform: 'PLATEFORME', Other: 'AUTRE',
};

/** Les boutons du formulaire (SRC-02) et la fiche */
export const SOURCE_CHOICE_LABEL: Record<ReservationSource, string> = {
    Web: 'Web', Phone: 'Téléphone', WalkIn: 'Sur place', Google: 'Google', Platform: 'Plateforme', Other: 'Autre',
};
