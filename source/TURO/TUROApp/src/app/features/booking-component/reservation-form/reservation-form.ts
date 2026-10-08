import { Component, computed, effect, inject, input, linkedSignal, output, resource, signal, untracked } from '@angular/core';
import { form, FormField, maxLength, validate } from '@angular/forms/signals';
import { twMerge } from 'tailwind-merge';
import {
  ApiError, CLIENT_TAG_LABEL, ClientListItem, MANUAL_SOURCES, RESERVATION_LIMITS, ReservationSource, SOURCE_CHOICE_LABEL,
} from '../../../models';
import { ReservationService } from '../../../core/services/reservation/reservation.service';
import { ClientService } from '../../../core/services/client/client.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { ClosureService } from '../../../core/services/closure/closure.service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { Button } from '../../../shared/components/button/button';
import { Input } from '../../../shared/components/inputs/input/input';
import { DateInput } from '../../../shared/components/inputs/date-input/date-input';
import { todayIn, toIsoDate } from '../../../shared/utils/calendar-date';
import { formatDuration } from '../../../shared/utils/time-of-day';
import { formatPhone } from '../../../shared/utils/phone';
import { isBookableDay } from '../reservation-display';
import { initialDraft, ReservationDraft, ReservationFormMode, ReservationSaved, toRequest } from '../reservation-draft';

const L = RESERVATION_LIMITS;
const LOOKUP_DELAY_MS = 300;
const MAX_PHONE = 30;

/**
 * Le formulaire « + » (§8) : l'ordre de l'appel (FORM-01), une bande d'heures plutôt qu'un menu (§8.3),
 * le client reconnu au numéro pendant qu'on parle (FORM-10). La bande reste neutre jusqu'au moteur de disponibilité
 */
@Component({
  imports: [FormField, Input, Button, DateInput],
  selector: 'app-reservation-form',
  templateUrl: './reservation-form.html',
})
export class ReservationForm {
  private _reservations = inject(ReservationService);
  private _clients = inject(ClientService);
  private _restaurant = inject(RestaurantService);
  private _closures = inject(ClosureService);
  private _modal = inject(ModalService);

  mode = input.required<ReservationFormMode>();
  saved = output<ReservationSaved>();
  cancelled = output<void>();

  protected readonly limits = L;
  protected readonly coverChoices = [1, 2, 3, 4, 5, 6];
  protected readonly sources = MANUAL_SOURCES;
  protected readonly sourceLabel = SOURCE_CHOICE_LABEL;
  protected readonly tagLabel = CLIENT_TAG_LABEL;
  protected readonly formatDuration = formatDuration;
  protected readonly formatPhone = formatPhone;

  private _timeZone = computed(() => this._restaurant.model()?.timeZone ?? 'Europe/Paris');
  private _today = computed(() => todayIn(this._timeZone()));
  protected zones = computed(() => this._restaurant.model()?.zones ?? []);
  protected editing = computed(() => {
    const mode = this.mode();
    return mode.kind === 'edit' ? mode.reservation : null;
  });
  protected isEdit = computed(() => this.editing() !== null);
  /** Une table assise garde sa date et son heure */
  protected isSeated = computed(() => this.editing()?.status === 'Seated');

  // Repart du mode seulement : un rechargement SignalR n'efface pas la saisie
  private _draft = linkedSignal<ReservationFormMode, ReservationDraft>({
    source: this.mode,
    computation: (mode) => untracked(() => initialDraft(mode, this._today(), this._timeZone())),
  });
  protected draft = this._draft.asReadonly();
  /** La version lue à l'ouverture : la modification l'exige, et refuse une version périmée */
  private _version = linkedSignal<ReservationFormMode, number | null>({
    source: this.mode,
    computation: (mode) => (mode.kind === 'edit' ? mode.reservation.version : null),
  });
  protected moreCovers = linkedSignal({ source: this.mode, computation: () => untracked(() => this._draft().covers > 6) });

  protected known = signal<ClientListItem | null>(null);
  protected needsName = computed(() => !this.isEdit() && this.known() === null);
  protected submitted = signal(false);
  protected isSaving = signal(false);

  protected windows = resource({
    params: () => this._draft().serviceDay,
    loader: async ({ params }) => (await this._reservations.slots(params)).value ?? [],
  });
  protected bands = computed(() => (this.windows.hasValue() ? this.windows.value() : []));
  /** En modification, une heure hors de la grille reste affichée, sélectionnée */
  protected offGrid = computed(() => {
    const time = this._draft().time;
    return time !== null && this.windows.hasValue() && !this.bands().some((w) => w.slots.includes(time));
  });
  protected duration = computed(() => {
    const draft = this._draft();
    const window = this.bands().find((w) => draft.time !== null && w.slots.includes(draft.time)) ?? this.bands()[0];
    return draft.duration ?? window?.duration ?? this._restaurant.model()?.defaultRotation ?? 120;
  });

