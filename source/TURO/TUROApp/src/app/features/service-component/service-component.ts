import { Component, computed, effect, ElementRef, inject, linkedSignal, NgZone, OnDestroy, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ApiError, CombinationReminder, LayoutRequest, PlaceTarget, Placement, PlacementApproach, PlacementEntity, PlacementLevel, PlacementMark, PlanCombination, PlanTable, ReminderAnswer, ReservationDetail, ServiceSnapshot, ServiceTable,
} from '../../models';
import { ServiceViewService } from '../../core/services/service-view/service-view.service';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { RestaurantService } from '../../core/services/restaurant/restaurant-service';
import { ClientService } from '../../core/services/client/client.service';
import { UndoService } from '../../core/services/undo/undo.service';
import { ModalService } from '../../core/services/modal/modal.service';
import { FloorPlanService } from '../../core/services/floor-plan/floor-plan.service';
import { Button } from '../../shared/components/button/button';
import { AccolageDialogComponent } from '../../shared/components/floor-plan/accolage-dialog-component';
import { SeparationDialogComponent } from '../../shared/components/floor-plan/separation-dialog-component';
import { FloorPlanCanvasComponent, PlanPointerEvent } from '../../shared/components/floor-plan/floor-plan-canvas-component';
import { ReservationSheet } from '../booking-component/reservation-sheet/reservation-sheet';
import { ClientSheet } from '../clients-component/client-sheet/client-sheet';
import { ReservationForm } from '../booking-component/reservation-form/reservation-form';
import { ReservationActions } from '../booking-component/reservation-actions';
import { ReservationFormMode, ReservationSaved } from '../booking-component/reservation-draft';
import { backTo, openFrom, PanelEntry } from '../booking-component/panel-stack';
import { ServiceChoice, ServiceHeader } from './service-header/service-header';
import { ServiceTimeline } from './service-timeline/service-timeline';
import { bestLevel, ZoneTabs } from './zone-tabs/zone-tabs';
import { PlanLegend } from './plan-legend/plan-legend';
import { CombinationReminders } from './combination-reminders/combination-reminders';
import { ApproachList, approachKey } from './approach-list/approach-list';
import { ApproachDialog } from './approach-dialog/approach-dialog';
import { answeredMessage } from './combination-reminders/reminder-text';
import { ToPlaceColumn } from './to-place-column/to-place-column';
import { defaultSlot, slotIndexAt, tableMarks, tableStatusAt, zoneCount } from './table-status';
import { apiErrorText } from '../../shared/utils/api-error-text';
import { entityId, nextText, reasonsMessage, targetOf } from './placement-reasons';
import { DropTarget, PlacementDrag } from './placement-drag';
import { bookedLater, bookedLaterText } from './walk-in';
import { LayoutDrop, LayoutEdit, LayoutScene, movedMessage } from './layout-edit';
import { ServiceViewKind, ViewTabs } from './view-tabs/view-tabs';
import { ServiceAgenda } from './service-agenda/service-agenda';
import { AgendaLegend } from './agenda-legend/agenda-legend';

export const TABLE_UNDO_TOO_LATE = 'Trop tard : la table a changé entre-temps';
export const PLAN_UNDO_TOO_LATE = 'Trop tard : le plan a changé entre-temps';

const NOW_MS = 30_000;

/** La bulle d'une table « à nettoyer », posée là où on l'a touchée */
interface CleanBubble {
  tableId: string,
  name: string,
  x: number,
  y: number,
}

/** La bulle d'une table libre maintenant : asseoir un client de passage (WALK-01) */
interface SeatBubble {
  tableId: string,
  name: string,
  capacity: number,
  x: number,
  y: number,
  /** « Réservée à 21:00 · Legrand · 4 p — 1 h devant vous » : il faut l'accord du restaurateur */
  later: string | null,
  confirmed: boolean,
}

/** Où commence une réservation du service, quel que soit l'endroit où elle apparaît */
function startOf(id: string, snapshot: ServiceSnapshot): string | null {
  const listed = [...snapshot.toPlace, ...snapshot.pending].find((r) => r.id === id);
  if (listed) {
    return listed.start;
  }
  for (const zone of snapshot.zones) {
    for (const table of zone.tables) {
      const occupation = table.occupations.find((o) => o.reservationId === id);
      if (occupation) {
        return occupation.start;
      }
    }
  }
  return null;
}

/** Une réservation que le plan peut placer : à placer, demandée, ou déjà sur une table sans être finie */
function isPlaceable(id: string, snapshot: ServiceSnapshot): boolean {
  return [...snapshot.toPlace, ...snapshot.pending].some((r) => r.id === id)
    || snapshot.zones.some((zone) => zone.tables.some((table) =>
      table.occupations.some((o) => o.reservationId === id && (o.status === 'Confirmed' || o.status === 'Seated'))));
}

/**
 * Service (§5) : un service, une heure (la frise), une salle (les onglets), et l'état de chaque table à cette heure.
 * L'adresse décrit l'écran (`day`, `opening`, `at`) : un rechargement ou un lien « Placer » y ramènent.
 * Toucher une table prise ou une pastille ouvre la fiche à la place de la colonne (§6.7) ; le formulaire « + » survole
 */
