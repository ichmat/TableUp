/** Les tags sont **manuels**, jamais calculés */
export type ClientTag = 'Vip' | 'Regular' | 'Watch' | 'Press';

export interface Client {
    id: string,
    restaurantId: string,
    name: string,
    /** La clé d'identité de secours */
    email: string | null,
    /** **La clé d'identité** du client */
    phone: string | null,
    /** Champ structuré, à part : c'est lui qui s'épingle en corail sur la fiche réservation */
    allergies: string | null,
    /**
     * Habitudes, occasions.
     * @see ⚠️ Ne sort **jamais** du logiciel : ni e-mail, ni widget
     */
    internalNotes: string | null,
    tags: ClientTag[],
    /** Compteur stocké, redressable par un recomptage */
    visitCount: number,
    /** Compteur stocké, redressable par un recomptage */
    noShowCount: number,
    consentMarketing: boolean,
    /** Horodatage ISO 8601 du consentement */
    consentAt: string | null,
    /**
     * Horodatage ISO 8601 de l'anonymisation.
     * @see ℹ️ Supprimer un client, c'est l'anonymiser, jamais le supprimer
     */
    anonymizedAt: string | null,
}
