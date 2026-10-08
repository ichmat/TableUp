import { ReservationStatus } from './reservation.model';

/** Les tags sont **manuels**, jamais calculés (CLI-09) */
export type ClientTag = 'Vip' | 'Regular' | 'Watch' | 'Press';

export const CLIENT_TAGS: ClientTag[] = ['Vip', 'Regular', 'Watch', 'Press'];

export const CLIENT_TAG_LABEL: Record<ClientTag, string> = {
    Vip: 'VIP',
    Regular: 'Habitué',
    Watch: 'À surveiller',
    Press: 'Presse',
};

/** Récents par défaut, jamais alphabétique par défaut (CLI-02) */
export type ClientSort = 'Recent' | 'Name' | 'Visits';

/** La clé exacte qui rend une fusion proposable (CLI-11) */
export type ClientSharedKey = 'Phone' | 'Email';

/** Une ligne de la liste (CLI-01) */
export interface ClientListItem {
    id: string,
    name: string,
    /** Numéro principal, normalisé par l'API (`0612345678`) */
    phone: string | null,
    tags: ClientTag[],
    hasAllergy: boolean,
    /** Le texte, pour la carte du formulaire de réservation (§8.5) */
    allergies: string | null,
    visitCount: number,
    noShowCount: number,
    /** Calculé par l'API (CLI-05) : le front ne recalcule jamais le seuil */
    atRisk: boolean,
    /** `AAAA-MM-JJ` de la réservation la plus récente, à venir comprise */
    lastServiceDay: string | null,
}

export interface ClientPage {
    items: ClientListItem[],
    total: number,
    page: number,
    pageSize: number,
}

/** Une ligne d'historique (CLI-08) */
export interface ClientHistoryItem {
    id: string,
    /** Horodatage ISO 8601 en UTC */
    start: string,
    serviceDay: string,
    covers: number,
    status: ReservationStatus,
    /** Table ou combinaison ; `null` si la réservation n'est pas placée */
    placeName: string | null,
}

export interface ClientMergeCandidate {
    id: string,
    name: string,
    phone: string | null,
    sharedKey: ClientSharedKey,
}

/** La fiche complète (§7.5) */
export interface ClientDetail {
    id: string,
    name: string,
    /** Le premier est le principal */
    phones: string[],
    emails: string[],
    /** Champ structuré, à part : c'est lui qui s'épingle en corail */
    allergies: string | null,
    /** @see ⚠️ Ne sort **jamais** du logiciel : ni e-mail, ni widget, ni export */
    internalNotes: string | null,
    tags: ClientTag[],
    visitCount: number,
    noShowCount: number,
    /** Moyenne des couverts des visites ; `null` sans visite */
    averageCovers: number | null,
    atRisk: boolean,
    marketingConsent: boolean,
    createdAt: string,
    mergeCandidates: ClientMergeCandidate[],
    /** Du plus récent au plus ancien, à venir comprises */
    history: ClientHistoryItem[],
    /** À renvoyer avec une modification : une fiche changée entre-temps est refusée */
    version: number,
}

export interface ClientRequest {
    name: string,
    phones: string[],
    emails: string[],
    allergies: string | null,
    internalNotes: string | null,
    tags: ClientTag[],
    /** La version lue à l'ouverture ; `null` pour une création */
    version: number | null,
}

/** Ce que la liste demande à l'API ; toujours la page 0, « Afficher plus » agrandit `pageSize` */
export interface ClientQuery {
    search: string,
    sort: ClientSort,
    tag: ClientTag | null,
    atRisk: boolean,
    pageSize: number,
}

/** Mêmes bornes que l'API (`ClientsController`) */
export const CLIENT_LIMITS = {
    pageSize: 50,
    maxPageSize: 500,
    maxName: 100,
    maxPhone: 30,
    maxEmail: 254,
    maxAllergies: 500,
    maxNotes: 2000,
    maxContacts: 5,
    historyPreview: 10,
} as const;
