import { ApiError } from '../../models';
import { apiErrorText } from './api-error-text';

describe('apiErrorText', () => {
  it('should say in French what the API refused in the everyday cases', () => {
    expect(apiErrorText({ error: 'NoShow is not possible on a NoShow reservation.', code: ApiError.ReservationActionNotAllowed }))
      .toBe("Ce geste n'est pas possible sur cette réservation dans son état actuel : elle a peut-être changé sur un autre poste.");
    expect(apiErrorText({ error: 'This reservation was changed on another device.', code: ApiError.ReservationChanged }))
      .toBe('La réservation a été modifiée sur un autre poste.');
    expect(apiErrorText({ error: 'The restaurant is not open at this time: this day is past.', code: ApiError.OutsideService }))
      .toBe("Le restaurant n'est pas ouvert à ce moment-là : jour passé, jour fermé ou heure hors service.");
    expect(apiErrorText({ error: 'Table 6 is already clean.', code: ApiError.TableAlreadyClean }))
      .toBe('Cette table est déjà propre.');
  });

  it('should keep the message as it came for a code it does not know, or no code at all', () => {
    expect(apiErrorText({ error: 'Invalid request : covers.', code: ApiError.InvalidRequest })).toBe('Invalid request : covers.');
    expect(apiErrorText({ error: "La modification n'a pas été enregistrée." })).toBe("La modification n'a pas été enregistrée.");
  });
});
