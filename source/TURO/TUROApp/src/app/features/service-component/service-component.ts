import { Component, computed, effect, ElementRef, inject, linkedSignal, NgZone, OnDestroy, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { PlanTable, ReservationDetail, ServiceSnapshot } from '../../models';
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
import { ZoneTabs } from './zone-tabs/zone-tabs';
import { PlanLegend } from './plan-legend/plan-legend';
import { ToPlaceColumn } from './to-place-column/to-place-column';
import { defaultSlot, slotIndexAt, tableMarks, tableStatusAt, zoneCount } from './table-status';
import { apiErrorText } from '../../shared/utils/api-error-text';

export const TABLE_UNDO_TOO_LATE = 'Trop tard : la table a changé entre-temps';

const NOW_MS = 30_000;

/** La bulle d'une table « à nettoyer », posée là où on l'a touchée */
interface CleanBubble {
  tableId: string,
  name: string,
  x: number,
  y: number,
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
  private _planArea = viewChild<ElementRef<HTMLElement>>('planArea');

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
    this.bubble.set(null);
    this.stack.set([{ kind: 'reservation', id, label: '' }]);
    this.show();
    const snapshot = this.snapshot();
    const start = snapshot === null ? null : startOf(id, snapshot);
    if (snapshot !== null && start !== null) {
      this.pickSlot(slotIndexAt(snapshot.slots, new Date(start)));
    }
  }

  protected onTable(event: PlanPointerEvent<PlanTable>) {
    const table = this.zone()?.tables.find((t) => t.id === event.item.id);
    if (table === undefined) {
      return;
    }
    const state = tableStatusAt(table, this._activeAt(), new Date(this._now()), this._track());
    if (state.occupation !== null) {
      this.focusOn(state.occupation.reservationId);
    } else if (state.status === 'ToClean') {
      const box = this._planArea()?.nativeElement.getBoundingClientRect();
      this.bubble.set({ tableId: table.id, name: table.name, x: event.event.clientX - (box?.left ?? 0), y: event.event.clientY - (box?.top ?? 0) });
    } else {
      // WALK-01 (« Asseoir maintenant ») arrive avec le placement
      this.bubble.set(null);
    }
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
    this.stack.set([]);
    this._reservations.select(null);
    this._reservations.selectClient(null);
  }

  /** Toucher le plan hors d'une table : la bulle et la fiche se ferment */
  protected closeAll() {
    this.bubble.set(null);
    this.close();
  }

  protected onEscape() {
    if (this.bubble() !== null) {
      this.bubble.set(null);
    } else if (this.form() !== null) {
      this.form.set(null);
    } else {
      this.close();
    }
  }

  ngOnDestroy() {
    clearInterval(this._clock);
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
