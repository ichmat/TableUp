import { Component, computed, inject, input, linkedSignal, output, resource, signal, untracked } from '@angular/core';
import { applyEach, form, FormField, maxLength, required, validate } from '@angular/forms/signals';
import { ClosureReason, ClosureRequest, ExceptionalClosure, ExceptionalClosureType, ImpactedReservation, RestaurantService as ServiceModel } from '../../../models';
import { ClosureService } from '../../../core/services/closure/closure.service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { Button } from '../../../shared/components/button/button';
import { DateInput } from '../../../shared/components/inputs/date-input/date-input';
import { ImpactedReservationsComponent } from '../impacted-reservations-component/impacted-reservations-component';
import { TimeInput } from '../../../shared/components/inputs/time-input/time-input';
import { dayCount, dayOfWeek, formatLongDate } from '../../../shared/utils/calendar-date';
import { formatMinutes, toMinutes } from '../../../shared/utils/time-of-day';

interface HoursDraft {
  /** `HH:mm`, chaîne vide tant que non saisie */
  opening: string,
  closing: string,
}

interface ClosureDraft {
  type: ExceptionalClosureType,
  from: string,
  to: string,
  /** Gardées même en fermeture, pour retrouver la saisie si l'on revient aux horaires modifiés */
  hours: HoursDraft[],
  reason: ClosureReason,
  reasonDetail: string,
}

/** Mêmes bornes que l'API */
const MAX_REASON_DETAIL_LENGTH = 500;
const MAX_CLOSURE_DAYS = 366;
/** Attente après la dernière modification avant de demander l'aperçu des réservations touchées */
const IMPACT_PREVIEW_DELAY_MS = 300;

export const CLOSURE_REASONS: readonly { value: ClosureReason, label: string }[] = [
  { value: 'PublicHoliday', label: 'Férié' },
  { value: 'Illness', label: 'Maladie' },
  { value: 'Works', label: 'Travaux' },
  { value: 'Private', label: 'Privé' },
  { value: 'Other', label: 'Autre' },
];

const toHoursDraft = (opening: string, closing: string): HoursDraft =>
  ({ opening: formatMinutes(toMinutes(opening)), closing: formatMinutes(toMinutes(closing)) });

/**
 * Fermeture exceptionnelle ou horaires modifiés d'une période (§9.3, §9.7), avec confrontation
 * aux réservations déjà prises avant d'enregistrer (§9.5)
 */
@Component({
  imports: [FormField, Button, DateInput, TimeInput, ImpactedReservationsComponent],
  selector: 'app-closure-editor-component',
  templateUrl: './closure-editor-component.html',
})
export class ClosureEditorComponent {
  private _closureService = inject(ClosureService);
  private _modalService = inject(ModalService);

  /** La fermeture à modifier, `null` pour en créer une à partir de `day` */
  closure = input<ExceptionalClosure | null>(null);
  /** Le jour choisi dans le calendrier, `AAAA-MM-JJ` */
  day = input.required<string>();
  /** Aujourd'hui dans le fuseau du restaurant */
  today = input.required<string>();
  restaurantName = input<string>('');
  /** Services habituels, pour pré-remplir les horaires modifiés */
  services = input<ServiceModel[]>([]);

  /** Enregistrée, supprimée ou abandonnée */
  done = output<void>();

  protected readonly reasons = CLOSURE_REASONS;

  // Repart des valeurs enregistrées seulement si l'on change de fermeture :
  // un rechargement déclenché par SignalR ne doit pas effacer une saisie en cours
  private _key = computed(() => this.closure()?.id ?? this.day());
  private _draft = linkedSignal<string, ClosureDraft>({
    source: this._key,
    computation: () => untracked(() => this.initialDraft()),
  });
  protected draft = this._draft.asReadonly();

  protected closureForm = form(this._draft, (schema) => {
    required(schema.from, { message: 'Indiquez le premier jour' });
    required(schema.to, { message: 'Indiquez le dernier jour' });
    validate(schema.from, ({ value }) =>
      value() !== '' && value() < this.today() && value() !== this.closure()?.from
        ? { kind: 'past', message: 'Une fermeture ne se prévoit pas dans le passé' }
        : undefined);
    validate(schema.to, ({ value, valueOf }) => {
      const from = valueOf(schema.from);
      if (value() === '' || from === '') {
        return undefined;
      }
      if (value() < from) {
        return { kind: 'order', message: 'Le dernier jour ne peut pas précéder le premier' };
      }
      return dayCount(from, value()) > MAX_CLOSURE_DAYS
        ? { kind: 'length', message: 'Une fermeture ne peut pas dépasser un an' }
        : undefined;
    });

    validate(schema.hours, ({ value, valueOf }) =>
      valueOf(schema.type) === 'ModifiedHours' && value().length === 0
        ? { kind: 'hours', message: 'Ajoutez au moins une plage d\'ouverture' }
        : undefined);
    applyEach(schema.hours, (hours) => {
      required(hours.opening, { when: ({ valueOf }) => valueOf(schema.type) === 'ModifiedHours', message: 'Indiquez l\'heure d\'ouverture de chaque plage' });
      required(hours.closing, { when: ({ valueOf }) => valueOf(schema.type) === 'ModifiedHours', message: 'Indiquez l\'heure de fermeture de chaque plage' });
    });

    maxLength(schema.reasonDetail, MAX_REASON_DETAIL_LENGTH, { message: `Le détail du motif est limité à ${MAX_REASON_DETAIL_LENGTH} caractères` });
  });

