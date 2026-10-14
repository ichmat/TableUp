import { Component, computed, inject, linkedSignal, resource, signal, untracked } from '@angular/core';
import { form, FormField, max, min, required, validate } from '@angular/forms/signals';
import { twMerge } from 'tailwind-merge';
import { DAYS_OF_WEEK, PLACEMENT_LIMITS, PlacementPreviewItem, PlacementSettingsRequest, Restaurant } from '../../../models';
import { PLACEMENT_FIT_LABEL, PLACEMENT_FIT_STYLE, PLACEMENT_FIT_SYMBOL } from '../../../shared/components/constants/placement-fit-style';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { FloorPlanService } from '../../../core/services/floor-plan/floor-plan.service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { Button } from '../../../shared/components/button/button';
import { NumberInput } from '../../../shared/components/inputs/number-input/number-input';
import { DayWeekPipe } from '../../../shared/pipes/day-week/day-week-pipe';
import { formatDuration, formatMinutes, toMinutes } from '../../../shared/utils/time-of-day';

/** État édité. `null` : champ vidé pendant la saisie */
interface PlacementDraft {
  defaultRotation: number | null,
  seatTolerance: number | null,
  lateGrace: number | null,
  suggestCombinations: boolean,
  trackTableCleaning: boolean,
}

function toDraft(restaurant: Restaurant | null): PlacementDraft {
  return {
    defaultRotation: restaurant?.defaultRotation ?? null,
    seatTolerance: restaurant?.seatTolerance ?? null,
    lateGrace: restaurant?.lateGrace ?? null,
    suggestCombinations: restaurant?.suggestCombinations ?? true,
    trackTableCleaning: restaurant?.trackTableCleaning ?? false,
  };
}

/** Les exemples des phrases : une réservation de 19:30 pour la rotation, de 20:00 pour le retard */
const ROTATION_EXAMPLE = 19 * 60 + 30;
const LATE_EXAMPLE = 20 * 60;

const L = PLACEMENT_LIMITS;

const PREVIEW_DELAY_MS = 300;

/**
 * Paramètres › Placement (§13.4) : comment le logiciel propose une table. Aucun réglage posé nu (§9.1) :
 * chacun dit sa conséquence, la tolérance avec un aperçu calculé par l'API sur les vraies tables
 */
@Component({
  imports: [FormField, NumberInput, Button, DayWeekPipe],
  selector: 'app-placement-settings-component',
  templateUrl: './placement-settings-component.html',
})
export class PlacementSettingsComponent {
  private _restaurantService = inject(RestaurantService);
  private _floorPlan = inject(FloorPlanService);
  private _modalService = inject(ModalService);

  protected readonly formatMinutes = formatMinutes;
  protected readonly formatDuration = formatDuration;
  protected readonly toMinutes = toMinutes;
  protected readonly limits = L;
  protected readonly rotationExample = ROTATION_EXAMPLE;
  protected readonly lateExample = LATE_EXAMPLE;

  protected restaurant = this._restaurantService.model;

  // Repart des valeurs enregistrées quand le restaurant arrive, jamais à un rechargement SignalR :
  // une saisie en cours ne doit pas s'effacer. Le `computed` coupe la propagation tant que l'id ne change pas
  private _restaurantId = computed(() => this.restaurant()?.id ?? null);
  private _draft = linkedSignal<string | null, PlacementDraft>({
    source: this._restaurantId,
    computation: () => untracked(() => toDraft(this.restaurant())),
  });
  protected draft = this._draft.asReadonly();

  protected settingsForm = form(this._draft, (schema) => {
    required(schema.defaultRotation, { message: 'Indiquez la durée de rotation' });
    min(schema.defaultRotation, L.minRotation, { message: 'La rotation dure au moins 30 min' });
    max(schema.defaultRotation, L.maxRotation, { message: 'La rotation ne peut pas dépasser 6 h' });
    validate(schema.defaultRotation, ({ value }) => {
      const rotation = value();
      return rotation !== null && rotation % L.rotationStep !== 0
        ? { kind: 'step', message: 'La rotation se règle par pas de 15 min' }
        : undefined;
    });
    required(schema.seatTolerance, { message: 'Indiquez les places en trop tolérées' });
    min(schema.seatTolerance, L.minSeatTolerance, { message: 'La tolérance est d\'au moins 1 place' });
    max(schema.seatTolerance, L.maxSeatTolerance, { message: 'La tolérance ne peut pas dépasser 20 places' });
    required(schema.lateGrace, { message: 'Indiquez le délai avant « en retard »' });
    min(schema.lateGrace, 0, { message: 'Le délai ne peut pas être négatif' });
    max(schema.lateGrace, L.maxLateGrace, { message: 'Le délai ne peut pas dépasser 2 h' });
  });

