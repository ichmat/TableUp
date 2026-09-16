/**
 * La table virtuelle : plusieurs tables physiques rapprochées.
 * @see ℹ️ Aucune géométrie propre, elle se dessine à partir des `x`/`y` de ses membres
 */
export interface Combination {
    id: string,
    zoneId: string,
    /** « 12-13 » proposé à la création, modifiable */
    name: string,
    /** **Saisie, jamais calculée** — seulement pré-remplie avec la somme des capacités */
    capacity: number,
    /** Les identifiants des tables physiques membres */
    tableIds: string[],
    /** Tables collées *en ce moment*, oui ou non */
    isActive: boolean,
    /** Rapprochement prévu, horodatage ISO 8601 */
    activateAt: string | null,
    /** Séparation prévue, horodatage ISO 8601 */
    deactivateAt: string | null,
}