@Component({
  imports: [ServiceHeader, ViewTabs, ServiceTimeline, ZoneTabs, FloorPlanCanvasComponent, PlanLegend, ServiceAgenda, AgendaLegend, CombinationReminders, ToPlaceColumn, ReservationSheet, ClientSheet, ReservationForm, ApproachList, ApproachDialog, AccolageDialogComponent, SeparationDialogComponent, Button],
  selector: 'app-service-component',
  templateUrl: './service-component.html',
  host: { class: 'block h-full', '(document:keydown.escape)': 'onEscape()' },
})
export class ServiceComponent implements OnDestroy {
  private _view = inject(ServiceViewService);
  private _reservations = inject(ReservationService);
  private _restaurant = inject(RestaurantService);
  private _clients = inject(ClientService);
  private _router = inject(Router);
  private _actions = inject(ReservationActions);
  private _undo = inject(UndoService);
  private _modal = inject(ModalService);
  private _floorPlan = inject(FloorPlanService);

  private _params = toSignal(inject(ActivatedRoute).queryParamMap, { requireSync: true });

  protected snapshot = this._view.snapshot;
  protected failed = this._view.failed;
  protected timeZone = computed(() => this._restaurant.model()?.timeZone ?? 'Europe/Paris');
  protected hasServices = computed(() => (this._restaurant.model()?.services.length ?? 1) > 0);

  // L'anneau « en retard » avance avec l'heure, sans attendre de rechargement
  private _now = signal(Date.now());
  private _clock = inject(NgZone).runOutsideAngular(() => setInterval(() => this._now.set(Date.now()), NOW_MS));
  /** L'instant présent de l'Agenda : `now` de l'API couvre l'horloge locale en retard */
  protected present = computed(() => Math.max(this._now(), Date.parse(this.snapshot()?.now ?? '0')));

  /** La vue (Plan ou Agenda) vit dans l'adresse : un rechargement, un autre service ou « Aujourd'hui » la gardent (NAV-08) */
  view = computed<ServiceViewKind>(() => (this._params().get('view') === 'agenda' ? 'agenda' : 'plan'));

  // ---- Le créneau : celui de l'adresse, sinon maintenant (service en cours) ou le premier ----

  private _picked = signal<{ key: string, index: number } | null>(null);
  private _serviceKey = computed(() => {
    const snapshot = this.snapshot();
    return snapshot === null ? '' : `${snapshot.day} ${snapshot.service?.opening ?? ''}`;
  });
  protected activeIndex = computed(() => {
    const snapshot = this.snapshot();
    if (snapshot === null || snapshot.slots.length === 0) {
      return 0;
    }
    const picked = this._picked();
    if (picked?.key === this._serviceKey()) {
      return Math.min(picked.index, snapshot.slots.length - 1);
    }
    const at = this._params().get('at');
    const fromAddress = at === null ? -1 : snapshot.slots.findIndex((slot) => slot.time.startsWith(at));
    return fromAddress >= 0 ? fromAddress : defaultSlot(snapshot, new Date(this._now()));
  });
  /**
   * L'heure que montre le plan. Le créneau en cours d'un service en cours se lit à maintenant, pas à son début :
   * une table libérée à 20:06 n'est plus occupée sur le créneau de 20:00. `now` de l'API couvre l'horloge locale en retard
   */
  private _activeAt = computed(() => {
    const snapshot = this.snapshot();
    if (snapshot === null) {
      return new Date(this._now());
    }
    const index = this.activeIndex();
    const present = Math.max(this._now(), Date.parse(snapshot.now));
    if (snapshot.service?.state === 'InProgress' && index === slotIndexAt(snapshot.slots, new Date(present))) {
      return new Date(present);
    }
    return new Date(snapshot.slots[index]?.at ?? snapshot.now);
  });

  /** La prochaine fin prévue d'une table assise, encore à venir quand l'instantané a été pris */
  private _nextSeatedEnd = computed(() => {
    const snapshot = this.snapshot();
    if (snapshot === null) {
      return null;
    }
    const taken = Date.parse(snapshot.now);
    const ends = snapshot.zones.flatMap((zone) => zone.tables).flatMap((table) => table.occupations)
      .filter((o) => o.status === 'Seated')
      .map((o) => Date.parse(o.end))
      .filter((end) => end > taken);
    return ends.length === 0 ? null : Math.min(...ends);
  });

  // ---- La salle : gardée d'un rechargement à l'autre tant qu'elle existe ----

  protected zoneId = linkedSignal<string[], string | null>({
    source: () => this.snapshot()?.zones.map((zone) => zone.id) ?? [],
    computation: (ids, previous) => (previous?.value != null && ids.includes(previous.value) ? previous.value : ids[0] ?? null),
  });
  protected zone = computed(() => this.snapshot()?.zones.find((zone) => zone.id === this.zoneId()) ?? null);
  private _track = computed(() => this.snapshot()?.trackTableCleaning ?? false);
  protected tabs = computed(() => (this.snapshot()?.zones ?? []).map((zone) => ({
    id: zone.id, name: zone.name, ...zoneCount(zone, this._activeAt(), new Date(this._now()), this._track()),
  })));
  /** COMB-06 : les rappels échus survolent le plan ; leurs tables portent le ! violet */
  protected reminders = this._view.dueReminders;
  private _reminderTables = computed(() => new Set(this.reminders().flatMap((reminder) => reminder.tableIds)));
  protected marks = computed(() => {
    const zone = this.zone();
    return zone === null ? null : tableMarks(zone, this._activeAt(), new Date(this._now()), this._track(), this.timeZone(), this._reminderTables());
  });
  protected tableCount = computed(() => (this.snapshot()?.zones ?? []).reduce((count, zone) => count + zone.tables.length, 0));

