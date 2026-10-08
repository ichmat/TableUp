import { Component, computed, inject, input, linkedSignal, NgZone, OnDestroy, output, signal } from '@angular/core';
import { CancelledBy, CLIENT_TAG_LABEL, ReservationDetail, ReservationGesture, SOURCE_CHOICE_LABEL } from '../../../models';
import { ReservationService } from '../../../core/services/reservation/reservation.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { Button } from '../../../shared/components/button/button';
import { RESERVATION_STATUS_STYLE } from '../../../shared/components/constants/reservation-status-style';
import { formatDuration } from '../../../shared/utils/time-of-day';
import { formatPhone } from '../../../shared/utils/phone';
import { ReservationActions } from '../reservation-actions';
import { guestName, journalLine, originLabel, primaryAction, sheetSubtitle } from '../reservation-display';

const CLOCK_MS = 30_000;

/**
 * La fiche réservation (§6.5) : un panneau, une seule action principale déduite de l'état (FICHE-01),
 * des boutons qui ne changent jamais de place (FICHE-03)
 */
@Component({
  imports: [Button],
  selector: 'app-reservation-sheet',
  templateUrl: './reservation-sheet.html',
})
export class ReservationSheet implements OnDestroy {
  private _reservations = inject(ReservationService);
  private _restaurant = inject(RestaurantService);
  private _actions = inject(ReservationActions);

  /** D'où l'on vient (§7.6) : « Sophie Marchand » ; `null` au premier niveau */
  origin = input<string | null>(null);
  closed = output<void>();
  back = output<void>();
  edit = output<ReservationDetail>();
  openClient = output<{ id: string, origin: string }>();

  protected readonly statusStyle = RESERVATION_STATUS_STYLE;
  protected readonly sourceLabel = SOURCE_CHOICE_LABEL;
  protected readonly tagLabel = CLIENT_TAG_LABEL;
  protected readonly guestName = guestName;
  protected readonly formatPhone = formatPhone;
  protected readonly formatDuration = formatDuration;

  protected reservation = this._reservations.detail;
  protected failed = this._reservations.detailFailed;
  protected primary = computed(() => {
    const reservation = this.reservation();
    return reservation === null ? null : primaryAction(reservation);
  });
  protected isClosed = computed(() => ['Finished', 'NoShow', 'Cancelled'].includes(this.reservation()?.status ?? ''));
  // Chaque fiche s'ouvre avec le choix d'annulation replié
  protected cancelOpen = linkedSignal({ source: () => this.reservation()?.id, computation: () => false });
  protected isBusy = signal(false);

  private _timeZone = computed(() => this._restaurant.model()?.timeZone ?? 'Europe/Paris');
  // FICHE-05 : le bouton « No-show » apparaît de lui-même une fois le retard de grâce passé
  private _now = signal(Date.now());
  // Hors de la zone : une horloge permanente empêcherait l'application de devenir stable ; le signal suffit au rendu
  private _clock = inject(NgZone).runOutsideAngular(() => setInterval(() => this._now.set(Date.now()), CLOCK_MS));
  protected canNoShow = computed(() => {
    const reservation = this.reservation();
    return reservation?.status === 'Confirmed' && this._now() >= Date.parse(reservation.noShowFrom);
  });

  protected subtitle = computed(() => {
    const reservation = this.reservation();
    return reservation === null ? '' : sheetSubtitle(reservation, this._timeZone());
  });

  protected clientBand = computed(() => {
    const client = this.reservation()?.client;
    if (!client) {
      return null;
    }
    const parts = [`${client.visitCount} visite${client.visitCount > 1 ? 's' : ''}`, `${client.noShowCount} no-show${client.noShowCount > 1 ? 's' : ''}`];
    if (client.lastVisitDay !== null) {
      parts.push(`dernière le ${client.lastVisitDay.slice(8, 10)}/${client.lastVisitDay.slice(5, 7)}`);
    }
    if (client.phone !== null) {
      parts.push(formatPhone(client.phone));
    }
    return parts.join(' · ');
  });

  protected journal = computed(() => (this.reservation()?.events ?? []).map((event) => journalLine(event, this._timeZone())));

  protected async run(gesture: ReservationGesture) {
    const reservation = this.reservation();
    if (reservation === null || this.isBusy()) {
      return;
    }
    this.isBusy.set(true);
    await this._actions.run(reservation.id, gesture);
    this.isBusy.set(false);
  }

  /** Pendant un service, accepter sans placer remet le travail à plus tard (§6.5) */
  protected async acceptAndPlace() {
    const reservation = this.reservation();
    if (reservation === null || this.isBusy()) {
      return;
    }
    this.isBusy.set(true);
    const after = await this._actions.run(reservation.id, 'accept');
    this.isBusy.set(false);
    if (after !== null) {
      this._actions.place(after.serviceDay, after.id);
    }
  }

  protected place() {
    const reservation = this.reservation();
    if (reservation !== null) {
      this._actions.place(reservation.serviceDay, reservation.id);
    }
  }

  protected async cancel(by: CancelledBy) {
    const reservation = this.reservation();
    if (reservation === null || this.isBusy()) {
      return;
    }
    this.cancelOpen.set(false);
    this.isBusy.set(true);
    await this._actions.cancel(reservation.id, by);
    this.isBusy.set(false);
  }

  protected showClient() {
    const reservation = this.reservation();
    if (reservation?.client) {
      this.openClient.emit({ id: reservation.client.id, origin: originLabel(reservation, this._timeZone()) });
    }
  }

  ngOnDestroy() {
    clearInterval(this._clock);
  }
}
