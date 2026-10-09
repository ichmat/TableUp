import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, output, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import {
  ApiError, ClientDetail, Placement, PlacementLevel, PlacementReason, PlanTable, ReservationDetail, Restaurant, ServiceQuery, ServiceSlot,
  ServiceSnapshot, TableMark,
} from '../../models';
import { ServiceViewService } from '../../core/services/service-view/service-view.service';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { RestaurantService } from '../../core/services/restaurant/restaurant-service';
import { ClientService } from '../../core/services/client/client.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { UndoService } from '../../core/services/undo/undo.service';
import { ModalService } from '../../core/services/modal/modal.service';
import { ReservationActions } from '../booking-component/reservation-actions';
import { Button } from '../../shared/components/button/button';
import { ReservationFormMode, ReservationSaved } from '../booking-component/reservation-draft';
import { ServiceComponent, TABLE_UNDO_TOO_LATE } from './service-component';
import { PlacementDrag } from './placement-drag';
import { occupation, serviceReservation, serviceSnapshot, serviceTable, serviceZone, utc } from './testing/service-fixtures';

@Component({ selector: 'app-service-header', template: 'HEADER' })
class HeaderStub { snapshot = input.required<ServiceSnapshot>(); timeZone = input.required<string>(); hasServices = input(true); chosen = output<unknown>(); today = output<void>(); create = output<void>(); }
@Component({ selector: 'app-service-timeline', template: 'TIMELINE {{ activeIndex() }}' })
class TimelineStub { slots = input.required<ServiceSlot[]>(); activeIndex = input.required<number>(); tableCount = input.required<number>(); picked = output<number>(); }
@Component({ selector: 'app-zone-tabs', template: 'TABS {{ canEdit() }}' })
class TabsStub { tabs = input.required<unknown[]>(); activeId = input<string | null>(null); canEdit = input(false); levels = input<unknown>(null); selected = output<string>(); }
@Component({ selector: 'app-floor-plan-canvas', template: 'CANVAS' })
class CanvasStub {
  zone = input.required<unknown>(); tables = input<readonly PlanTable[]>([]); decors = input<unknown[]>([]); combinations = input<unknown[]>([]);
  selectedIds = input<readonly string[]>([]); showGrid = input(true); theme = input('light'); tableMarks = input<Record<string, TableMark> | null>(null);
  placementMarks = input<unknown>(null);
  tablePointerDown = output<unknown>(); backgroundClick = output<unknown>(); combinationPointerDown = output<unknown>();
}
@Component({ selector: 'app-plan-legend', template: 'LEGEND' })
class LegendStub { trackCleaning = input(false); }
@Component({ selector: 'app-to-place-column', template: 'COLUMN' })
class ColumnStub {
  toPlace = input.required<unknown[]>(); pending = input.required<unknown[]>(); timeZone = input.required<string>(); opened = output<string>();
  pressed = output<unknown>();
}
@Component({ selector: 'app-reservation-sheet', template: 'SHEET {{ placeHere() }}' })
class SheetStub { placeHere = input(false); placeRequested = output<string>(); origin = input<string | null>(null); closed = output<void>(); back = output<void>(); edit = output<unknown>(); openClient = output<unknown>(); }
@Component({ selector: 'app-client-sheet', template: 'CLIENT' })
class ClientStub {
  client = input<ClientDetail | null>(null); failed = input(false); readOnly = input(false); origin = input<string | null>(null);
  closed = output<void>(); back = output<void>(); openReservation = output<string>(); openInClients = output<void>();
}
@Component({ selector: 'app-reservation-form', template: 'FORM {{ mode().kind }}' })
class FormStub { mode = input.required<ReservationFormMode>(); saved = output<ReservationSaved>(); cancelled = output<void>(); }

type Page = {
  onTable(event: { item: PlanTable, point: { x: number, y: number }, event: PointerEvent }): void,
  pickSlot(index: number): void, focusOn(id: string): void, clean(): Promise<void>, startCreate(): void,
  onEscape(): void, closeAll(): void, form: () => ReservationFormMode | null,
  startPlacing(id: string): Promise<void>, drop(entity: Placement['entities'][number]): Promise<void>,
  entityAt(target: { tableId?: string, combinationId?: string }): Placement['entities'][number] | null,
  placing: () => { reservationId: string, placement: Placement | null } | null,
  drag: PlacementDrag,
};

