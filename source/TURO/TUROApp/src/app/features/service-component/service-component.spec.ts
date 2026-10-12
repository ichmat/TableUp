import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, output, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import {
  ApiError, ClientDetail, CombinationReminder, FloorPlanZone, Placement, PlacementApproach, PlacementLevel, PlacementReason, PlanTable, ReservationDetail, Restaurant, ServiceQuery, ServiceSlot,
  ServiceSnapshot, TableMark,
} from '../../models';
import { ServiceViewService } from '../../core/services/service-view/service-view.service';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { RestaurantService } from '../../core/services/restaurant/restaurant-service';
import { ClientService } from '../../core/services/client/client.service';
import { UndoService } from '../../core/services/undo/undo.service';
import { ModalService } from '../../core/services/modal/modal.service';
import { FloorPlanService } from '../../core/services/floor-plan/floor-plan.service';
import { ReservationActions } from '../booking-component/reservation-actions';
import { Button } from '../../shared/components/button/button';
import { ReservationFormMode, ReservationSaved } from '../booking-component/reservation-draft';
import { PLAN_UNDO_TOO_LATE, ServiceComponent, TABLE_UNDO_TOO_LATE } from './service-component';
import { PlacementDrag } from './placement-drag';
import { LayoutDrop, LayoutEdit } from './layout-edit';
import { occupation, serviceReservation, serviceSnapshot, serviceTable, serviceZone, utc } from './testing/service-fixtures';