  // ---- Le panneau : la fiche réservation et la fiche client se remplacent (§7.6) ----

  protected stack = signal<PanelEntry[]>([]);
  protected top = computed(() => this.stack().at(-1) ?? null);
  protected origin = computed(() => (this.stack().length > 1 ? this.stack()[0].label : null));
  /** La réservation dont la fiche est ouverte : son bloc s'allume dans l'Agenda, même ouverte depuis une bande fantôme (AGD-02) */
  protected openReservationId = computed(() => {
    const top = this.top();
    return top?.kind === 'reservation' ? top.id : null;
  });
  protected client = this._reservations.client;
  protected clientFailed = this._reservations.clientFailed;
  /** Les tables de la réservation ouverte, en orange : la sélection, jamais un statut */
  protected selectedTableIds = computed(() => {
    const top = this.top();
    const zone = this.zone();
    if (top?.kind !== 'reservation' || zone === null) {
      return [];
    }
    return zone.tables.filter((table) => table.occupations.some((o) => o.reservationId === top.id)).map((table) => table.id);
  });

  /** Le formulaire survole le plan (PLACE-11) */
  protected form = signal<ReservationFormMode | null>(null);
  protected bubble = signal<CleanBubble | null>(null);
  /** WALK-01 : la bulle « Asseoir maintenant » ; `later` : la table attend quelqu'un pendant le repas */
  protected seatBubble = signal<SeatBubble | null>(null);
  protected coverChoices = computed(() => Array.from({ length: this.seatBubble()?.capacity ?? 0 }, (_, i) => i + 1));
  private _planArea = viewChild<ElementRef<HTMLElement>>('planArea');

  // ---- Le placement (§5.8) : les halos viennent de l'API, le plan est l'objet de l'action ----

  placing = signal<{ reservationId: string, placement: Placement | null } | null>(null);
  /** Le dernier GET des halos : une réponse plus ancienne, arrivée en retard, est ignorée */
  private _placementRequest = 0;
  private _placementLoad: Promise<void> = Promise.resolve();
  private _dropping = false;
  private _confirming = false;

  /** Le rapprochement désigné dans la liste : ses tables s'allument, reliées (RAPP-03) */
  approach = signal<PlacementApproach | null>(null);
  protected selectedApproachKey = computed(() => {
    const approach = this.approach();
    return approach === null ? null : approachKey(approach);
  });
  protected approachLine = computed(() => this.approach()?.tableIds ?? null);
  /** Une paire inédite à nommer avant de la créer en plaçant (PLACE-08) */
  protected approachDialog = signal<{ approach: PlacementApproach, message: string, guest: string, covers: number } | null>(null);

  /** Le plan publié, en sommeil compris : ce que l'accolage réveille, et ce dont un nom doit se distinguer */
  protected allTables = computed<ServiceTable[]>(() => (this.snapshot()?.zones ?? []).flatMap((zone) => zone.tables));
  protected allCombinations = computed<PlanCombination[]>(() => this._floorPlan.zones()
    .flatMap((zone) => zone.combinations.map(({ id, name, capacity, tableIds, isActive }) => ({ id, name, capacity, tableIds, isActive }))));

  /** Le glisser (§5.8) : une pastille vers une table, ou l'occupation d'une table vers une autre */
  readonly drag = new PlacementDrag();
  protected ghost = this.drag.ghost;

  /** Les marques du canevas : tables et combinaisons */
  protected placementMarks = computed<Record<string, PlacementMark> | null>(() => {
    const placement = this.placing()?.placement;
    if (!placement) {
      return null;
    }
    const marks: Record<string, PlacementMark> = {};
    for (const entity of placement.entities) {
      marks[entityId(entity)] = { level: entity.level, next: entity.next === null || entity.level === 'Excluded' ? null : nextText(entity.next, this.timeZone()) };
    }
    // Un rapprochement désigné : ses tables prennent son niveau, quelle que soit leur marque seules
    const approach = this.approach();
    for (const id of approach?.tableIds ?? []) {
      marks[id] = { level: approach!.level, next: null };
    }
    return marks;
  });

  /** §5.5 : chaque onglet porte le meilleur niveau de sa salle */
  protected zoneLevels = computed<Record<string, PlacementLevel | null> | null>(() => {
    const placement = this.placing()?.placement;
    if (!placement) {
      return null;
    }
    const levels: Record<string, PlacementLevel | null> = {};
    for (const zone of this.snapshot()?.zones ?? []) {
      levels[zone.id] = bestLevel(placement.entities.filter((e) => e.zoneId === zone.id).map((e) => e.level));
    }
    return levels;
  });

  // ---- Le mode édition (§5.5) : déplacer, coller, séparer sur place, pour les deux rôles ----