  protected isSaving = signal(false);

  hasChanges = computed(() => {
    const saved = this.restaurant();
    const draft = this._draft();
    return saved !== null && (saved.defaultRotation !== draft.defaultRotation
      || saved.seatTolerance !== draft.seatTolerance
      || saved.lateGrace !== draft.lateGrace
      || saved.suggestCombinations !== draft.suggestCombinations
      || saved.trackTableCleaning !== draft.trackTableCleaning);
  });

  // ---- Aperçu de la tolérance, calculé par l'API ----

  protected readonly fitSymbol = PLACEMENT_FIT_SYMBOL;
  protected readonly fitLabel = PLACEMENT_FIT_LABEL;

  /** Taille de la réservation de l'aperçu, réglable sur place */
  protected previewCovers = signal<number | null>(4);

  /** Rien à demander tant que la tolérance ou les couverts sont vides ou hors bornes */
  private _previewParams = computed(() => {
    const covers = this.previewCovers();
    const tolerance = this._draft().seatTolerance;
    const coversValid = covers !== null && Number.isInteger(covers)
      && covers >= L.minPreviewCovers && covers <= L.maxPreviewCovers;
    return this.restaurant() !== null && coversValid && tolerance !== null && this.settingsForm.seatTolerance().valid()
      ? { covers: covers!, tolerance }
      : undefined;
  }, { equal: (a, b) => a?.covers === b?.covers && a?.tolerance === b?.tolerance });

  protected preview = resource({
    params: () => this._previewParams(),
    loader: async ({ params, abortSignal }) => {
      // Pas une requête par clic : on attend que la saisie se pose
      await new Promise((resolve) => setTimeout(resolve, PREVIEW_DELAY_MS));
      abortSignal.throwIfAborted();
      const result = await this._restaurantService.previewPlacement(params.covers, params.tolerance);
      if (result.error !== null) {
        throw new Error(result.error);
      }
      return result.value;
    },
  });

  protected chipClass(item: PlacementPreviewItem): string {
    return twMerge('flex flex-row items-center gap-1 rounded-full px-3 py-1 text-sm', PLACEMENT_FIT_STYLE[item.fit]);
  }

  // ---- Exemples ----

  protected rotationEnd = computed(() => ROTATION_EXAMPLE + (this._draft().defaultRotation ?? 0));
  protected lateAt = computed(() => LATE_EXAMPLE + (this._draft().lateGrace ?? 0));

  /** Les services qui ne prennent pas la rotation par défaut (PAR-06), dans l'ordre de la semaine */
  protected servicesWithOwnDuration = computed(() =>
    (this.restaurant()?.services ?? [])
      .filter((service) => service.expectedDuration !== null)
      .sort((a, b) => DAYS_OF_WEEK.indexOf(a.day) - DAYS_OF_WEEK.indexOf(b.day) || toMinutes(a.opening) - toMinutes(b.opening)));

  /** Combinaisons publiées en sommeil : celles que le logiciel pourra proposer de recoller */
  protected sleepingCombinations = computed(() =>
    this._floorPlan.zones().flatMap((zone) => zone.combinations).filter((combination) => !combination.isActive).length);

  cancel() {
    this._draft.set(toDraft(this.restaurant()));
  }

  async save() {
    const errors = this.settingsForm().errorSummary();
    if (errors.length > 0) {
      this.settingsForm().markAsTouched();
      await this._modalService.infoModal('Erreur', errors[0].message ?? 'Un réglage est invalide');
      return;
    }
    const draft = this._draft();
    const request: PlacementSettingsRequest = {
      defaultRotation: draft.defaultRotation!,
      seatTolerance: draft.seatTolerance!,
      lateGrace: draft.lateGrace!,
      suggestCombinations: draft.suggestCombinations,
      trackTableCleaning: draft.trackTableCleaning,
    };

    this.isSaving.set(true);
    const result = await this._restaurantService.updatePlacement(request);
    this.isSaving.set(false);

    if (result.error !== null) {
      await this._modalService.infoModal('Erreur', result.error);
    }
  }
}
