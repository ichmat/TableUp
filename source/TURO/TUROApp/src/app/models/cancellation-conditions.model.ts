/**
 * Les conditions d'annulation, une ligne par enregistrement du texte.
 * @see ℹ️ Une version n'est jamais modifiée ni supprimée
 */
export interface CancellationConditions {
    id: string,
    restaurantId: string,
    /** Incrémenté à chaque enregistrement */
    version: number,
    /** Vide autorisé : le widget n'affiche alors ni texte, ni case à cocher */
    text: string,
    /** Horodatage ISO 8601 */
    createdAt: string,
    createdById: string,
}