  protected reservationForm = form(this._draft, (schema) => {
    // FORM-03 : sans numéro, ni rappel ni changement d'horaire
    validate(schema.phone, ({ value }) => !this.isEdit() && !/\d/.test(value())
      ? { kind: 'required', message: 'Indiquez le numéro : sans lui, ni rappel ni changement d\'horaire' }
      : undefined);
    maxLength(schema.phone, MAX_PHONE, { message: `Un numéro est limité à ${MAX_PHONE} caractères` });
    // Le nom n'est jamais une clé : un prénom suffit
    validate(schema.name, ({ value }) => this.needsName() && value().trim() === ''
      ? { kind: 'required', message: 'Indiquez le nom — un prénom suffit' }
      : undefined);
    maxLength(schema.name, L.maxName, { message: `Le nom est limité à ${L.maxName} caractères` });
    maxLength(schema.email, L.maxEmail, { message: `Un e-mail est limité à ${L.maxEmail} caractères` });
    validate(schema.email, ({ value }) => value().trim() !== '' && !value().includes('@')
      ? { kind: 'email', message: 'Cet e-mail n\'est pas valide' }
      : undefined);
    maxLength(schema.note, L.maxNote, { message: `Le commentaire est limité à ${L.maxNote} caractères` });
    validate(schema.time, ({ value }) => value() === null ? { kind: 'required', message: 'Choisissez une heure' } : undefined);
  });

  /** Le calendrier grise les jours passés, fermés, ou sans service ; l'API reste juge */
  protected isDisabledDay = (date: Date): boolean => !isBookableDay(
    toIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate()),
    this._restaurant.model()?.services ?? [], this._closures.closures(), this._today());

  constructor() {
    // FORM-10 : dès que le numéro est complet, la fiche s'attache, et avec elle l'allergie et le ratio
    effect((onCleanup) => {
      const phone = this._draft().phone;
      if (this.isEdit() || phone.replace(/\D/g, '').length < 10) {
        this.known.set(null);
        return;
      }
      const timer = setTimeout(async () => {
        const found = await this._clients.findExactPhone(phone);
        if (this._draft().phone === phone) {
          this.known.set(found);
        }
      }, LOOKUP_DELAY_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  protected setCovers(covers: number) {
    if (Number.isInteger(covers)) {
      this._draft.update((draft) => ({ ...draft, covers: Math.min(Math.max(covers, 1), L.maxCovers) }));
    }
  }

  protected openMoreCovers() {
    this.moreCovers.set(true);
    if (this._draft().covers <= 6) {
      this.setCovers(7);
    }
  }

  /** Un autre jour, d'autres créneaux : l'heure choisie ne vaut plus */
  protected setDay(day: string) {
    if (day !== '') {
      this._draft.update((draft) => ({ ...draft, serviceDay: day, time: day === draft.serviceDay ? draft.time : null }));
    }
  }

  protected setTime(time: string) {
    this._draft.update((draft) => ({ ...draft, time }));
  }

  protected changeDuration(delta: number) {
    const next = Math.min(Math.max(this.duration() + delta, L.minDuration), L.maxDuration);
    this._draft.update((draft) => ({ ...draft, duration: next }));
  }

  protected setZone(zoneId: string | null) {
    this._draft.update((draft) => ({ ...draft, preferredZoneId: zoneId }));
  }

  protected setSource(source: ReservationSource) {
    this._draft.update((draft) => ({ ...draft, source }));
  }

  protected hhmm(time: string): string {
    return time.slice(0, 5);
  }

  protected chipClass(active: boolean): string {
    return twMerge('min-w-9 px-3 py-1 rounded-lg border-2 border-border-soft bg-surface cursor-pointer tabular-nums hover:bg-app',
      active ? 'bg-slate text-surface border-slate hover:bg-slate' : '');
  }

  /** CLI-05 : le corail plein vient du drapeau de l'API */
  protected ratioClass(client: ClientListItem): string {
    return twMerge('inline-block px-2 rounded font-bold tabular-nums', client.atRisk ? 'bg-coral text-surface' : '');
  }

  async save(thenPlace: boolean) {
    this.submitted.set(true);
    if (this.reservationForm().errorSummary().length > 0) {
      this.reservationForm().markAsTouched();
      return;
    }
    const draft = this._draft();
    const request = toRequest(draft, this._version(), this.known()?.name ?? null);
    const editing = this.editing();

    this.isSaving.set(true);
    const result = editing === null ? await this._reservations.create(request) : await this._reservations.update(editing.id, request);
    this.isSaving.set(false);

    if (result.error === null) {
      this.saved.emit({ result: result.value, draft, mode: editing === null ? 'create' : 'edit', thenPlace });
      return;
    }
    if (result.code === ApiError.ReservationChanged) {
      // Enregistrer quand même effacerait ce qu'un autre poste vient d'écrire
      if (await this._modal.confirmModal('Réservation modifiée sur un autre poste',
        'Cette réservation a changé depuis que vous l\'avez ouverte. Recharger ? Votre saisie sera perdue.', 'Recharger', 'Garder ma saisie')) {
        const fresh = this._reservations.detail();
        if (fresh !== null && fresh.id === editing?.id) {
          this._draft.set(initialDraft({ kind: 'edit', reservation: fresh }, this._today(), this._timeZone()));
          this._version.set(fresh.version);
        }
      }
      return;
    }
    await this._modal.infoModal('Erreur', result.error);
  }
}
