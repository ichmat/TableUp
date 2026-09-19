export type ExceptionalClosureType = 'Closed' | 'ModifiedHours';

/** Les pastilles de motif proposées au restaurateur */
export type ClosureReason = 'PublicHoliday' | 'Illness' | 'Works' | 'Private' | 'Other';

/** Horraires de remplacement d'une journée aux horraires modifiés */
export interface ReplacementHours {
    /** @example '19:00' */
    open: string,
    /** @example '22:30' */
    close: string,
}

/** Changement d'horraires ou fermeture exceptionnel */
export interface ExceptionalClosure {
    id: string,
    restaurantId: string,
    /** Premier jour concerné, au format `AAAA-MM-JJ` */
    from: string,
    /** Dernier jour concerné, au format `AAAA-MM-JJ` */
    to: string,
    type: ExceptionalClosureType,
    /** Les horraires appliqués quand `type` vaut `ModifiedHours` */
    replacementHours: ReplacementHours[] | null,
    /**
     * La raison de la fermeture
     * @see ⚠️ Ne sort **jamais** du logiciel, aucun message client ne la reprend
     */
    reason: ClosureReason,
    /**
     * Les détail de la fermeture, texte libre
     * @see ⚠️ Ne sort **jamais** du logiciel, aucun message client ne le reprend
     */
    reasonDetail: string | null,
    /** Le message à envoyer aux clients, pré-rédigé et modifiable */
    clientMessage: string | null,
}