  editing = signal(false);
  readonly layoutEdit = new LayoutEdit();
  private _canvas = viewChild(FloorPlanCanvasComponent);
  /** Le lâcher dont la fenêtre d'accolage, ou de séparation, attend la réponse */
  protected accolage = signal<LayoutDrop | null>(null);
  protected separation = signal<LayoutDrop | null>(null);

  /** Les tables telles qu'elles s'affichent : l'aperçu d'un glisser, ou d'un lâcher que l'API n'a pas encore relu */
  protected planTables = computed(() => {
    const preview = this.layoutEdit.preview();
    return (this.zone()?.tables ?? []).map((table) => {
      const position = preview?.get(table.id);
      return position === undefined ? table : { ...table, ...position };
    });
  });

  protected accolageView = computed(() => {
    const proposal = this.accolage()?.accolage;
    if (!proposal) {
      return null;
    }
    const members = proposal.tableIds
      .map((id) => this.allTables().find((table) => table.id === id))
      .filter((table): table is ServiceTable => table !== undefined);
    return members.length !== proposal.tableIds.length ? null : {
      members,
      existing: this.allCombinations().find((c) => c.id === proposal.existingId) ?? null,
      deactivated: this.allCombinations().filter((c) => proposal.deactivatedIds.includes(c.id)),
    };
  });

  protected separationView = computed(() => {
    const proposal = this.separation()?.separation;
    const combination = this.allCombinations().find((c) => c.id === proposal?.combinationId);
    return combination === undefined ? null : {
      combination,
      reactivated: this.allCombinations().find((c) => c.id === proposal?.reactivatedId) ?? null,
    };
  });

  protected toggleEditing() {
    if (this.editing()) {
      this.stopEditing();
      return;
    }
    if (this.placing() !== null) {
      return;
    }
    this.closeAll();
    this.form.set(null);
    this.editing.set(true);
  }

  private stopEditing() {
    this.layoutEdit.reset();
    this.accolage.set(null);
    this.separation.set(null);
    this.editing.set(false);
  }

  private scene(): LayoutScene | null {
    const zone = this.zone();
    const canvas = this._canvas();
    return zone === null || canvas === undefined ? null : {
      zone, tables: zone.tables, decors: zone.decors, combinations: this.allCombinations(),
      toMetres: (x, y) => canvas.toMetres(x, y),
    };
  }

  /** Un lâcher : l'accolage se demande d'abord, puis la séparation ; sinon le déplacement part seul */
  async onLayoutDrop(drop: LayoutDrop) {
    if (drop.accolage !== null) {
      this.accolage.set(drop);
      return;
    }
    if (drop.separation !== null) {
      this.separation.set(drop);
      return;
    }
    await this.sendLayout({ moves: drop.moves }, movedMessage(drop.moves, this.allTables()));
  }

  protected async createCombination({ name, capacity }: { name: string, capacity: number }) {
    const drop = this.accolage();
    if (drop?.accolage == null) {
      return;
    }
    this.accolage.set(null);
    await this.sendLayout({ moves: drop.moves, glue: { tableIds: [...drop.accolage.tableIds], name, capacity } }, `${name} collée`);
  }

  protected async reactivateCombination() {
    const drop = this.accolage();
    const existing = this.allCombinations().find((c) => c.id === drop?.accolage?.existingId);
    if (drop === null || existing === undefined) {
      return;
    }
    this.accolage.set(null);
    await this.sendLayout({ moves: drop.moves, glue: { combinationId: existing.id } }, `${existing.name} collée`);
  }

  protected async dismissAccolage() {
    const drop = this.accolage();
    if (drop?.accolage == null) {
      return;
    }
    this.layoutEdit.decline(drop.accolage);
    this.accolage.set(null);
    // la table a quand même quitté sa combinaison : refuser la nouvelle ne laisse pas l'ancienne réservable
    if (drop.separation !== null) {
      this.separation.set(drop);
      return;
    }
    await this.sendLayout({ moves: drop.moves }, movedMessage(drop.moves, this.allTables()));
  }

  protected async separateCombination() {
    const drop = this.separation();
    const proposal = drop?.separation;
    if (drop === null || !proposal) {
      return;
    }
    this.separation.set(null);
    const name = this.allCombinations().find((c) => c.id === proposal.combinationId)?.name ?? '';
    await this.sendLayout({ moves: drop.moves, separate: { combinationId: proposal.combinationId, reactivateId: proposal.reactivatedId } },
      `${name} séparée`);
  }

  protected async dismissSeparation() {
    const drop = this.separation();
    if (drop?.separation == null) {
      return;
    }
    this.layoutEdit.keep(drop.separation);
    this.separation.set(null);
    await this.sendLayout({ moves: drop.moves }, movedMessage(drop.moves, this.allTables()));
  }

  private async sendLayout(request: LayoutRequest, message: string) {
    const result = await this._view.layout(request);
    if (result.error === null) {
      const undoId = result.value.undoId;
      this._undo.offer({ message, run: () => this._view.undo(undoId), tooLate: PLAN_UNDO_TOO_LATE });
      return;
    }
    this.layoutEdit.clear();
    await this._modal.infoModal('Modification impossible', apiErrorText(result));
  }

