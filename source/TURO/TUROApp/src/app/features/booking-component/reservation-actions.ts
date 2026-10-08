import { inject, Service, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError, CancelledBy, ReservationActionResult, ReservationDetail, ReservationGesture } from '../../models';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { UndoService } from '../../core/services/undo/undo.service';
import { ModalService } from '../../core/services/modal/modal.service';
import { RestaurantService } from '../../core/services/restaurant/restaurant-service';
import { ApiResult } from '../../core/services/api-result';
import { createdMessage, gestureMessage, modifiedMessage } from './reservation-display';
import { ReservationFormMode, ReservationSaved } from './reservation-draft';

/**
 * Les gestes de la liste et de la fiche : l'API agit tout de suite, le bandeau propose de défaire 8 s (§6.7).
 * Pas de popup « êtes-vous sûr » : on rattrape l'erreur au moment où on la voit
 */
@Service()
export class ReservationActions {
  private _reservations = inject(ReservationService);
  private _undo = inject(UndoService);
  private _modal = inject(ModalService);
  private _router = inject(Router);
  private _restaurant = inject(RestaurantService);

  private _reopened = signal<ReservationFormMode | null>(null);
  /** Le formulaire qu'« Annuler » rend à l'écran qui l'avait rempli : il le reprend, même s'il en était sorti entre-temps */
  reopened = this._reopened.asReadonly();

  takeReopened(): ReservationFormMode | null {
    const mode = this._reopened();
    this._reopened.set(null);
    return mode;
  }

  /** La fiche après le geste, `null` si l'API l'a refusé (le message est déjà montré) */
  async run(id: string, gesture: ReservationGesture): Promise<ReservationDetail | null> {
    return this.offerUndo(gesture, await this._reservations.act(id, gesture));
  }

  async cancel(id: string, by: CancelledBy): Promise<ReservationDetail | null> {
    return this.offerUndo('cancel', await this._reservations.cancel(id, by));
  }

  /** §6.4 : « Placer » ouvre la vue Plan au bon service ; elle s'en servira avec le lot Plan */
  place(serviceDay: string, id: string) {
    void this._router.navigate(['/service'], { queryParams: { day: serviceDay, place: id } });
  }

/**
   * Après le formulaire : le bandeau propose de défaire (§6.7), et défaire ramène à l'écran du formulaire,
   * rouvert avec la saisie — même après « Créer et placer ». Une modification rouvre sur la réservation rétablie
   */
  saved(event: ReservationSaved) {
    const { reservation, eventId } = event.result;
    const origin = this._router.url;
    if (eventId !== null) {
      const timeZone = this._restaurant.model()?.timeZone ?? 'Europe/Paris';
      this._undo.offer({
        message: event.mode === 'create' ? createdMessage(reservation, timeZone) : modifiedMessage(reservation),
        reservationId: reservation.id,
        eventId,
        onUndone: (restored) => {
          this._reopened.set(event.mode === 'create'
            ? { kind: 'create', draft: event.draft }
            : { kind: 'edit', reservation: restored ?? reservation, draft: event.draft });
          void this._router.navigateByUrl(origin);
        },
      });
    }
    if (event.thenPlace) {
      this.place(reservation.serviceDay, reservation.id);
    }
  }

  private async offerUndo(gesture: ReservationGesture | 'cancel', result: ApiResult<ReservationActionResult>): Promise<ReservationDetail | null> {
    if (result.error !== null) {
      await this._modal.infoModal('Action impossible', result.code === ApiError.ClientAlreadyBooked
        ? 'Ce client a déjà une autre réservation sur ce créneau : la rouvrir ferait un doublon.'
        : result.error);
      return null;
    }
    const { reservation, eventId } = result.value;
    if (eventId !== null) {
      this._undo.offer({ message: gestureMessage(gesture, reservation), reservationId: reservation.id, eventId });
    }
    return reservation;
  }
}
