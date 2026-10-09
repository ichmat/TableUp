import { ApiError } from '../../models';

/**
 * L'API répond en anglais ; les refus du service courant (geste déjà fait ailleurs, jour passé, table déjà propre)
 * se disent en français à l'écran. Un code inconnu garde le message reçu
 */
const FRENCH: Partial<Record<ApiError, string>> = {
  [ApiError.ReservationActionNotAllowed]: "Ce geste n'est pas possible sur cette réservation dans son état actuel : elle a peut-être changé sur un autre poste.",
  [ApiError.ReservationChanged]: 'La réservation a été modifiée sur un autre poste.',
  [ApiError.OutsideService]: "Le restaurant n'est pas ouvert à ce moment-là : jour passé, jour fermé ou heure hors service.",
  [ApiError.TableAlreadyClean]: 'Cette table est déjà propre.',
  [ApiError.PlacementUnavailable]: "Cette table n'est plus libre pour cette réservation : elle vient d'être prise sur un autre poste.",
  [ApiError.TableBookedLater]: 'Cette table est réservée plus tard, pendant la durée du repas.',
  [ApiError.TableCleaningDisabled]: 'Le suivi du nettoyage est désactivé dans Paramètres › Placement.',
};

export function apiErrorText(result: { error: string, code?: ApiError }): string {
  return (result.code !== undefined ? FRENCH[result.code] : undefined) ?? result.error;
}
