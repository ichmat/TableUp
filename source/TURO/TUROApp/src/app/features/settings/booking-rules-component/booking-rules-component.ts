import { Component, computed, inject, linkedSignal, signal, untracked } from '@angular/core';
import { form, FormField, max, min, required } from '@angular/forms/signals';
import { PLACEMENT_LIMITS, Restaurant } from '../../../models';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { Button } from '../../../shared/components/button/button';
import { NumberInput } from '../../../shared/components/inputs/number-input/number-input';
import { formatLongDate } from '../../../shared/utils/calendar-date';
import { formatDuration } from '../../../shared/utils/time-of-day';
import { bookingWindow, timeIn } from './booking-window';

interface BookingWindowDraft {
  minNoticeMinutes: number | null,
  horizonDays: number | null,
}

function toDraft(restaurant: Restaurant | null): BookingWindowDraft {
  return {
    minNoticeMinutes: restaurant?.minBookingNoticeMinutes ?? null,
    horizonDays: restaurant?.bookingHorizonDays ?? null,
  };
}

const L = PLACEMENT_LIMITS;

/** Paramètres › Règles de réservation : la fenêtre que le widget proposera (PAR-10, WID-04) */
@Component({
  imports: [FormField, NumberInput, Button],
  selector: 'app-booking-rules-component',
  templateUrl: './booking-rules-component.html',
})
export class BookingRulesComponent {
  private _restaurantService = inject(RestaurantService);
  private _modalService = inject(ModalService);

  protected readonly formatLongDate = formatLongDate;
  protected readonly formatDuration = formatDuration;

  protected restaurant = this._restaurantService.model;

  // Même règle que la page Placement : rempli à l'arrivée du restaurant, jamais écrasé par un rechargement
  private _restaurantId = computed(() => this.restaurant()?.id ?? null);
  private _draft = linkedSignal<string | null, BookingWindowDraft>({
    source: this._restaurantId,
    computation: () => untracked(() => toDraft(this.restaurant())),
  });
  protected draft = this._draft.asReadonly();

  protected windowForm = form(this._draft, (schema) => {
    required(schema.minNoticeMinutes, { message: 'Indiquez le délai minimum' });
    min(schema.minNoticeMinutes, 0, { message: 'Le délai ne peut pas être négatif' });
    max(schema.minNoticeMinutes, L.maxMinNotice, { message: 'Le délai ne peut pas dépasser 48 h' });
    required(schema.horizonDays, { message: 'Indiquez l\'horizon' });
    min(schema.horizonDays, L.minHorizon, { message: 'L\'horizon est d\'au moins 1 jour' });
    max(schema.horizonDays, L.maxHorizon, { message: 'L\'horizon ne peut pas dépasser 365 jours' });
  });

  protected isSaving = signal(false);
  private _now = signal(new Date());

  hasChanges = computed(() => {
    const saved = this.restaurant();
    const draft = this._draft();
    return saved !== null && (saved.minBookingNoticeMinutes !== draft.minNoticeMinutes
      || saved.bookingHorizonDays !== draft.horizonDays);
  });

  /** `null` tant qu'un champ est vide ou hors bornes */
  protected preview = computed(() => {
    const restaurant = this.restaurant();
    const draft = this._draft();
    if (restaurant === null || draft.minNoticeMinutes === null || draft.horizonDays === null
      || !this.windowForm.minNoticeMinutes().valid() || !this.windowForm.horizonDays().valid()) {
      return null;
    }
    return {
      now: timeIn(restaurant.timeZone, this._now()),
      ...bookingWindow(this._now(), restaurant.timeZone, draft.minNoticeMinutes, draft.horizonDays),
    };
  });

  cancel() {
    this._draft.set(toDraft(this.restaurant()));
  }

  async save() {
    const errors = this.windowForm().errorSummary();
    if (errors.length > 0) {
      this.windowForm().markAsTouched();
      await this._modalService.infoModal('Erreur', errors[0].message ?? 'Un réglage est invalide');
      return;
    }
    const draft = this._draft();

    this.isSaving.set(true);
    const result = await this._restaurantService.updateBookingWindow(
      { minNoticeMinutes: draft.minNoticeMinutes!, horizonDays: draft.horizonDays! });
    this.isSaving.set(false);

    if (result.error !== null) {
      await this._modalService.infoModal('Erreur', result.error);
    }
  }
}
