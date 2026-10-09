import { Component, computed, effect, ElementRef, inject, linkedSignal, NgZone, OnDestroy, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ApiError, Placement, PlacementEntity, PlacementLevel, PlacementMark, PlanCombination, PlanTable, ReservationDetail, ServiceSnapshot,
} from '../../models';
import { ServiceViewService } from '../../core/services/service-view/service-view.service';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { RestaurantService } from '../../core/services/restaurant/restaurant-service';
import { ClientService } from '../../core/services/client/client.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { UndoService } from '../../core/services/undo/undo.service';
import { ModalService } from '../../core/services/modal/modal.service';
import { Button } from '../../shared/components/button/button';
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
import { ToPlaceColumn } from './to-place-column/to-place-column';
import { defaultSlot, slotIndexAt, tableMarks, tableStatusAt, zoneCount } from './table-status';
import { apiErrorText } from '../../shared/utils/api-error-text';
import { entityId, nextText, reasonsMessage, targetOf } from './placement-reasons';
import { DropTarget, PlacementDrag } from './placement-drag';
import { bookedLater, bookedLaterText } from './walk-in';

export const TABLE_UNDO_TOO_LATE = 'Trop tard : la table a changé entre-temps';

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
  imports: [ServiceHeader, ServiceTimeline, ZoneTabs, FloorPlanCanvasComponent, PlanLegend, ToPlaceColumn, ReservationSheet, ClientSheet, ReservationForm, Button],
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

  private _params = toSignal(inject(ActivatedRoute).queryParamMap, { requireSync: true });

  protected snapshot = this._view.snapshot;
  protected failed = this._view.failed;
  protected isAdmin = inject(AuthService).isAdmin;
  protected timeZone = computed(() => this._restaurant.model()?.timeZone ?? 'Europe/Paris');
  protected hasServices = computed(() => (this._restaurant.model()?.services.length ?? 1) > 0);

  // L'anneau « en retard » avance avec l'heure, sans attendre de rechargement
  private _now = signal(Date.now());
  private _clock = inject(NgZone).runOutsideAngular(() => setInterval(() => this._now.set(Date.now()), NOW_MS));

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
  protected marks = computed(() => {
    const zone = this.zone();
    return zone === null ? null : tableMarks(zone, this._activeAt(), new Date(this._now()), this._track(), this.timeZone());
  });
  protected tableCount = computed(() => (this.snapshot()?.zones ?? []).reduce((count, zone) => count + zone.tables.length, 0));

  // ---- Le panneau : la fiche réservation et la fiche client se remplacent (§7.6) ----

  protected stack = signal<PanelEntry[]>([]);
  protected top = computed(() => this.stack().at(-1) ?? null);
  protected origin = computed(() => (this.stack().length > 1 ? this.stack()[0].label : null));
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

  constructor() {
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

  protected choose(choice: ServiceChoice) {
    this.closeAll();
    void this._router.navigate([], { queryParams: { day: choice.day, opening: choice.opening, at: null } });
  }

  protected backToToday() {
    this.closeAll();
    void this._router.navigate([], { queryParams: {} });
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
    this.bubble.set(null);
    this.seatBubble.set(null);
    if (this.top()?.id !== reservationId) {
      this.focusOn(reservationId);
    }
    this.placing.set({ reservationId, placement: null });
    this._placementLoad = this.loadPlacement();
    await this._placementLoad;
  }

  stopPlacing() {
    this._placementRequest++;
    this.placing.set(null);
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
    const wasPending = this.snapshot()?.pending.some((r) => r.id === placing.reservationId) ?? false;
    this._dropping = true;
    const result = await this._actions.placeOn(placing.reservationId, targetOf(entity), wasPending);
    this._dropping = false;
    if (result.error === null) {
      this.stopPlacing();
      return;
    }
    if (result.code === ApiError.PlacementUnavailable) {
      await this._modal.infoModal('Table prise', `La table ${entity.name} n'est plus libre pour cette réservation.`);
      this._placementLoad = this.loadPlacement();
      return;
    }
    await this._modal.infoModal('Placement impossible', apiErrorText(result));
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
    this.placing.set({ reservationId: placing.reservationId, placement: result.value });
  }

  /** En placement, toucher une entité allumée vaut un dépôt ; une écartée ne fait rien */
  protected async dropOn(target: { tableId?: string, combinationId?: string }) {
    await this._placementLoad;
    const entity = this.entityAt(target);
    if (entity !== null) {
      await this.drop(entity);
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
    if (this.placing() !== null) {
      void this.dropOn({ combinationId: event.item.id });
    }
  }

  protected onTable(event: PlanPointerEvent<PlanTable>) {
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
      const box = this._planArea()?.nativeElement.getBoundingClientRect();
      this.bubble.set({ tableId: table.id, name: table.name, x: event.event.clientX - (box?.left ?? 0), y: event.event.clientY - (box?.top ?? 0) });
    } else {
      this.bubble.set(null);
      const snapshot = this.snapshot();
      const now = new Date(Math.max(this._now(), Date.parse(snapshot?.now ?? '0')));
      // Libre maintenant, pas seulement au créneau regardé
      const freeNow = tableStatusAt(table, now, now, this._track()).status === 'Free';
      if (snapshot?.service?.state === 'InProgress' && freeNow) {
        const box = this._planArea()?.nativeElement.getBoundingClientRect();
        const later = bookedLater(table, now, snapshot.service.defaultDuration);
        this.seatBubble.set({
          tableId: table.id, name: table.name, capacity: table.capacity,
          x: event.event.clientX - (box?.left ?? 0), y: event.event.clientY - (box?.top ?? 0),
          later: later === null ? null : bookedLaterText(later, now, this.timeZone()), confirmed: false,
        });
      }
    }
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