  // Le message suit le texte proposé tant qu'on ne l'a pas réécrit : changer les dates le met à jour
  private _messageOverride = linkedSignal<string, string | null>({
    source: this._key,
    computation: () => untracked(() => this.closure()?.customerMessage ?? null),
  });
  protected message = computed(() => this._messageOverride() ?? this.defaultMessage());
  protected isMessageEdited = computed(() => this._messageOverride() !== null);

  /**
   * Ce que la saisie toucherait, demandé à l'API dès qu'elle est complète : on voit les réservations
   * concernées avant d'enregistrer. Le message n'en fait pas partie, le taper ne relance rien
   */
  private _impactParams = computed<ClosureRequest | undefined>(() => {
    const draft = this._draft();
    const datesValid = this.closureForm.from().valid() && this.closureForm.to().valid();
    const hoursValid = draft.type === 'Closed' || this.closureForm.hours().valid();
    return datesValid && hoursValid
      ? { ...this.toRequest(draft), customerMessage: null }
      : undefined;
  }, { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) });

  protected impactPreview = resource({
    params: () => this._impactParams(),
    loader: async ({ params, abortSignal }) => {
      // Pas une requête par frappe : on attend que la saisie se pose
      await new Promise((resolve) => setTimeout(resolve, IMPACT_PREVIEW_DELAY_MS));
      abortSignal.throwIfAborted();
      const result = await this._closureService.impact(params);
      if (result.error !== null) {
        throw new Error(result.error);
      }
      return result.value;
    },
  });
  /** L'aperçu ne trouve aucune réservation : le message aux clients n'aurait aucun destinataire */
  protected hasNoRecipient = computed(() => this.impactPreview.hasValue() && this.impactPreview.value().length === 0);
  protected previewCovers = computed(() =>
    this.impactPreview.hasValue() ? this.impactPreview.value().reduce((sum, r) => sum + r.covers, 0) : 0);

  /** Réservations à confronter avant d'enregistrer, `null` tant qu'on édite le formulaire */
  protected conflict = signal<ImpactedReservation[] | null>(null);
  protected isSaving = signal(false);

  protected isNew = computed(() => this.closure() === null);
  protected period = computed(() => this.describePeriod(this.draft().from, this.draft().to));
  protected conflictCovers = computed(() => (this.conflict() ?? []).reduce((sum, r) => sum + r.covers, 0));

  hasChanges = computed(() => {
    const initial = this.initialDraft();
    const draft = this._draft();
    return JSON.stringify(this.toRequest(draft)) !== JSON.stringify(this.toRequest(initial))
      || (this._messageOverride() ?? null) !== (this.closure()?.customerMessage ?? null);
  });

  setType(type: ExceptionalClosureType) {
    this.closureForm.type().value.set(type);
  }

  setReason(reason: ClosureReason) {
    this.closureForm.reason().value.set(reason);
  }

  addHours() {
    this._draft.update((draft) => ({ ...draft, hours: [...draft.hours, { opening: '', closing: '' }] }));
  }

  removeHours(index: number) {
    this._draft.update((draft) => ({ ...draft, hours: draft.hours.filter((_, i) => i !== index) }));
  }

  onMessageInput(event: Event) {
    this._messageOverride.set((event.target as HTMLTextAreaElement).value);
  }

  resetMessage() {
    this._messageOverride.set(null);
  }

  /** Vérifie le formulaire, puis confronte la fermeture aux réservations déjà prises */
  async save() {
    const errors = this.closureForm().errorSummary();
    if (errors.length > 0) {
      this.closureForm().markAsTouched();
      await this._modalService.infoModal('Erreur', errors[0].message ?? 'Un champ est invalide');
      return;
    }

    this.isSaving.set(true);
    const impact = await this._closureService.impact(this.toRequest(this._draft()));
    this.isSaving.set(false);

    if (impact.error !== null) {
      await this._modalService.infoModal('Erreur', impact.error);
    } else if (impact.value.length > 0) {
      this.conflict.set(impact.value);
    } else {
      await this.persist([]);
    }
  }

  /** « Fermer, je les appelle » : les réservations sont annulées par le restaurant, aucun message ne part */
  async closeAndCall() {
    await this.persist((this.conflict() ?? []).map((reservation) => reservation.id));
  }

  /** « Annuler la fermeture » : rien n'est enregistré, on revient au formulaire */
  backToForm() {
    this.conflict.set(null);
  }

  async remove() {
    const closure = this.closure();
    if (closure === null) {
      return;
    }
    const confirmed = await this._modalService.confirmModal(
      'Rouvrir ces jours ?',
      'Les horaires habituels s\'appliqueront de nouveau. Les réservations annulées par cette fermeture ne sont pas rétablies.',
      'Rouvrir',
    );
    if (!confirmed) {
      return;
    }
    const result = await this._closureService.delete(closure.id);
    if (result.error !== null) {
      await this._modalService.infoModal('Erreur', result.error);
      return;
    }
    this.done.emit();
  }

  cancel() {
    this.done.emit();
  }

  private async persist(cancelledReservationIds: string[]) {
    const request = { ...this.toRequest(this._draft()), cancelledReservationIds };
    const closure = this.closure();

    this.isSaving.set(true);
    const result = closure === null
      ? await this._closureService.create(request)
      : await this._closureService.update(closure.id, request);
    this.isSaving.set(false);

    if (result.error !== null) {
      // Une réservation prise entre-temps : l'API refuse, on confronte de nouveau
      this.conflict.set(null);
      await this._modalService.infoModal('Erreur', result.error);
      return;
    }
    this.done.emit();
  }

  private initialDraft(): ClosureDraft {
    const closure = this.closure();
    if (closure !== null) {
      return {
        type: closure.type,
        from: closure.from,
        to: closure.to,
        hours: (closure.replacementHours ?? []).map((h) => toHoursDraft(h.opening, h.closing)),
        reason: closure.reason,
        reasonDetail: closure.reasonDetail ?? '',
      };
    }

    // Les horaires modifiés partent des services habituels du jour choisi
    const usual = this.services()
      .filter((service) => service.day === dayOfWeek(this.day()))
      .sort((a, b) => toMinutes(a.opening) - toMinutes(b.opening))
      .map((service) => toHoursDraft(service.opening, service.closing));

    return {
      type: 'Closed',
      from: this.day(),
      to: this.day(),
      hours: usual.length > 0 ? usual : [{ opening: '', closing: '' }],
      reason: 'PublicHoliday',
      reasonDetail: '',
    };
  }

  private toRequest(draft: ClosureDraft): ClosureRequest {
    return {
      from: draft.from,
      to: draft.to,
      type: draft.type,
      replacementHours: draft.type === 'ModifiedHours' ? draft.hours.map((h) => ({ opening: h.opening, closing: h.closing })) : null,
      reason: draft.reason,
      reasonDetail: draft.reasonDetail.trim() === '' ? null : draft.reasonDetail.trim(),
      customerMessage: this.message().trim() === '' ? null : this.message().trim(),
      cancelledReservationIds: [],
    };
  }

  private describePeriod(from: string, to: string): string {
    if (from === '' || to === '') {
      return '';
    }
    return from === to
      ? `le ${formatLongDate(from)}`
      : `du ${formatLongDate(from)} au ${formatLongDate(to)}`;
  }

  /** Le message proposé (§9.7) : la période insérée, une excuse franche et une invitation à revenir */
  private defaultMessage(): string {
    const draft = this._draft();
    const period = this.describePeriod(draft.from, draft.to);
    const signature = this.restaurantName() === '' ? 'À très bientôt,' : `À très bientôt,\n${this.restaurantName()}`;

    const announcement = draft.type === 'Closed'
      ? `Nous devons malheureusement fermer le restaurant ${period} et ne pourrons pas vous accueillir comme prévu.`
      : `Nos horaires changent exceptionnellement ${period}`
        + (draft.hours.some((h) => h.opening !== '' && h.closing !== '')
          ? ` : nous serons ouverts ${draft.hours.filter((h) => h.opening !== '' && h.closing !== '').map((h) => `de ${h.opening} à ${h.closing}`).join(' et ')}.`
          : '.')
        + ' Votre réservation ne peut malheureusement pas être maintenue.';

    return `Bonjour,\n\n${announcement} Nous en sommes sincèrement désolés.\n\n`
      + `Nous serions très heureux de vous recevoir une autre fois : il suffit de nous répondre ou de réserver de nouveau.\n\n`
      + signature;
  }
}
