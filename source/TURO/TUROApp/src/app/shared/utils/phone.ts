/**
 * Affichage seul : la normalisation et l'identité restent dans l'API.
 * `0612345678` → `06 12 34 56 78` ; tout autre numéro est rendu tel qu'enregistré
 */
export function formatPhone(value: string): string {
    return /^0\d{9}$/.test(value) ? value.match(/\d{2}/g)!.join(' ') : value;
}
