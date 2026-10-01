/** Miroir de `TUROAPI/Models/Enums/ClosureType.cs` */
export type ExceptionalClosureType = 'Closed' | 'ModifiedHours';

/** Les pastilles de motif proposées au restaurateur. Miroir de `TUROAPI/Models/Enums/ClosureReason.cs` */
export type ClosureReason = 'PublicHoliday' | 'Illness' | 'Works' | 'Private' | 'Other';

/** Horaires de remplacement d'une journée aux horaires modifiés */
export interface ReplacementHours {
    /** @example '19:00:00' */
    opening: string,
    /** @example '22:30:00' */
    closing: string,
}

/** Changement d'horaires ou fermeture exceptionnelle */
export interface ExceptionalClosure {
    id: string,
    restaurantId: string,
    /** Premier jour de service concerné, au format `AAAA-MM-JJ` */
    from: string,
    /** Dernier jour de service concerné (inclus), au format `AAAA-MM-JJ` */
    to: string,
    type: ExceptionalClosureType,
    /** Les plages ouvertes quand `type` vaut `ModifiedHours`, `null` sinon */
    replacementHours: ReplacementHours[] | null,
    /**
     * La raison de la fermeture
     * @see ⚠️ Ne sort **jamais** du logiciel, aucun message client ne la reprend
     */
    reason: ClosureReason,
    /**
     * Le détail de la fermeture, texte libre
     * @see ⚠️ Ne sort **jamais** du logiciel, aucun message client ne le reprend
     */
    reasonDetail: string | null,
    /** Le message destiné aux clients concernés, pré-rédigé et modifiable */
    customerMessage: string | null,
}

/** Corps de `POST` / `PUT /api/restaurant/closures` et de `POST /api/restaurant/closures/impact` */
export interface ClosureRequest {
    from: string,
    to: string,
    type: ExceptionalClosureType,
    replacementHours: ReplacementHours[] | null,
    reason: ClosureReason,
    reasonDetail: string | null,
    customerMessage: string | null,
    /** Réservations impactées que le restaurant accepte d'annuler (« Fermer, je les appelle ») */
    cancelledReservationIds: string[],
}

/** Une réservation qu'une fermeture laisserait sans service (§9.5) */
export interface ImpactedReservation {
    id: string,
    /** @example '2026-12-24' */
    serviceDay: string,
    /** Heure locale du restaurant @example '19:30:00' */
    localStart: string,
    covers: number,
    /** `null` pour un client de passage */
    clientName: string | null,
    clientPhone: string | null,
    tables: string[],
}
