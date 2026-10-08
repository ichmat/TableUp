import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, output, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ClientDetail, PlanTable, Restaurant, ServiceQuery, ServiceSlot, ServiceSnapshot, TableMark } from '../../models';
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
import { occupation, serviceReservation, serviceSnapshot, serviceTable, serviceZone, utc } from './testing/service-fixtures';

@Component({ selector: 'app-service-header', template: 'HEADER' })
class HeaderStub { snapshot = input.required<ServiceSnapshot>(); timeZone = input.required<string>(); hasServices = input(true); chosen = output<unknown>(); today = output<void>(); create = output<void>(); }
@Component({ selector: 'app-service-timeline', template: 'TIMELINE {{ activeIndex() }}' })
class TimelineStub { slots = input.required<ServiceSlot[]>(); activeIndex = input.required<number>(); tableCount = input.required<number>(); picked = output<number>(); }
@Component({ selector: 'app-zone-tabs', template: 'TABS {{ canEdit() }}' })
class TabsStub { tabs = input.required<unknown[]>(); activeId = input<string | null>(null); canEdit = input(false); selected = output<string>(); }
@Component({ selector: 'app-floor-plan-canvas', template: 'CANVAS' })
class CanvasStub {
  zone = input.required<unknown>(); tables = input<readonly PlanTable[]>([]); decors = input<unknown[]>([]); combinations = input<unknown[]>([]);
  selectedIds = input<readonly string[]>([]); showGrid = input(true); theme = input('light'); tableMarks = input<Record<string, TableMark> | null>(null);
  tablePointerDown = output<unknown>(); backgroundClick = output<unknown>();
}
@Component({ selector: 'app-plan-legend', template: 'LEGEND' })
class LegendStub { trackCleaning = input(false); }
@Component({ selector: 'app-to-place-column', template: 'COLUMN' })
class ColumnStub { toPlace = input.required<unknown[]>(); pending = input.required<unknown[]>(); timeZone = input.required<string>(); opened = output<string>(); }
@Component({ selector: 'app-reservation-sheet', template: 'SHEET {{ placementAvailable() }}' })
class SheetStub { placementAvailable = input(true); origin = input<string | null>(null); closed = output<void>(); back = output<void>(); edit = output<unknown>(); openClient = output<unknown>(); }
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
};

describe('ServiceComponent', () => {
  let fixture: ComponentFixture<ServiceComponent>;
  const params = new BehaviorSubject<ParamMap>(convertToParamMap({}));
  const snapshot = signal<ServiceSnapshot | null>(null);
  const isLoading = signal(false);
  const setQuery = jasmine.createSpy('setQuery');
  const view = { snapshot, failed: signal(false), isLoading, setQuery, clean: jasmine.createSpy('clean'), undoClean: jasmine.createSpy('undoClean') };
  const selectedId = signal<string | null>(null);
  const reservations = {
    selectedId, select: (id: string | null) => selectedId.set(id), selectClient: jasmine.createSpy('selectClient'),
    client: signal<ClientDetail | null>(null), clientFailed: signal(false),
  };
  const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
  const undo = jasmine.createSpyObj<UndoService>('UndoService', ['offer']);
  const modal = jasmine.createSpyObj<ModalService>('ModalService', ['infoModal']);
  const reopened = signal<ReservationFormMode | null>(null);
  const actions = { saved: jasmine.createSpy('saved'), reopened, takeReopened: () => { const mode = reopened(); reopened.set(null); return mode; } };
  const isAdmin = signal(false);
  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  const page = () => fixture.componentInstance as unknown as Page;
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
    setQuery.calls.reset();
    view.clean.calls.reset();
    view.undoClean.calls.reset();
    selectedId.set(null);
    router.navigate.calls.reset();
    router.navigate.and.resolveTo(true);
    undo.offer.calls.reset();
    modal.infoModal.calls.reset();
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

  it('should open the reservation a link points to and jump to its slot', () => {
    params.next(convertToParamMap({ day: '2026-10-10', opening: '19:00', place: 'chen' }));
    load(SNAPSHOT);

    expect(selectedId()).toBe('chen');
    expect(text()).toContain('TIMELINE 4');
    expect(text()).toContain('SHEET false');
    expect(text()).not.toContain('COLUMN');
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

  it('should not act on a snapshot still loading', () => {
    params.next(convertToParamMap({ day: '2026-10-10', opening: '19:00', place: 'chen' }));
    isLoading.set(true);
    load(SNAPSHOT);

    expect(selectedId()).toBeNull();
  });
});
