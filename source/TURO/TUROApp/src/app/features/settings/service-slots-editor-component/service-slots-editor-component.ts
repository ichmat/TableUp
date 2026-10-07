import { Component, computed, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { disabled, form, FormField, max, min, required } from '@angular/forms/signals';
import { OccupancyMode, RestaurantService as ServiceModel, SLOT_STEPS } from '../../../models';
import { ModalService } from '../../../core/services/modal/modal.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { Button } from '../../../shared/components/button/button';
import { NumberInput } from '../../../shared/components/inputs/number-input/number-input';
import { DayWeekPipe } from '../../../shared/pipes/day-week/day-week-pipe';
import { formatDuration, formatMinutes, serviceLength, slotStarts, toMinutes } from '../../../shared/utils/time-of-day';

/** État édité des réglages de créneaux. Les seuils désactivés gardent leur valeur pour être réactivés tels quels */
interface SlotSettingsDraft {
  slotStep: number,
  occupancyMode: OccupancyMode,
  inheritDuration: boolean,
  expectedDuration: number | null,
  cadenceEnabled: boolean,
  maxCadence: number | null,
  coverCapEnabled: boolean,
  coverCap: number | null,
}

/** Une durée au-delà d'une journée n'a plus de sens pour un repas (même borne que l'API) */
const MAX_EXPECTED_DURATION = 24 * 60;

function toDraft(service: ServiceModel, defaultRotation: number): SlotSettingsDraft {
  return {
    slotStep: service.slotStep,
    occupancyMode: service.occupancyMode,
    inheritDuration: service.expectedDuration === null,
    expectedDuration: service.expectedDuration ?? defaultRotation,
    cadenceEnabled: service.maxCadence !== null,
    maxCadence: service.maxCadence,
    coverCapEnabled: service.coverCap !== null,
    coverCap: service.coverCap,
  };
}

/** Réglages §9.4 d'un service : pas de créneau, mode d'occupation, durée prévue et avertissements de cuisine */
@Component({
  imports: [FormField, NumberInput, Button, DayWeekPipe],
  selector: 'app-service-slots-editor-component',
  templateUrl: './service-slots-editor-component.html',
})
export class ServiceSlotsEditorComponent {
  private _restaurantService = inject(RestaurantService);
  private _modalService = inject(ModalService);

  service = input.required<ServiceModel>();
  /** `Restaurant.defaultRotation`, dont hérite la durée prévue */
  defaultRotation = input.required<number>();

  protected readonly slotSteps = SLOT_STEPS;
  protected readonly formatMinutes = formatMinutes;
  protected readonly formatDuration = formatDuration;

  // Repart des valeurs enregistrées seulement quand on change de service :
  // un rechargement déclenché par SignalR ne doit pas effacer une saisie en cours.
  // Le `computed` intermédiaire coupe la propagation tant que l'id ne change pas
  private _serviceId = computed(() => this.service().id);
  private _draft = linkedSignal<string, SlotSettingsDraft>({
    source: this._serviceId,
    computation: () => untracked(() => toDraft(this.service(), this.defaultRotation())),
  });

  protected settingsForm = form(this._draft, (schema) => {
    disabled(schema.expectedDuration, { when: ({ valueOf }) => valueOf(schema.inheritDuration) });
    required(schema.expectedDuration, { when: ({ valueOf }) => !valueOf(schema.inheritDuration), message: "Indiquez la durée prévue d'un repas" });
    min(schema.expectedDuration, 1, { when: ({ valueOf }) => !valueOf(schema.inheritDuration), message: "La durée prévue doit être d'au moins 1 minute" });
    max(schema.expectedDuration, MAX_EXPECTED_DURATION, { when: ({ valueOf }) => !valueOf(schema.inheritDuration), message: "La durée prévue ne peut pas dépasser 24 h" });

    disabled(schema.maxCadence, { when: ({ valueOf }) => !valueOf(schema.cadenceEnabled) });
    required(schema.maxCadence, { when: ({ valueOf }) => valueOf(schema.cadenceEnabled), message: "Indiquez la cadence maximale, ou désactivez l'avertissement" });
    min(schema.maxCadence, 1, { when: ({ valueOf }) => valueOf(schema.cadenceEnabled), message: "La cadence maximale doit être d'au moins 1 couvert" });

    disabled(schema.coverCap, { when: ({ valueOf }) => !valueOf(schema.coverCapEnabled) });
    required(schema.coverCap, { when: ({ valueOf }) => valueOf(schema.coverCapEnabled), message: "Indiquez le plafond de couverts, ou désactivez l'avertissement" });
    min(schema.coverCap, 1, { when: ({ valueOf }) => valueOf(schema.coverCapEnabled), message: "Le plafond doit être d'au moins 1 couvert" });
  });

  protected draft = this._draft.asReadonly();
  protected isSaving = signal(false);

  /** Le service tel qu'il serait enregistré */
  private _request = computed<ServiceModel>(() => {
    const draft = this._draft();
    return {
      ...this.service(),
      slotStep: draft.slotStep,
      occupancyMode: draft.occupancyMode,
      expectedDuration: draft.inheritDuration ? null : draft.expectedDuration,
      maxCadence: draft.cadenceEnabled ? draft.maxCadence : null,
      coverCap: draft.coverCapEnabled ? draft.coverCap : null,
    };
  });

  hasChanges = computed(() => {
    const saved = this.service();
    const request = this._request();
    return saved.slotStep !== request.slotStep
      || saved.occupancyMode !== request.occupancyMode
      || saved.expectedDuration !== request.expectedDuration
      || saved.maxCadence !== request.maxCadence
      || saved.coverCap !== request.coverCap;
  });

  // ---- Aperçus construits sur les vrais horaires du service ----

  protected opening = computed(() => toMinutes(this.service().opening));
  protected closing = computed(() => this.opening() + serviceLength(this.service().opening, this.service().closing));

  protected savedSlots = computed(() => slotStarts(this.service().opening, this.service().closing, this.service().slotStep));
  protected draftSlots = computed(() => slotStarts(this.service().opening, this.service().closing, this._draft().slotStep));

  /** Durée appliquée aux repas du service, héritée ou surchargée */
  protected effectiveDuration = computed(() => {
    const draft = this._draft();
    return draft.inheritDuration || draft.expectedDuration === null ? this.defaultRotation() : draft.expectedDuration;
  });

  /** Fin prévue d'un repas commencé à l'ouverture */
  protected mealEnd = computed(() => this.opening() + this.effectiveDuration());

  /** Le repas commencé à l'ouverture dépasse la fermeture : aucun second service ne tient */
  protected noSecondSeating = computed(() => this.mealEnd() >= this.closing());

  /** Part du service occupée par ce repas, pour la barre d'aperçu (0 à 100) */
  protected mealShare = computed(() =>
    Math.min(100, this.effectiveDuration() / (this.closing() - this.opening()) * 100));

  setSlotStep(step: number) {
    this.settingsForm.slotStep().value.set(step);
  }

  setOccupancyMode(mode: OccupancyMode) {
    this.settingsForm.occupancyMode().value.set(mode);
  }

  cancel() {
    this._draft.set(toDraft(this.service(), this.defaultRotation()));
  }

  async save() {
    const errors = this.settingsForm().errorSummary();
    if (errors.length > 0) {
      this.settingsForm().markAsTouched();
      await this._modalService.infoModal("Erreur", errors[0].message ?? "Un réglage est invalide");
      return;
    }

    this.isSaving.set(true);
    const error = await this._restaurantService.updateService(this.service().id, this._request());
    this.isSaving.set(false);

    if (error !== null) {
      await this._modalService.infoModal("Erreur", error);
    }
  }
}
