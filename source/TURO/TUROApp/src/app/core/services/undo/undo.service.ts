import { inject, Service, signal } from '@angular/core';
import { ApiError, RESERVATION_LIMITS, ReservationDetail } from '../../../models';
import { ReservationService } from '../reservation/reservation.service';

export interface UndoOffer {
    /** Ce qui vient d'être fait, et sa conséquence : « No-show noté · 2ᵉ pour ce client » */
    message: string,
    reservationId: string,
    /** La ligne de journal écrite par l'action : c'est elle que l'API défait */
    eventId: string,
    /** Après une annulation réussie : la réservation rétablie, `null` pour une création supprimée */
    onUndone?: (restored: ReservationDetail | null) => void,
}

export type UndoBannerState =
    | { kind: 'offer', offer: UndoOffer, secondsLeft: number }
    | { kind: 'failed', message: string };

export const UNDO_TOO_LATE = 'Trop tard : la réservation a changé entre-temps';

const FAILED_MS = 4_000;

/**
 * Le bandeau « Annuler » (§6.7) : l'action est déjà faite par l'API ; pendant 8 s, on peut la défaire.
 * Un seul bandeau à la fois : une nouvelle action rend la précédente définitive. Il survit aux changements d'écran
 */
@Service()
export class UndoService {
    private _reservations = inject(ReservationService);

    private _state = signal<UndoBannerState | null>(null);
    state = this._state.asReadonly();

    private _timer: ReturnType<typeof setTimeout> | undefined;

    offer(offer: UndoOffer) {
        this.dismiss();
        this._state.set({ kind: 'offer', offer, secondsLeft: RESERVATION_LIMITS.undoSeconds });
        this.scheduleTick();
    }

    dismiss() {
        clearTimeout(this._timer);
        this._timer = undefined;
        this._state.set(null);
    }

    async undo() {
        const state = this._state();
        if (state?.kind !== 'offer') {
            return;
        }
        this.dismiss();
        const result = await this._reservations.undo(state.offer.reservationId, state.offer.eventId);
        if (result.error === null) {
            state.offer.onUndone?.(result.value);
            return;
        }
        const tooLate = result.code === ApiError.UndoExpired || result.code === ApiError.ReservationChanged;
        this._state.set({ kind: 'failed', message: tooLate ? UNDO_TOO_LATE : result.error });
        this._timer = setTimeout(() => this.dismiss(), FAILED_MS);
    }

    private scheduleTick() {
        this._timer = setTimeout(() => {
            const state = this._state();
            if (state?.kind !== 'offer') {
                return;
            }
            if (state.secondsLeft <= 1) {
                this.dismiss();
                return;
            }
            this._state.set({ ...state, secondsLeft: state.secondsLeft - 1 });
            this.scheduleTick();
        }, 1_000);
    }
}