const PLACEMENT = (levels: Record<string, PlacementLevel>, reasons: PlacementReason[] = []): Placement => ({
  reservationId: 'r-to-place', guestName: 'Moreau', start: '2026-10-10T18:00:00Z', end: '2026-10-10T20:00:00Z', covers: 4, note: null, preferredZoneId: null,
  entities: Object.entries(levels).map(([tableId, level]) => ({
    tableId, combinationId: null, zoneId: 'z1', name: tableId, capacity: 4, level, reasons: level === 'Perfect' ? [] : reasons, next: null,
  })),
});
const DETAIL = (change: Partial<ReservationDetail> = {}) =>
  ({ id: 'r-to-place', status: 'Confirmed', client: { name: 'Moreau' }, place: { name: 't5', capacity: 4 }, events: [], ...change }) as unknown as ReservationDetail;

describe('ServiceComponent', () => {
  let fixture: ComponentFixture<ServiceComponent>;
  const params = new BehaviorSubject<ParamMap>(convertToParamMap({}));
  const snapshot = signal<ServiceSnapshot | null>(null);
  const isLoading = signal(false);
  const setQuery = jasmine.createSpy('setQuery');
  const failed = signal(false);
  const notFound = signal(false);
  const reload = jasmine.createSpy('reload');
  const view = {
    snapshot, failed, notFound, isLoading, setQuery, reload, clean: jasmine.createSpy('clean'), undoClean: jasmine.createSpy('undoClean'),
    placement: jasmine.createSpy('placement'), seat: jasmine.createSpy('seat'),
  };
  const selectedId = signal<string | null>(null);
  const reservations = {
    selectedId, select: (id: string | null) => selectedId.set(id), selectClient: jasmine.createSpy('selectClient'),
    client: signal<ClientDetail | null>(null), clientFailed: signal(false),
  };
  const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
  const undo = jasmine.createSpyObj<UndoService>('UndoService', ['offer']);
  const modal = jasmine.createSpyObj<ModalService>('ModalService', ['infoModal', 'confirmModal']);
  const reopened = signal<ReservationFormMode | null>(null);
  const actions = {
    saved: jasmine.createSpy('saved'), placeOn: jasmine.createSpy('placeOn'), reopened,
    takeReopened: () => { const mode = reopened(); reopened.set(null); return mode; },
  };
  const isAdmin = signal(false);
  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  const element = () => fixture.nativeElement as HTMLElement;
  const button = (label: string) => Array.from(element().querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;
  const page = () => fixture.componentInstance as unknown as Page;
  const canvas = () => fixture.debugElement.query(By.directive(CanvasStub)).componentInstance as CanvasStub;
  const tabs = () => fixture.debugElement.query(By.directive(TabsStub)).componentInstance as TabsStub;
  const sheet = () => fixture.debugElement.query(By.directive(SheetStub)).componentInstance as SheetStub;
  const column = () => fixture.debugElement.query(By.directive(ColumnStub)).componentInstance as ColumnStub;
  /** L'horloge de l'écran avance (elle se relit toutes les 30 s) */
  const clockAt = (time: string) => (fixture.componentInstance as unknown as { _now: { set(value: number): void } })._now.set(Date.parse(utc(time)));
  const tap = (item: PlanTable) => page().onTable({ item, point: { x: 1, y: 1 }, event: new PointerEvent('pointerdown', { clientX: 40, clientY: 50 }) });
  const load = (value: ServiceSnapshot) => {
    snapshot.set(value);
    fixture.detectChanges();
  };

  const reserved = serviceTable({ id: 't1', name: 'T1', occupations: [occupation({ reservationId: 'moreau', start: utc('20:00'), end: utc('22:00') })] });
  const dirty = serviceTable({ id: 't6', name: '6', needsCleaningSince: utc('19:40') });
  const free = serviceTable({ id: 't2', name: 'T2' });
  const SNAPSHOT = serviceSnapshot({
    trackTableCleaning: true,
    zones: [serviceZone({ id: 'z1', tables: [reserved, dirty, free] }), serviceZone({ id: 'z2', name: 'Terrasse', tables: [] })],
    toPlace: [serviceReservation({ id: 'chen', start: utc('21:00') })],
  });

  beforeEach(async () => {
    params.next(convertToParamMap({ day: '2026-10-10', opening: '19:00' }));
    snapshot.set(null);
    isLoading.set(false);
    failed.set(false);
    notFound.set(false);
    reload.calls.reset();
    setQuery.calls.reset();
    view.clean.calls.reset();
    view.undoClean.calls.reset();
    view.placement.calls.reset();
    view.placement.and.resolveTo({ value: PLACEMENT({}), error: null });
    view.seat.calls.reset();
    view.seat.and.resolveTo({ value: null, error: 'non' });
    actions.placeOn.calls.reset();
    modal.confirmModal.calls.reset();
    selectedId.set(null);
    router.navigate.calls.reset();
    router.navigate.and.resolveTo(true);
    undo.offer.calls.reset();
    modal.infoModal.calls.reset();
    modal.infoModal.and.resolveTo();
    reopened.set(null);
    isAdmin.set(false);
    await TestBed.configureTestingModule({
      imports: [ServiceComponent],
      providers: [
        { provide: ServiceViewService, useValue: view },
        { provide: ReservationService, useValue: reservations },
        { provide: RestaurantService, useValue: { model: signal({ timeZone: 'UTC', services: [{ day: 'Saturday' }] } as Restaurant) } },
        { provide: ClientService, useValue: { select: jasmine.createSpy('select') } },
        { provide: AuthService, useValue: { isAdmin } },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
        { provide: UndoService, useValue: undo },
        { provide: ModalService, useValue: modal },
        { provide: ReservationActions, useValue: actions },
      ],
    }).overrideComponent(ServiceComponent, {
      set: { imports: [HeaderStub, TimelineStub, TabsStub, CanvasStub, LegendStub, ColumnStub, SheetStub, ClientStub, FormStub, Button] },
    }).compileComponents();
    // L'horloge de l'écran vit le samedi des fixtures : le créneau en cours se lit à 20:07, quel que soit le jour réel
    spyOn(Date, 'now').and.returnValue(Date.parse(utc('20:07')));
    fixture = TestBed.createComponent(ServiceComponent);
    fixture.detectChanges();
  });

  it('should ask for the service the address names, a reservation link giving its focus', () => {
    expect(setQuery).toHaveBeenCalledWith({ day: '2026-10-10', opening: '19:00', focus: null } as ServiceQuery);

    params.next(convertToParamMap({ day: '2026-10-10', place: 'r1' }));
    fixture.detectChanges();

    expect(setQuery).toHaveBeenCalledWith({ day: '2026-10-10', opening: null, focus: 'r1' });
  });

  it('should write the default service into the address, so a reload keeps it', () => {
    params.next(convertToParamMap({}));
    load(SNAPSHOT);

    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({ day: '2026-10-10', opening: '19:00' }), replaceUrl: true,
    }));
  });

  it('should open a service in progress on the current slot, and move the plan when a slot is touched', () => {
    load(SNAPSHOT);
    expect(text()).toContain('TIMELINE 2');
    setQuery.calls.reset();

    page().pickSlot(5);
    fixture.detectChanges();

    expect(text()).toContain('TIMELINE 5');
    expect(setQuery).not.toHaveBeenCalled();
  });

  it('should open the reservation a link points to, jump to its slot and light the plan to place it', () => {
    params.next(convertToParamMap({ day: '2026-10-10', opening: '19:00', place: 'chen' }));
    load(SNAPSHOT);

    expect(selectedId()).toBe('chen');
    expect(text()).toContain('TIMELINE 4');
    expect(text()).toContain('SHEET true');
    expect(text()).not.toContain('COLUMN');
    expect(view.placement).toHaveBeenCalledOnceWith('chen');
  });

  it('should only open a reservation a « focus » link points to, without placing it', () => {
    params.next(convertToParamMap({ day: '2026-10-10', opening: '19:00', focus: 'chen' }));
    load(SNAPSHOT);

    expect(selectedId()).toBe('chen');
    expect(view.placement).not.toHaveBeenCalled();
  });

  it('should open the reservation of a table, and do nothing on a free one', () => {
    load(SNAPSHOT);
    page().pickSlot(3);

    tap(free);
    fixture.detectChanges();
    expect(selectedId()).toBeNull();
    expect(text()).toContain('COLUMN');

    tap(reserved);
    fixture.detectChanges();
    expect(selectedId()).toBe('moreau');
    expect(text()).toContain('TIMELINE 2');
    expect(text()).toContain('SHEET');
  });

  it('should close the sheet on Escape, the column coming back', () => {
    load(SNAPSHOT);
    page().focusOn('chen');
    fixture.detectChanges();

    page().onEscape();
    fixture.detectChanges();

    expect(selectedId()).toBeNull();
    expect(text()).toContain('COLUMN');
  });

  it('should clean a dirty table from its bubble, and offer to undo it', async () => {
    view.clean.and.resolveTo({ value: { tableId: 't6', since: utc('19:40') }, error: null });
    view.undoClean.and.resolveTo({ value: null, error: null });
    load(SNAPSHOT);

    tap(dirty);
    fixture.detectChanges();
    expect(text()).toContain('Table 6 · à nettoyer');

    await page().clean();
    fixture.detectChanges();

    expect(view.clean).toHaveBeenCalledOnceWith('t6');
    expect(text()).not.toContain('à nettoyer');
    const offer = undo.offer.calls.mostRecent().args[0] as { message: string, run: () => Promise<unknown>, tooLate: string };
    expect(offer.message).toBe('Table 6 nettoyée');
    expect(offer.tooLate).toBe(TABLE_UNDO_TOO_LATE);
    await offer.run();
    expect(view.undoClean).toHaveBeenCalledOnceWith('t6', utc('19:40'));
  });

  it('should explain a refused cleaning', async () => {
    view.clean.and.resolveTo({ value: null, error: 'Table 6 is already clean.' });
    load(SNAPSHOT);
    tap(dirty);

    await page().clean();

    expect(modal.infoModal).toHaveBeenCalledOnceWith('Action impossible', 'Table 6 is already clean.');
    expect(undo.offer).not.toHaveBeenCalled();
  });

  it('should open the creation form over the plan, on the day shown, as a walk-in source', () => {
    load(SNAPSHOT);

    page().startCreate();
    fixture.detectChanges();

    expect(text()).toContain('FORM create');
    expect(page().form()).toEqual({ kind: 'create', draft: { serviceDay: '2026-10-10', source: 'WalkIn' } });
    expect(text()).toContain('COLUMN');
  });

  it('should keep the room chosen when the service reloads, and offer the editor to an administrator', () => {
    isAdmin.set(true);
    load(SNAPSHOT);
    (fixture.componentInstance as unknown as { zoneId: { set(id: string): void } }).zoneId.set('z2');

    load({ ...SNAPSHOT });

    expect((fixture.componentInstance as unknown as { zoneId: () => string }).zoneId()).toBe('z2');
    expect(text()).toContain('TABS true');
  });

  it('should read the current slot at the present instant, a table released a minute ago being free', () => {
    // 20:07 : le créneau courant commence à 20:00, la table a été libérée à 20:06
    const released = serviceTable({ id: 't9', name: 'T9', occupations: [occupation({ reservationId: 'gone', status: 'Finished', lateFrom: null, start: utc('18:00'), end: utc('20:06') })] });
    load(serviceSnapshot({ zones: [serviceZone({ tables: [released] })] }));

    tap(released);
    fixture.detectChanges();
    expect(selectedId()).toBeNull();

    // Un autre créneau se lit à son heure de début
    page().pickSlot(1);
    tap(released);
    expect(selectedId()).toBe('gone');
  });

  it('should follow the clock while the service runs, without a reload', () => {
    load(SNAPSHOT);
    expect(text()).toContain('TIMELINE 2');

    clockAt('20:40');
    fixture.detectChanges();

    expect(text()).toContain('TIMELINE 3');
  });

  it('should reload once a seated table passes its planned end, so it stays taken', () => {
    const seated = serviceTable({ id: 't8', name: 'T8', occupations: [occupation({ reservationId: 'long', status: 'Seated', lateFrom: null, start: utc('18:30'), end: utc('20:30') })] });
    load(serviceSnapshot({ zones: [serviceZone({ tables: [seated] })] }));

    clockAt('20:29');
    fixture.detectChanges();
    expect(reload).not.toHaveBeenCalled();

    clockAt('20:31');
    fixture.detectChanges();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('should say a reload failed rather than show stale tables as current, and keep the address', () => {
    load(SNAPSHOT);
    params.next(convertToParamMap({ day: '2026-10-17', opening: '19:00' }));
    failed.set(true);
    fixture.detectChanges();

    expect(text()).toContain("Le service n'a pas pu être rechargé");
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should drop an opening that no longer exists and fall back to the day', () => {
    load(SNAPSHOT);
    failed.set(true);
    notFound.set(true);
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { opening: null, at: null }, queryParamsHandling: 'merge', replaceUrl: true }));
  });

  it('should not act on a snapshot still loading', () => {
    params.next(convertToParamMap({ day: '2026-10-10', opening: '19:00', place: 'chen' }));
    isLoading.set(true);
    load(SNAPSHOT);

    expect(selectedId()).toBeNull();
  });

  describe('walk-in', () => {
    const FREE_TABLE = serviceTable({ id: 't3', name: '3', capacity: 4 });
    // Libre maintenant (20:07), réservée à 21:07 : pendant les 120 min d'un repas
    const LATER_TABLE = serviceTable({
      id: 't4', name: '4', capacity: 2, occupations: [occupation({ reservationId: 'legrand', guestName: 'Legrand', start: utc('21:07'), end: utc('23:07') })],
    });

    beforeEach(() => {
      load(serviceSnapshot({ zones: [serviceZone({ id: 'z1', tables: [FREE_TABLE, LATER_TABLE] })] }));
    });

    it('should seat a walk-in on a free table, in two gestures', async () => {
      view.seat.and.resolveTo({ value: { reservation: DETAIL({ client: null }), eventId: 'e1' }, error: null });
      tap(FREE_TABLE);
      fixture.detectChanges();
      expect(element().querySelector('[data-seat-bubble]')!.textContent).toContain('Asseoir maintenant');

      (element().querySelector('[data-seat-covers="3"]') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(view.seat).toHaveBeenCalledOnceWith(FREE_TABLE.id, 3, false);
      expect(undo.offer).toHaveBeenCalledWith(jasmine.objectContaining({ message: `Client de passage assis · ${FREE_TABLE.name}` }));
    });

    it('should ask before seating on a table booked later in the meal', async () => {
      tap(LATER_TABLE);
      fixture.detectChanges();
      expect(element().querySelector('[data-seat-bubble]')!.textContent).toContain('Réservée à 21:07 · Legrand · 4 p — 1 h devant vous');
      expect(element().querySelector('[data-seat-covers]')).toBeNull();

      button('Asseoir quand même').click();
      fixture.detectChanges();
      (element().querySelector('[data-seat-covers="2"]') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(view.seat).toHaveBeenCalledOnceWith(LATER_TABLE.id, 2, true);
    });

    it('should ask again when the API says the table is booked later', async () => {
      view.seat.and.resolveTo({ value: null, error: 'Table 3 is booked at 21:00.', code: ApiError.TableBookedLater });
      tap(FREE_TABLE);
      fixture.detectChanges();
      (element().querySelector('[data-seat-covers="2"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(element().querySelector('[data-seat-bubble]')!.textContent).toContain('Asseoir quand même');
    });

    it('should not offer to seat when the service is not in progress', () => {
      snapshot.set({ ...snapshot()!, service: { ...snapshot()!.service!, state: 'Upcoming' } });
      fixture.detectChanges();
      tap(FREE_TABLE);
      fixture.detectChanges();

      expect(element().querySelector('[data-seat-bubble]')).toBeNull();
    });

    it('should close the bubble on Escape', () => {
      tap(FREE_TABLE);
      fixture.detectChanges();

      page().onEscape();
      fixture.detectChanges();

      expect(element().querySelector('[data-seat-bubble]')).toBeNull();
    });
  });

  describe('placement', () => {
    const SEATED_ID = 'r-seated';
    const SEATED_TABLE = serviceTable({
      id: 't8', name: '8', occupations: [occupation({ reservationId: SEATED_ID, status: 'Seated', lateFrom: null, start: utc('19:30'), end: utc('21:30') })],
    });

    beforeEach(() => {
      load(serviceSnapshot({
        zones: [serviceZone({ id: 'z1', tables: [free, SEATED_TABLE] }), serviceZone({ id: 'z2', name: 'Terrasse', tables: [] })],
        toPlace: [serviceReservation({ id: 'r-to-place', start: utc('20:00') })],
        pending: [serviceReservation({ id: 'r-pending', start: utc('20:00') })],
      }));
    });

    it('should light the plan when a reservation to place is opened, and stop on Escape', async () => {
      view.placement.and.resolveTo({ value: PLACEMENT({ t5: 'Perfect', t6: 'Excluded' }), error: null });
      page().focusOn('r-to-place');
      await page().startPlacing('r-to-place');
      fixture.detectChanges();

      expect(canvas().placementMarks()).toEqual({ t5: { level: 'Perfect', next: null }, t6: { level: 'Excluded', next: null } });
      expect(tabs().levels()).toEqual(jasmine.objectContaining({ z1: 'Perfect', z2: null }));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(canvas().placementMarks()).toBeNull();
    });

    it('should place at once on a perfect table, and ask first on a table with a reserve', async () => {
      view.placement.and.resolveTo({ value: PLACEMENT({ t5: 'Perfect', t6: 'WithReserve' }, [{ kind: 'Glued', combination: '6-7', with: ['7'] }]), error: null });
      actions.placeOn.and.resolveTo({ value: { reservation: DETAIL(), eventId: 'e1' }, error: null });
      await page().startPlacing('r-to-place');

      await page().drop(page().entityAt({ tableId: 't5' })!);
      expect(modal.confirmModal).not.toHaveBeenCalled();
      expect(actions.placeOn).toHaveBeenCalledOnceWith('r-to-place', { tableId: 't5' }, false);
      expect(page().placing()).toBeNull();

      actions.placeOn.calls.reset();
      await page().startPlacing('r-to-place');
      modal.confirmModal.and.resolveTo(false);
      await page().drop(page().entityAt({ tableId: 't6' })!);
      expect(modal.confirmModal).toHaveBeenCalledOnceWith('Placer Moreau sur t6 ?', jasmine.stringContaining('Table collée'), 'Placer', 'Annuler');
      expect(actions.placeOn).not.toHaveBeenCalled();
    });

    it('should do nothing on an excluded table', async () => {
      view.placement.and.resolveTo({ value: PLACEMENT({ t5: 'Excluded' }), error: null });
      await page().startPlacing('r-to-place');

      await page().drop(page().entityAt({ tableId: 't5' })!);

      expect(actions.placeOn).not.toHaveBeenCalled();
      expect(page().placing()).not.toBeNull();
    });

    it('should accept a request by dropping it', async () => {
      view.placement.and.resolveTo({ value: { ...PLACEMENT({ t5: 'Perfect' }), reservationId: 'r-pending' }, error: null });
      actions.placeOn.and.resolveTo({ value: { reservation: DETAIL(), eventId: 'e1' }, error: null });
      await page().startPlacing('r-pending');

      await page().drop(page().entityAt({ tableId: 't5' })!);

      expect(actions.placeOn).toHaveBeenCalledOnceWith('r-pending', { tableId: 't5' }, true);
    });

    it('should say a table taken meanwhile and light the plan again', async () => {
      view.placement.and.resolveTo({ value: PLACEMENT({ t5: 'Perfect' }), error: null });
      actions.placeOn.and.resolveTo({ value: null, error: 'Table 5 is no longer free for this reservation.', code: ApiError.PlacementUnavailable });
      await page().startPlacing('r-to-place');

      await page().drop(page().entityAt({ tableId: 't5' })!);

      expect(modal.infoModal).toHaveBeenCalledOnceWith('Table prise', "La table t5 n'est plus libre pour cette réservation.");
      expect(view.placement).toHaveBeenCalledTimes(2);
      expect(page().placing()).not.toBeNull();
    });

    it('should recompute the halos when the service reloads during a placement', async () => {
      view.placement.and.resolveTo({ value: PLACEMENT({ t5: 'Perfect' }), error: null });
      await page().startPlacing('r-to-place');

      snapshot.set({ ...snapshot()! });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(view.placement).toHaveBeenCalledTimes(2);
    });

    it('should start placing when the sheet asks', async () => {
      view.placement.and.resolveTo({ value: PLACEMENT({ t5: 'Perfect' }), error: null });
      page().focusOn('r-to-place');
      fixture.detectChanges();

      sheet().placeRequested.emit('r-to-place');
      await fixture.whenStable();

      expect(view.placement).toHaveBeenCalledOnceWith('r-to-place');
    });

    it('should start placing when a pill is dragged, and drop where it is released', async () => {
      view.placement.and.resolveTo({ value: PLACEMENT({ t5: 'Perfect' }), error: null });
      actions.placeOn.and.resolveTo({ value: { reservation: DETAIL(), eventId: 'e1' }, error: null });
      spyOn(page().drag, 'press').and.callFake((_e, _l, handlers) => { handlers.onStart(); handlers.onDrop({ tableId: 't5' }); });

      column().pressed.emit({ id: 'r-to-place', label: 'Moreau · 4p', event: new PointerEvent('pointerdown') });
      await fixture.whenStable();

      expect(view.placement).toHaveBeenCalledOnceWith('r-to-place');
      expect(actions.placeOn).toHaveBeenCalledOnceWith('r-to-place', { tableId: 't5' }, false);
    });

    it('should wait for the halos when released before they arrive', async () => {
      let answer!: (value: unknown) => void;
      view.placement.and.returnValue(new Promise((resolve) => { answer = resolve; }) as never);
      actions.placeOn.and.resolveTo({ value: { reservation: DETAIL(), eventId: 'e1' }, error: null });
      spyOn(page().drag, 'press').and.callFake((_e, _l, handlers) => { handlers.onStart(); handlers.onDrop({ tableId: 't5' }); });

      column().pressed.emit({ id: 'r-to-place', label: 'Moreau · 4p', event: new PointerEvent('pointerdown') });
      await Promise.resolve();
      expect(actions.placeOn).not.toHaveBeenCalled();
      answer({ value: PLACEMENT({ t5: 'Perfect' }), error: null });
      await fixture.whenStable();

      expect(actions.placeOn).toHaveBeenCalledTimes(1);
    });

    it('should move a seated reservation by dragging its table', async () => {
      view.placement.and.resolveTo({ value: { ...PLACEMENT({ t6: 'Perfect' }), reservationId: SEATED_ID }, error: null });
      actions.placeOn.and.resolveTo({ value: { reservation: DETAIL(), eventId: 'e1' }, error: null });
      spyOn(page().drag, 'press').and.callFake((_e, _l, handlers) => { handlers.onStart(); handlers.onDrop({ tableId: 't6' }); });

      tap(SEATED_TABLE);
      await fixture.whenStable();

      expect(page().drag.press).toHaveBeenCalledWith(jasmine.any(PointerEvent), 'Moreau · 4p', jasmine.any(Object));
      expect(actions.placeOn).toHaveBeenCalledOnceWith(SEATED_ID, { tableId: 't6' }, false);
    });

    it('should drop on the table touched while placing, instead of opening it', async () => {
      view.placement.and.resolveTo({ value: PLACEMENT({ t2: 'Perfect' }), error: null });
      actions.placeOn.and.resolveTo({ value: { reservation: DETAIL(), eventId: 'e1' }, error: null });
      await page().startPlacing('r-to-place');

      tap(free);
      await fixture.whenStable();

      expect(actions.placeOn).toHaveBeenCalledOnceWith('r-to-place', { tableId: 't2' }, false);
    });
  });
});