  constructor() {
    // Le plan relu remplace l'aperçu du lâcher, sauf pendant un geste ou une question en attente : l'aperçu y est encore la seule trace
    effect(() => {
      this.snapshot();
      untracked(() => {
        if (!this.layoutEdit.isDragging() && this.accolage() === null && this.separation() === null) {
          this.layoutEdit.clear();
        }
      });
    });

    // Une fenêtre dont les tables ont disparu au rechargement ne peut plus répondre : le déplacement part seul, il n'est pas perdu
    effect(() => {
      const accolage = this.accolage();
      const separation = this.separation();
      const stuck = accolage !== null ? this.accolageView() === null : separation !== null && this.separationView() === null;
      const drop = accolage ?? separation;
      if (stuck && drop !== null) {
        untracked(() => {
          this.accolage.set(null);
          this.separation.set(null);
          void this.sendLayout({ moves: drop.moves }, movedMessage(drop.moves, this.allTables()));
        });
      }
    });

    effect(() => {
      const params = this._params();
      this._view.setQuery({ day: params.get('day'), opening: params.get('opening'), focus: params.get('place') ?? params.get('focus') });
    });

    // L'instantané arrivé : la réservation désignée s'ouvre, puis l'adresse nomme le service affiché
    effect(() => {
      const snapshot = this.snapshot();
      // Un rechargement en échec garde l'instantané d'avant : il ne décide pas de l'adresse
      if (snapshot === null || this._view.isLoading() || this._view.failed()) {
        return;
      }
      const params = this._params();
      const focus = params.get('place') ?? params.get('focus');
      untracked(() => {
        if (focus !== null) {
          this.focusOn(focus);
          // « Placer » depuis Réservations (§6.4) : les halos s'allument, si le plan peut encore la placer
          if (params.get('place') !== null && isPlaceable(focus, snapshot)) {
            void this.startPlacing(focus);
          }
        }
        const opening = snapshot.service?.opening.slice(0, 5) ?? null;
        if (opening !== null && (focus !== null || params.get('day') !== snapshot.day || params.get('opening') !== opening)) {
          void this._router.navigate([], {
            // `at` repris ici : deux navigations simultanées, la seconde annulerait le créneau écrit par `focusOn`
            queryParams: { day: snapshot.day, opening, place: null, focus: null, ...(focus !== null ? { at: snapshot.slots[this.activeIndex()]?.time.slice(0, 5) ?? null } : {}) },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      });
    });

    // Un rechargement (un collègue a placé ailleurs) refait les halos sans quitter le placement
    effect(() => {
      this.snapshot();
      if (untracked(() => this.placing()?.placement) != null) {
        untracked(() => { this._placementLoad = this.loadPlacement(); });
      }
    });

    // Le service demandé n'existe plus (ouverture déplacée, jour fermé entre-temps) : on retombe sur le jour
    effect(() => {
      if (this._view.notFound() && this._params().get('opening') !== null) {
        untracked(() => void this._router.navigate([], { queryParams: { opening: null, at: null }, queryParamsHandling: 'merge', replaceUrl: true }));
      }
    });

    // Une table assise atteint son heure prévue : l'API seule sait qu'elle déborde, on lui redemande l'état (§3.2)
    effect(() => {
      const end = this._nextSeatedEnd();
      if (end !== null && this._now() >= end && !untracked(() => this._view.isLoading())) {
        untracked(() => this._view.reload());
      }
    });

    // « Annuler » dans le bandeau après une création ou une modification : le formulaire revient
    effect(() => {
      if (this._actions.reopened() === null) {
        return;
      }
      untracked(() => {
        const mode = this._actions.takeReopened()!;
        if (mode.kind === 'create') {
          this.close();
        }
        this.form.set(mode);
      });
    });
  }

  protected pickSlot(index: number) {
    const snapshot = this.snapshot();
    if (snapshot === null || snapshot.slots[index] === undefined) {
      return;
    }
    this._picked.set({ key: this._serviceKey(), index });
    void this._router.navigate([], { queryParams: { at: snapshot.slots[index].time.slice(0, 5) }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** L'édition du plan ne se quitte pas par l'onglet : elle n'existe que dans la vue Plan */
  selectView(kind: ServiceViewKind) {
    if (this.editing()) {
      return;
    }
    // Les bulles sont posées sur le plan : elles ne survivent pas à un changement de vue
    this.bubble.set(null);
    this.seatBubble.set(null);
    void this._router.navigate([], { queryParams: { view: kind === 'agenda' ? 'agenda' : null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Le Plan n'écrit rien dans l'adresse : `view: null` y est omis */
  private _viewParam() {
    return this.view() === 'agenda' ? 'agenda' : null;
  }

  protected choose(choice: ServiceChoice) {
    this.closeAll();
    void this._router.navigate([], { queryParams: { day: choice.day, opening: choice.opening, at: null, view: this._viewParam() } });
  }

  protected backToToday() {
    this.closeAll();
    void this._router.navigate([], { queryParams: { view: this._viewParam() } });
  }

  /** FRISE-04 : ouvrir une réservation déplace la frise sur son créneau */
  protected focusOn(id: string) {
    if (this.placing()?.reservationId !== id) {
      this.stopPlacing();
    }
    this.bubble.set(null);
    this.seatBubble.set(null);
    this.stack.set([{ kind: 'reservation', id, label: '' }]);
    this.show();
    const snapshot = this.snapshot();
    const start = snapshot === null ? null : startOf(id, snapshot);
    if (snapshot !== null && start !== null) {
      this.pickSlot(slotIndexAt(snapshot.slots, new Date(start)));
    }
  }

  /** La réservation s'ouvre, la frise saute sur son créneau, puis les halos s'allument */
  async startPlacing(reservationId: string) {
    if (this.editing()) {
      return;
    }
    this.bubble.set(null);
    this.seatBubble.set(null);
    if (this.top()?.id !== reservationId) {
      this.focusOn(reservationId);
    }
    if (this.placing()?.reservationId !== reservationId) {
      this.approach.set(null);
      this.approachDialog.set(null);
    }
    // Le plan des combinaisons se charge à la demande : prêt avant que la fenêtre d'une paire inédite valide un nom
    this.allCombinations();
    this.placing.set({ reservationId, placement: null });
    this._placementLoad = this.loadPlacement();
    await this._placementLoad;
  }

  stopPlacing() {
    this._placementRequest++;
    this.placing.set(null);
    this.approach.set(null);
    this.approachDialog.set(null);
  }

  /** L'entité sous un toucher ou un lâcher */
  entityAt(target: { tableId?: string, combinationId?: string }): PlacementEntity | null {
    const placement = this.placing()?.placement;
    return placement?.entities.find((e) =>
      target.tableId !== undefined ? e.tableId === target.tableId : e.combinationId === target.combinationId) ?? null;
  }

  /** PLACE-06 / PLACE-07 : ✓ place aussitôt ; ~✓ et ! disent toutes leurs raisons d'abord */
  async drop(entity: PlacementEntity) {
    const placing = this.placing();
    const placement = placing?.placement;
    if (!placing || !placement || entity.level === 'Excluded' || this._dropping) {
      return;
    }
    const guest = placement.guestName ?? 'ce client';
    if (entity.level !== 'Perfect') {
      const zoneName = this.snapshot()?.zones.find((z) => z.id === entity.zoneId)?.name ?? '';
      const message = reasonsMessage(entity, { guest, covers: placement.covers, name: entity.name, capacity: entity.capacity, zoneName, end: placement.end }, this.timeZone());
      if (!await this._modal.confirmModal(`Placer ${guest} sur ${entity.name} ?`, message, 'Placer', 'Annuler')) {
        return;
      }
    }
    await this.placeOn(placing.reservationId, targetOf(entity), { title: 'Table prise', text: `La table ${entity.name} n'est plus libre pour cette réservation.` });
  }

  /** Place la réservation ; une cible prise entre-temps rouvre les halos, toute autre erreur est dite telle quelle */
  private async placeOn(reservationId: string, target: PlaceTarget, taken: { title: string, text: string }, ...suffix: [string?]) {
    const wasPending = this.snapshot()?.pending.some((r) => r.id === reservationId) ?? false;
    this._dropping = true;
    const result = await this._actions.placeOn(reservationId, target, wasPending, ...suffix);
    this._dropping = false;
    if (result.error === null) {
      this.stopPlacing();
      return;
    }
    if (result.code === ApiError.PlacementUnavailable) {
      await this._modal.infoModal(taken.title, taken.text);
      this._placementLoad = this.loadPlacement();
      return;
    }
    await this._modal.infoModal('Placement impossible', apiErrorText(result));
  }

  /** Toucher une ligne la désigne ; la toucher de nouveau vaut un dépôt, comme une table allumée (PLACE-14) */
  selectApproach(approach: PlacementApproach) {
    const current = this.approach();
    if (current !== null && approachKey(current) === approachKey(approach)) {
      void this.dropApproach(approach);
      return;
    }
    this.approach.set(approach);
    this.zoneId.set(approach.zoneId);
  }

  /** Jamais ✓ : toutes les raisons d'abord. Une paire inédite demande en plus son nom et ses places */
  async dropApproach(approach: PlacementApproach) {
    const placement = this.placing()?.placement;
    if (!placement || this._dropping || this._confirming) {
      return;
    }
    const guest = placement.guestName ?? 'ce client';
    const zoneName = this.snapshot()?.zones.find((zone) => zone.id === approach.zoneId)?.name ?? '';
    const message = reasonsMessage(approach,
      { guest, covers: placement.covers, name: approach.name, capacity: approach.capacity, zoneName, end: placement.end }, this.timeZone());
    if (approach.combinationId === null) {
      this.approachDialog.set({ approach, message, guest, covers: placement.covers });
      return;
    }
    // Deux « Placer » rapprochés n'ouvrent pas deux confirmations
    this._confirming = true;
    const confirmed = await this._modal.confirmModal(`Placer ${guest} sur ${approach.name} ?`, message, 'Placer', 'Annuler').finally(() => (this._confirming = false));
    if (!confirmed) {
      return;
    }
    await this.placeApproach({ combinationId: approach.combinationId }, approach.name);
  }

  protected async confirmApproach({ name, capacity }: { name: string, capacity: number }) {
    const dialog = this.approachDialog();
    if (dialog === null) {
      return;
    }
    this.approachDialog.set(null);
    await this.placeApproach({ newCombination: { tableIds: [...dialog.approach.tableIds], name, capacity } }, name);
  }

  private async placeApproach(target: PlaceTarget, name: string) {
    const placing = this.placing();
    if (placing === null) {
      return;
    }
    await this.placeOn(placing.reservationId, target, { title: 'Tables prises', text: `${name} n'est plus libre pour cette réservation.` }, ' (à rapprocher)');
  }

  private async loadPlacement() {
    const placing = this.placing();
    if (placing === null) {
      return;
    }
    const request = ++this._placementRequest;
    const result = await this._view.placement(placing.reservationId);
    if (request !== this._placementRequest || this.placing()?.reservationId !== placing.reservationId) {
      return;
    }
    if (result.error !== null) {
      this.stopPlacing();
      await this._modal.infoModal('Placement impossible', apiErrorText(result));
      return;
    }
    // Un rapprochement que l'API ne propose plus ne reste pas désigné
    const chosen = this.approach();
    if (chosen !== null && !result.value.approaches.some((a) => approachKey(a) === approachKey(chosen))) {
      this.approach.set(null);
    }
    this.placing.set({ reservationId: placing.reservationId, placement: result.value });
  }

  /**
   * En placement, toucher une entité allumée vaut un dépôt ; une écartée ne fait rien. L'Agenda dépose aussi sur un rapprochement :
   * une ligne proposée (sa clé), ou une combinaison en sommeil que le moteur propose (son id, sans entité à elle)
   */
  protected async dropOn(target: DropTarget) {
    await this._placementLoad;
    // Un rapprochement écarté ne reçoit rien, comme une table écartée
    const approaches = (this.placing()?.placement?.approaches ?? []).filter((a) => a.level !== 'Excluded');
    if (target.approachKey !== undefined) {
      const approach = approaches.find((a) => approachKey(a) === target.approachKey);
      if (approach !== undefined) {
        await this.dropApproach(approach);
      }
      return;
    }
    const entity = this.entityAt(target);
    if (entity !== null) {
      await this.drop(entity);
      return;
    }
    const approach = target.combinationId === undefined ? undefined : approaches.find((a) => a.combinationId === target.combinationId);
    if (approach !== undefined) {
      await this.dropApproach(approach);
    }
  }

  /** Une ligne de l'Agenda pressée : un dépôt en placement, rien sinon (ouvrir passe par `opened`) */
  protected onRowPressed(target: DropTarget) {
    if (this.placing() !== null) {
      void this.dropOn(target);
    }
  }

  protected onPillPressed(event: { id: string, label: string, event: PointerEvent }) {
    this.dragToPlace(event.id, event.label, event.event);
  }

  /** Au-delà du seuil, le plan s'allume ; au lâcher, la table sous le doigt est la cible */
  private dragToPlace(reservationId: string, label: string, event: PointerEvent) {
    this.drag.press(event, label, {
      onStart: () => void this.startPlacing(reservationId),
      onDrop: (target: DropTarget | null) => {
        if (target !== null) {
          void this.dropOn(target);
        }
      },
    });
  }

  protected onCombination(event: PlanPointerEvent<PlanCombination>) {
    if (this.editing()) {
      const scene = this.scene();
      if (scene !== null) {
        this.layoutEdit.pressCombination(event.event, event.point, event.item, scene, (drop) => void this.onLayoutDrop(drop));
      }
      return;
    }
    if (this.placing() !== null) {
      void this.dropOn({ combinationId: event.item.id });
    }
  }

  protected onTable(event: PlanPointerEvent<PlanTable>) {
    if (this.editing()) {
      const scene = this.scene();
      if (scene !== null) {
        this.layoutEdit.pressTable(event.event, event.point, event.item, scene, (drop) => void this.onLayoutDrop(drop));
      }
      return;
    }
    if (this.placing() !== null) {
      void this.dropOn({ tableId: event.item.id });
      return;
    }
    const table = this.zone()?.tables.find((t) => t.id === event.item.id);
    this.seatBubble.set(null);
    if (table === undefined) {
      return;
    }
    const state = tableStatusAt(table, this._activeAt(), new Date(this._now()), this._track());
    if (state.occupation !== null) {
      const occupation = state.occupation;
      this.focusOn(occupation.reservationId);
      // Glisser l'occupation vers une autre table : changer de table (§5.8)
      if (occupation.status === 'Confirmed' || occupation.status === 'Seated') {
        this.dragToPlace(occupation.reservationId, `${occupation.guestName ?? 'Passage'} · ${occupation.covers}p`, event.event);
      }
    } else if (state.status === 'ToClean') {
      this.bubble.set({ tableId: table.id, name: table.name, ...this.bubbleAt(event.event) });
    } else {
      this.bubble.set(null);
      const snapshot = this.snapshot();
      const now = new Date(Math.max(this._now(), Date.parse(snapshot?.now ?? '0')));
      // Libre maintenant, pas seulement au créneau regardé
      const freeNow = tableStatusAt(table, now, now, this._track()).status === 'Free';
      // WALK-05 : aussi avant le prochain service du jour (celui que l'écran montre par défaut)
      const service = snapshot?.service;
      if (snapshot && service && freeNow && (service.state === 'InProgress' || (service.state === 'Upcoming' && snapshot.isDefault))) {
        const opening = new Date(snapshot.slots[0]?.at ?? now);
        const later = bookedLater(table, now, service.defaultDuration, opening);
        this.seatBubble.set({
          tableId: table.id, name: table.name, capacity: table.capacity,
          ...this.bubbleAt(event.event),
          later: later === null ? null : bookedLaterText(later, now, this.timeZone()), confirmed: false,
        });
      }
    }
  }

  /** Où poser une bulle : là où on a touché, dans le repère de la zone du plan */
  private bubbleAt(event: PointerEvent): { x: number, y: number } {
    const box = this._planArea()?.nativeElement.getBoundingClientRect();
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
  }

  protected async seat(covers: number) {
    const bubble = this.seatBubble();
    if (bubble === null) {
      return;
    }
    const result = await this._view.seat(bubble.tableId, covers, bubble.later !== null);
    if (result.error === null) {
      this.seatBubble.set(null);
      if (result.value.eventId !== null) {
        this._undo.offer({ message: `Client de passage assis · ${bubble.name}`, reservationId: result.value.reservation.id, eventId: result.value.eventId });
      }
      return;
    }
    if (result.code === ApiError.TableBookedLater) {
      // L'instantané était en retard : on demande l'accord, comme si on l'avait su
      this.seatBubble.set({ ...bubble, later: apiErrorText(result), confirmed: false });
      return;
    }
    this.seatBubble.set(null);
    await this._modal.infoModal('Action impossible', apiErrorText(result));
  }

  protected async answerReminder({ reminder, answer }: { reminder: CombinationReminder, answer: ReminderAnswer }) {
    const result = await this._view.answerReminder(reminder.combinationId, reminder.kind, answer);
    if (result.error === null) {
      const undoId = result.value.undoId;
      this._undo.offer({ message: answeredMessage(reminder, answer), run: () => this._view.undo(undoId), tooLate: PLAN_UNDO_TOO_LATE });
      return;
    }
    if (result.code === ApiError.ReminderChanged) {
      // Un collègue a répondu : la liste relue montre le rappel tel qu'il est
      this._view.reloadReminders();
      return;
    }
    await this._modal.infoModal('Action impossible', apiErrorText(result));
  }

  protected async clean() {
    const bubble = this.bubble();
    if (bubble === null) {
      return;
    }
    this.bubble.set(null);
    const result = await this._view.clean(bubble.tableId);
    if (result.error !== null) {
      await this._modal.infoModal('Action impossible', apiErrorText(result));
      return;
    }
    const { tableId, since } = result.value;
    this._undo.offer({ message: `Table ${bubble.name} nettoyée`, run: () => this._view.undoClean(tableId, since), tooLate: TABLE_UNDO_TOO_LATE });
  }

  protected startCreate() {
    if (this.editing()) {
      return;
    }
    const day = this.snapshot()?.day;
    this.form.set({ kind: 'create', draft: day === undefined ? { source: 'WalkIn' } : { serviceDay: day, source: 'WalkIn' } });
  }

  protected startEdit(reservation: ReservationDetail) {
    this.form.set({ kind: 'edit', reservation });
  }

  protected onSaved(event: ReservationSaved) {
    this.form.set(null);
    if (event.mode === 'create') {
      this.focusOn(event.result.reservation.id);
    }
    this._actions.saved(event);
  }

  protected openClient(event: { id: string, origin: string }) {
    this.go(event.origin, { kind: 'client', id: event.id, label: '' });
  }

  protected openReservation(id: string) {
    this.go(this.client()?.name ?? 'Fiche client', { kind: 'reservation', id, label: '' });
  }

  protected openInClients(id: string) {
    this._clients.select(id);
    void this._router.navigate(['/clients']);
  }

  protected back() {
    this.stack.update(backTo);
    this.show();
  }

  protected close() {
    this.stopPlacing();
    this.stack.set([]);
    this._reservations.select(null);
    this._reservations.selectClient(null);
  }

  /** Toucher le plan hors d'une table : la bulle et la fiche se ferment */
  protected closeAll() {
    this.bubble.set(null);
    this.seatBubble.set(null);
    this.close();
  }

  protected onEscape() {
    if (this.editing()) {
      if (this.accolage() === null && this.separation() === null) {
        this.stopEditing();
      }
      return;
    }
    if (this.placing() !== null) {
      this.stopPlacing();
    } else if (this.bubble() !== null) {
      this.bubble.set(null);
    } else if (this.seatBubble() !== null) {
      this.seatBubble.set(null);
    } else if (this.form() !== null) {
      this.form.set(null);
    } else {
      this.close();
    }
  }

  ngOnDestroy() {
    clearInterval(this._clock);
    this.drag.cancel();
    this.layoutEdit.reset();
    this._view.setQuery(null);
  }

  private go(fromLabel: string, entry: PanelEntry) {
    this.stack.update((stack) => openFrom(stack.map((e, i) => (i === stack.length - 1 ? { ...e, label: fromLabel } : e)), entry));
    this.show();
  }

  private show() {
    const top = this.top();
    if (top?.kind === 'reservation') {
      this._reservations.select(top.id);
    } else if (top?.kind === 'client') {
      this._reservations.selectClient(top.id);
    }
  }
}