@Component({ selector: 'app-service-header', template: 'HEADER' })
class HeaderStub { snapshot = input.required<ServiceSnapshot>(); timeZone = input.required<string>(); hasServices = input(true); chosen = output<unknown>(); today = output<void>(); create = output<void>(); }
@Component({ selector: 'app-service-timeline', template: 'TIMELINE {{ activeIndex() }}' })
class TimelineStub { slots = input.required<ServiceSlot[]>(); activeIndex = input.required<number>(); tableCount = input.required<number>(); picked = output<number>(); }
@Component({ selector: 'app-zone-tabs', template: 'TABS {{ editing() }}' })
class TabsStub {
  tabs = input.required<unknown[]>(); activeId = input<string | null>(null); editing = input(false); levels = input<unknown>(null);
  selected = output<string>(); editToggle = output<void>();
}
@Component({ selector: 'app-floor-plan-canvas', template: 'CANVAS' })
class CanvasStub {
  zone = input.required<unknown>(); tables = input<readonly PlanTable[]>([]); decors = input<unknown[]>([]); combinations = input<unknown[]>([]);
  selectedIds = input<readonly string[]>([]); showGrid = input(true); theme = input('light'); tableMarks = input<Record<string, TableMark> | null>(null);
  placementMarks = input<unknown>(null);
  approachLine = input<unknown>(null);
  contactIds = input<unknown>([]);
  toMetres(x: number, y: number) { return { x: x / 100, y: y / 100 }; }
  tablePointerDown = output<unknown>(); backgroundClick = output<unknown>(); combinationPointerDown = output<unknown>();
}
@Component({ selector: 'app-plan-legend', template: 'LEGEND' })
class LegendStub { trackCleaning = input(false); }
@Component({ selector: 'app-combination-reminders', template: 'REMINDERS' })
class RemindersStub { reminders = input.required<unknown[]>(); timeZone = input.required<string>(); answered = output<unknown>(); }
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
@Component({ selector: 'app-approach-list', template: 'APPROACHES' })
class ApproachListStub {
  approaches = input.required<unknown[]>(); selectedKey = input<string | null>(null); timeZone = input.required<string>();
  selected = output<PlacementApproach>(); placed = output<PlacementApproach>();
}
@Component({ selector: 'app-approach-dialog', template: 'APPROACH DIALOG' })
class ApproachDialogStub {
  approach = input.required<unknown>(); guest = input.required<string>(); covers = input.required<number>(); message = input.required<string>();
  tables = input.required<unknown[]>(); combinations = input.required<unknown[]>();
  confirmed = output<{ name: string, capacity: number }>(); cancelled = output<void>();
}
@Component({ selector: 'app-accolage-dialog-component', template: 'ACCOLAGE' })
class AccolageStub {
  members = input.required<unknown[]>(); existing = input<unknown>(null); deactivated = input<unknown[]>([]);
  tables = input.required<unknown[]>(); combinations = input.required<unknown[]>();
  create = output<{ name: string, capacity: number }>(); reactivate = output<void>(); dismiss = output<void>();
}
@Component({ selector: 'app-separation-dialog-component', template: 'SEPARATION' })
class SeparationStub { combination = input.required<unknown>(); reactivated = input<unknown>(null); separate = output<void>(); dismiss = output<void>(); }
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
  reservationId: 'r-to-place', guestName: 'Moreau', start: '2026-10-10T18:00:00Z', end: '2026-10-10T20:00:00Z', covers: 4, note: null, preferredZoneId: null, approaches: [],
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
    dueReminders: signal<CombinationReminder[]>([]), answerReminder: jasmine.createSpy('answerReminder'), undo: jasmine.createSpy('undo'),
    reloadReminders: jasmine.createSpy('reloadReminders'), layout: jasmine.createSpy('layout'),
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
    view.dueReminders.set([]);
    view.answerReminder.calls.reset();
    view.undo.calls.reset();
    view.reloadReminders.calls.reset();
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
    view.layout.calls.reset();
    await TestBed.configureTestingModule({
      imports: [ServiceComponent],
      providers: [
        { provide: ServiceViewService, useValue: view },
        { provide: ReservationService, useValue: reservations },
        { provide: RestaurantService, useValue: { model: signal({ timeZone: 'UTC', services: [{ day: 'Saturday' }] } as Restaurant) } },
        { provide: ClientService, useValue: { select: jasmine.createSpy('select') } },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
        { provide: UndoService, useValue: undo },
        { provide: ModalService, useValue: modal },
        { provide: ReservationActions, useValue: actions },
        { provide: FloorPlanService, useValue: { zones: signal<FloorPlanZone[]>([]) } },
      ],
    }).overrideComponent(ServiceComponent, {
      set: { imports: [HeaderStub, TimelineStub, TabsStub, CanvasStub, LegendStub, RemindersStub, ColumnStub, SheetStub, ClientStub, FormStub, ApproachListStub, ApproachDialogStub, AccolageStub, SeparationStub, Button] },
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

  it('should keep the room chosen when the service reloads', () => {
    load(SNAPSHOT);
    (fixture.componentInstance as unknown as { zoneId: { set(id: string): void } }).zoneId.set('z2');

    load({ ...SNAPSHOT });

    expect((fixture.componentInstance as unknown as { zoneId: () => string }).zoneId()).toBe('z2');
  });

  describe('edit mode', () => {
    type Editing = { editing: () => boolean, layoutEdit: LayoutEdit, onLayoutDrop(drop: LayoutDrop): Promise<void> };
    const editor = () => fixture.componentInstance as unknown as Editing;
    const enterEditing = () => { tabs().editToggle.emit(); fixture.detectChanges(); };

    it('should enter and leave the edit mode, closing the sheet', () => {
      load(SNAPSHOT);
      page().focusOn('moreau');
      fixture.detectChanges();

      enterEditing();
      expect(editor().editing()).toBeTrue();
      expect(text()).toContain('TABS true');
      expect(text()).not.toContain('SHEET');

      page().onEscape();
      fixture.detectChanges();
      expect(editor().editing()).toBeFalse();
    });

    it('should neither open a sheet nor place while editing', async () => {
      load(SNAPSHOT);
      enterEditing();

      tap(reserved);
      await page().startPlacing('chen');

      expect(selectedId()).toBeNull();
      expect(page().placing()).toBeNull();
    });

    it('should send a plain move, then offer to undo it', async () => {
      load(SNAPSHOT);
      enterEditing();
      view.layout.and.resolveTo({ value: { undoId: 'u1' }, error: null });

      await editor().onLayoutDrop({ moves: [{ tableId: 't1', x: 3, y: 1 }], accolage: null, separation: null });

      expect(view.layout).toHaveBeenCalledWith({ moves: [{ tableId: 't1', x: 3, y: 1 }] });
      expect(undo.offer).toHaveBeenCalledWith(jasmine.objectContaining({ message: 'Table T1 déplacée', tooLate: PLAN_UNDO_TOO_LATE }));
    });

    it('should ask before gluing, and glue a new pair with its name', async () => {
      load(SNAPSHOT);
      enterEditing();
      view.layout.and.resolveTo({ value: { undoId: 'u2' }, error: null });
      const moves = [{ tableId: 't1', x: 2.2, y: 1 }];

      await editor().onLayoutDrop({ moves, accolage: { tableIds: ['t1', 't2'], existingId: null, deactivatedIds: [] }, separation: null });
      fixture.detectChanges();
      (fixture.debugElement.query(By.directive(AccolageStub)).componentInstance as AccolageStub).create.emit({ name: '1-2', capacity: 8 });
      await fixture.whenStable();

      expect(view.layout).toHaveBeenCalledWith({ moves, glue: { tableIds: ['t1', 't2'], name: '1-2', capacity: 8 } });
    });

    it('should only move when the gluing is declined', async () => {
      load(SNAPSHOT);
      enterEditing();
      view.layout.and.resolveTo({ value: { undoId: 'u3' }, error: null });
      const moves = [{ tableId: 't1', x: 2.2, y: 1 }];

      await editor().onLayoutDrop({ moves, accolage: { tableIds: ['t1', 't2'], existingId: null, deactivatedIds: [] }, separation: null });
      fixture.detectChanges();
      (fixture.debugElement.query(By.directive(AccolageStub)).componentInstance as AccolageStub).dismiss.emit();
      await fixture.whenStable();

      expect(view.layout).toHaveBeenCalledWith({ moves });
    });

    it('should keep the preview while a question is pending, and drop it once the plan is read again after the answer', async () => {
      load(SNAPSHOT);
      enterEditing();
      view.layout.and.resolveTo({ value: { undoId: 'u4' }, error: null });
      const moves = [{ tableId: 't1', x: 2.2, y: 1 }];
      editor().layoutEdit.preview.set(new Map([['t1', { x: 2.2, y: 1 }]]));

      await editor().onLayoutDrop({ moves, accolage: { tableIds: ['t1', 't2'], existingId: null, deactivatedIds: [] }, separation: null });
      load({ ...SNAPSHOT });
      expect(editor().layoutEdit.preview()).not.toBeNull();

      fixture.detectChanges();
      (fixture.debugElement.query(By.directive(AccolageStub)).componentInstance as AccolageStub).dismiss.emit();
      await fixture.whenStable();
      load({ ...SNAPSHOT });
      expect(editor().layoutEdit.preview()).toBeNull();
    });

    it('should send the plain move when the question lost its tables, rather than stay stuck', async () => {
      load(SNAPSHOT);
      enterEditing();
      view.layout.and.resolveTo({ value: { undoId: 'u5' }, error: null });
      const moves = [{ tableId: 't1', x: 2.2, y: 1 }];

      await editor().onLayoutDrop({ moves, accolage: { tableIds: ['t1', 'gone'], existingId: null, deactivatedIds: [] }, separation: null });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(view.layout).toHaveBeenCalledWith({ moves });
      expect(fixture.debugElement.query(By.directive(AccolageStub))).toBeNull();
    });

    it('should say why a move failed and put the table back', async () => {
      load(SNAPSHOT);
      enterEditing();
      view.layout.and.resolveTo({ value: null, error: 'hors salle', code: ApiError.InvalidModification });
      editor().layoutEdit.preview.set(new Map([['t1', { x: 9, y: 1 }]]));

      await editor().onLayoutDrop({ moves: [{ tableId: 't1', x: 9, y: 1 }], accolage: null, separation: null });

      expect(modal.infoModal).toHaveBeenCalledWith('Modification impossible', 'hors salle');
      expect(editor().layoutEdit.preview()).toBeNull();
    });
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

  describe('approaches', () => {
    const PAIR: PlacementApproach = {
      combinationId: null, tableIds: ['t1', 't2'], zoneId: 'z1', name: 'T1-T2', capacity: 8, level: 'WithReserve',
      reasons: [{ kind: 'Approach', with: ['T1', 'T2'] }], next: null, distance: 1.5,
    };
    const DORMANT: PlacementApproach = { ...PAIR, combinationId: 'c9', name: 'Banquette' };
    const approachList = () => fixture.debugElement.query(By.directive(ApproachListStub))?.componentInstance as ApproachListStub | undefined;
    const approachDialog = () => fixture.debugElement.query(By.directive(ApproachDialogStub))?.componentInstance as ApproachDialogStub | undefined;

    it('should list the approaches under the sheet and light up the chosen one', async () => {
      load(SNAPSHOT);
      view.placement.and.resolveTo({ value: { ...PLACEMENT({ t1: 'Excluded' }), approaches: [PAIR] }, error: null });
      await page().startPlacing('chen');
      fixture.detectChanges();

      approachList()!.selected.emit(PAIR);
      fixture.detectChanges();

      expect(canvas().approachLine()).toEqual(['t1', 't2']);
      expect((canvas().placementMarks() as Record<string, { level: string }>)['t1'].level).toBe('WithReserve');
    });

    it('should place on a dormant combination after its reasons, saying it waits to be pushed together', async () => {
      load(SNAPSHOT);
      view.placement.and.resolveTo({ value: { ...PLACEMENT({}), approaches: [DORMANT] }, error: null });
      modal.confirmModal.and.resolveTo(true);
      actions.placeOn.and.resolveTo({ value: {}, error: null });
      await page().startPlacing('chen');
      fixture.detectChanges();

      approachList()!.placed.emit(DORMANT);
      await fixture.whenStable();

      expect(modal.confirmModal).toHaveBeenCalledWith('Placer Moreau sur Banquette ?', jasmine.stringContaining('Rapprochement nécessaire'), 'Placer', 'Annuler');
      expect(actions.placeOn).toHaveBeenCalledWith('chen', { combinationId: 'c9' }, false, ' (à rapprocher)');
    });

    it('should ask the name of a new pair, then create it by placing', async () => {
      load(SNAPSHOT);
      view.placement.and.resolveTo({ value: { ...PLACEMENT({}), approaches: [PAIR] }, error: null });
      actions.placeOn.and.resolveTo({ value: {}, error: null });
      await page().startPlacing('chen');
      fixture.detectChanges();

      approachList()!.placed.emit(PAIR);
      fixture.detectChanges();
      expect(approachDialog()!.covers()).toBe(4);
      approachDialog()!.confirmed.emit({ name: 'Grande', capacity: 7 });
      await fixture.whenStable();

      expect(actions.placeOn).toHaveBeenCalledWith('chen', { newCombination: { tableIds: ['t1', 't2'], name: 'Grande', capacity: 7 } }, false, ' (à rapprocher)');
    });
  });

  describe('approaches, lifecycle', () => {
    const PAIR: PlacementApproach = {
      combinationId: null, tableIds: ['t1', 't2'], zoneId: 'z1', name: 'T1-T2', capacity: 8, level: 'WithReserve',
      reasons: [{ kind: 'Approach', with: ['T1', 'T2'] }], next: null, distance: 1.5,
    };
    const DORMANT: PlacementApproach = { ...PAIR, combinationId: 'c9', name: 'Banquette' };
    const approachList = () => fixture.debugElement.query(By.directive(ApproachListStub))?.componentInstance as ApproachListStub | undefined;
    const startWith = async (approaches: PlacementApproach[]) => {
      load(SNAPSHOT);
      view.placement.and.resolveTo({ value: { ...PLACEMENT({}), approaches }, error: null });
      await page().startPlacing('chen');
      fixture.detectChanges();
    };

    it('should forget the chosen approach when another reservation is placed', async () => {
      await startWith([PAIR]);
      approachList()!.selected.emit(PAIR);
      fixture.detectChanges();
      expect(canvas().approachLine()).toEqual(['t1', 't2']);

      await page().startPlacing('other');
      fixture.detectChanges();

      expect(canvas().approachLine()).toBeNull();
    });

    it('should forget the chosen approach the reloaded placement no longer offers', async () => {
      await startWith([PAIR]);
      approachList()!.selected.emit(PAIR);
      view.placement.and.resolveTo({ value: { ...PLACEMENT({}), approaches: [] }, error: null });
      snapshot.set({ ...SNAPSHOT });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(canvas().approachLine()).toBeNull();
    });

    it('should drop the approach when the selected line is touched again', async () => {
      await startWith([DORMANT]);
      modal.confirmModal.and.resolveTo(true);
      actions.placeOn.and.resolveTo({ value: {}, error: null });

      approachList()!.selected.emit(DORMANT);
      approachList()!.selected.emit(DORMANT);
      await fixture.whenStable();

      expect(actions.placeOn).toHaveBeenCalledWith('chen', { combinationId: 'c9' }, false, ' (à rapprocher)');
    });

    it('should switch to the zone of the chosen approach', async () => {
      await startWith([{ ...PAIR, zoneId: 'z2' }]);

      approachList()!.selected.emit({ ...PAIR, zoneId: 'z2' });
      fixture.detectChanges();

      expect(tabs().activeId()).toBe('z2');
    });

    it('should say the tables are taken and reload the placement when the API refuses', async () => {
      await startWith([DORMANT]);
      modal.confirmModal.and.resolveTo(true);
      actions.placeOn.and.resolveTo({ value: null, error: 'prise', code: ApiError.PlacementUnavailable });
      view.placement.calls.reset();

      approachList()!.placed.emit(DORMANT);
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));

      expect(modal.infoModal).toHaveBeenCalledWith('Tables prises', 'Banquette n\'est plus libre pour cette réservation.');
      expect(view.placement).toHaveBeenCalledTimes(1);
      expect(page().placing()).not.toBeNull();
    });

    it('should open a single confirmation for two quick taps on Placer', async () => {
      await startWith([DORMANT]);
      modal.confirmModal.and.returnValue(new Promise<boolean>(() => undefined));

      approachList()!.placed.emit(DORMANT);
      approachList()!.placed.emit(DORMANT);

      expect(modal.confirmModal).toHaveBeenCalledTimes(1);
    });
  });

  describe('reminders', () => {
    const REMINDER: CombinationReminder = {
      combinationId: 'c1', name: '12-13', kind: 'Approach', dueAt: utc('20:00'), tableIds: ['t1'], tableNames: ['T1', 'T2'],
      reservation: { id: 'r1', start: utc('20:00'), guestName: 'Nguyen', covers: 8, status: 'Confirmed', serviceDay: '2026-10-10', claimedTable: null }, separates: [],
    };
    const reminders = () => fixture.debugElement.query(By.directive(RemindersStub))?.componentInstance as RemindersStub | undefined;

    it('should show the due reminders over the plan and flag their tables', () => {
      load(SNAPSHOT);
      expect(reminders()).toBeUndefined();

      view.dueReminders.set([REMINDER]);
      fixture.detectChanges();

      expect(reminders()!.reminders()).toEqual([REMINDER]);
      expect(canvas().tableMarks()!['t1'].reminder).toBeTrue();
    });

    it('should answer, then offer to undo', async () => {
      load(SNAPSHOT);
      view.dueReminders.set([REMINDER]);
      fixture.detectChanges();
      view.answerReminder.and.resolveTo({ value: { undoId: 'u1' }, error: null });

      reminders()!.answered.emit({ reminder: REMINDER, answer: 'Done' });
      await fixture.whenStable();

      expect(view.answerReminder).toHaveBeenCalledWith('c1', 'Approach', 'Done');
      expect(undo.offer).toHaveBeenCalledWith(jasmine.objectContaining({ message: '12-13 collée', tooLate: PLAN_UNDO_TOO_LATE }));
    });

    it('should reload silently when the reminder changed on another tablet', async () => {
      load(SNAPSHOT);
      view.dueReminders.set([REMINDER]);
      fixture.detectChanges();
      view.answerReminder.and.resolveTo({ value: null, error: 'changé', code: ApiError.ReminderChanged });

      reminders()!.answered.emit({ reminder: REMINDER, answer: 'Done' });
      await fixture.whenStable();

      expect(modal.infoModal).not.toHaveBeenCalled();
      expect(view.reloadReminders).toHaveBeenCalled();
    });
  });
});
