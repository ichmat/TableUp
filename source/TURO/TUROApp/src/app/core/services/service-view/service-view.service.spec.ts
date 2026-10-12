import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { CombinationReminder, DataScope } from '../../../models';
import { RealtimeService } from '../realtime/realtime.service';
import { serviceSnapshot } from '../../../features/service-component/testing/service-fixtures';
import { REMINDER_SCOPES, REMINDER_TICK_MS, SERVICE_SCOPES, ServiceViewService } from './service-view.service';

describe('ServiceViewService', () => {
  let service: ServiceViewService;
  let http: HttpTestingController;
  const handlers = new Map<DataScope, (() => void)[]>();
  const fire = (scope: DataScope) => handlers.get(scope)!.forEach((reload) => reload());
  const snapshotCall = (): TestRequest => http.expectOne((r) => r.url === '/api/service' && r.method === 'GET');
  const settle = async () => {
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
  };

  const setup = () => {
    localStorage.setItem('jwt', 'token');
    handlers.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: RealtimeService, useValue: { onDataChanged: (scope: DataScope, reload: () => void) => { handlers.set(scope, [...(handlers.get(scope) ?? []), reload]); return () => undefined; } } },
      ],
    });
    service = TestBed.inject(ServiceViewService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  };

  beforeEach(() => {
    setup();
    http.expectOne('/api/service/reminders').flush([]);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('jwt');
  });

  it('should not ask anything until the screen sets a query', () => {
    http.expectNone('/api/service');
    expect(service.snapshot()).toBeNull();
  });

  it('should ask for the default service, then for a chosen one', async () => {
    service.setQuery({ day: null, opening: null, focus: null });
    TestBed.tick();
    snapshotCall().flush(serviceSnapshot());
    await settle();

    service.setQuery({ day: '2026-10-10', opening: '19:00', focus: 'r1' });
    TestBed.tick();
    const call = snapshotCall();
    expect(call.request.params.get('day')).toBe('2026-10-10');
    expect(call.request.params.get('opening')).toBe('19:00');
    expect(call.request.params.get('focus')).toBe('r1');
    call.flush(serviceSnapshot());
    await settle();
  });

  it('should keep showing the previous snapshot while the next one loads', async () => {
    service.setQuery({ day: null, opening: null, focus: null });
    TestBed.tick();
    snapshotCall().flush(serviceSnapshot({ day: '2026-10-10' }));
    await settle();
    // L'écran lit l'instantané : c'est cette lecture que garde `linkedSignal`
    expect(service.snapshot()?.day).toBe('2026-10-10');

    service.setQuery({ day: '2026-10-17', opening: null, focus: null });
    TestBed.tick();
    expect(service.snapshot()?.day).toBe('2026-10-10');
    snapshotCall().flush(serviceSnapshot({ day: '2026-10-17' }));
    await settle();
    expect(service.snapshot()?.day).toBe('2026-10-17');
  });

  it('should not ask again for the same query', async () => {
    service.setQuery({ day: '2026-10-10', opening: null, focus: null });
    TestBed.tick();
    snapshotCall().flush(serviceSnapshot());
    await settle();

    service.setQuery({ day: '2026-10-10', opening: null, focus: null });
    TestBed.tick();
    http.expectNone('/api/service');
    expect(service.query()).toEqual({ day: '2026-10-10', opening: null, focus: null });
  });

  it('should reload on every scope that changes the screen', async () => {
    expect(SERVICE_SCOPES).toEqual([DataScope.Service, DataScope.Reservations, DataScope.FloorPlan, DataScope.Restaurant, DataScope.Closures]);
    service.setQuery({ day: null, opening: null, focus: null });
    TestBed.tick();
    snapshotCall().flush(serviceSnapshot());
    await settle();

    for (const scope of SERVICE_SCOPES) {
      fire(scope);
      TestBed.tick();
      snapshotCall().flush(serviceSnapshot());
      if (REMINDER_SCOPES.includes(scope)) {
        http.expectOne('/api/service/reminders').flush([]);
      }
      await settle();
    }
  });

  it('should clean a table and undo it, reloading after each', async () => {
    service.setQuery({ day: null, opening: null, focus: null });
    TestBed.tick();
    snapshotCall().flush(serviceSnapshot());
    await settle();

    const cleaned = service.clean('t6');
    const clean = http.expectOne('/api/service/tables/t6/clean');
    expect(clean.request.method).toBe('POST');
    clean.flush({ tableId: 't6', since: '2026-10-10T19:55:00Z' });
    expect(await cleaned).toEqual({ value: { tableId: 't6', since: '2026-10-10T19:55:00Z' }, error: null });
    TestBed.tick();
    snapshotCall().flush(serviceSnapshot());
    await settle();

    const undone = service.undoClean('t6', '2026-10-10T19:55:00Z');
    const undo = http.expectOne('/api/service/tables/t6/clean/undo');
    expect(undo.request.body).toEqual({ since: '2026-10-10T19:55:00Z' });
    undo.flush(null, { status: 204, statusText: 'No Content' });
    expect((await undone).error).toBeNull();
    TestBed.tick();
    snapshotCall().flush(serviceSnapshot());
    await settle();
  });

  it('should ask the API for the halos, and seat a walk-in then reload', async () => {
    service.setQuery({ day: null, opening: null, focus: null });
    TestBed.tick();
    snapshotCall().flush(serviceSnapshot());
    await settle();

    const placement = service.placement('r1');
    http.expectOne((r) => r.url === '/api/service/placement/r1' && r.method === 'GET').flush({ reservationId: 'r1', entities: [] });
    expect((await placement).value?.reservationId).toBe('r1');

    const seated = service.seat('t5', 3, true);
    const seat = http.expectOne('/api/service/tables/t5/seat');
    expect(seat.request.method).toBe('POST');
    expect(seat.request.body).toEqual({ covers: 3, acceptBookedLater: true });
    seat.flush({ reservation: { id: 'w1' }, eventId: 'e1' }, { status: 201, statusText: 'Created' });
    expect((await seated).value?.eventId).toBe('e1');
    TestBed.tick();
    snapshotCall().flush(serviceSnapshot());
    await settle();
  });

  it('should tell a reload failed, and whether the service asked no longer exists, keeping the last snapshot', async () => {
    service.setQuery({ day: '2026-10-10', opening: '19:00', focus: null });
    TestBed.tick();
    snapshotCall().flush(serviceSnapshot());
    await settle();
    expect(service.snapshot()).not.toBeNull();

    service.reload();
    TestBed.tick();
    snapshotCall().flush({ statusCode: 404, message: 'No service opens at 19:00.', error: 'NotFound' }, { status: 404, statusText: 'Not Found' });
    await settle();

    expect(service.failed()).toBeTrue();
    expect(service.notFound()).toBeTrue();
    expect(service.snapshot()).not.toBeNull();
  });

  it('should read the calendar, peek at a day, and fetch the default service for the landing', async () => {
    const calendar = service.calendar('2026-10');
    http.expectOne((r) => r.url === '/api/service/calendar' && r.params.get('month') === '2026-10').flush(['2026-10-10']);
    expect((await calendar).value).toEqual(['2026-10-10']);

    const peek = service.peek('2026-10-17');
    http.expectOne((r) => r.url === '/api/service' && r.params.get('day') === '2026-10-17').flush(serviceSnapshot({ day: '2026-10-17' }));
    expect((await peek).value?.day).toBe('2026-10-17');

    const current = service.current();
    http.expectOne((r) => r.url === '/api/service' && r.params.keys().length === 0).flush(serviceSnapshot());
    expect((await current).value?.service?.state).toBe('InProgress');
  });

  const REMINDER = (dueAt: string): CombinationReminder => ({
    combinationId: 'c1', name: '12-13', kind: 'Approach', dueAt, tableIds: ['t12', 't13'], tableNames: ['12', '13'],
    reservation: { id: 'r1', start: dueAt, guestName: 'Nguyen', covers: 8 }, separates: [],
  });

  it('should show a reminder once its time has come, without asking again', async () => {
    // L'horloge du service naît au constructeur : le service est recréé sous l'horloge simulée
    http.verify();
    TestBed.resetTestingModule();
    jasmine.clock().install();
    try {
      const now = Date.now();
      jasmine.clock().mockDate(new Date(now));
      setup();
      http.expectOne('/api/service/reminders').flush([REMINDER(new Date(now - 1000).toISOString()), REMINDER(new Date(now + 20_000).toISOString())]);
      await settle();
      expect(service.reminders().length).toBe(2);
      expect(service.dueReminders().length).toBe(1);

      jasmine.clock().tick(REMINDER_TICK_MS);
      expect(service.dueReminders().length).toBe(2);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('should show at once a reminder already due when the list arrives', async () => {
    http.verify();
    TestBed.resetTestingModule();
    jasmine.clock().install();
    try {
      const start = Date.now();
      jasmine.clock().mockDate(new Date(start));
      setup();
      const read = http.expectOne('/api/service/reminders');
      // La réponse arrive quelques secondes après la construction, sans que l'horloge du service ait battu
      jasmine.clock().mockDate(new Date(start + 5000));
      read.flush([REMINDER(new Date(Date.now() - 1000).toISOString())]);
      await settle();
      expect(service.dueReminders().length).toBe(1);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('should reload the reminders on the floor plan and the reservations', async () => {
    for (const scope of REMINDER_SCOPES) {
      await settle();
      fire(scope);
      TestBed.tick();
      const call = http.expectOne('/api/service/reminders');
      expect(call.request.method).toBe('GET');
      call.flush([]);
    }
  });

  it('should answer a reminder, then reload what it changed', async () => {
    const answered = service.answerReminder('c1', 'Approach', 'Done');
    const call = http.expectOne('/api/service/combinations/c1/reminder');
    expect(call.request.body).toEqual({ kind: 'Approach', answer: 'Done' });
    call.flush({ undoId: 'u1' });

    expect((await answered).value).toEqual({ undoId: 'u1' });
    TestBed.tick();
    http.expectOne('/api/service/reminders').flush([]);
  });

  it('should post a layout and undo it', async () => {
    const laid = service.layout({ moves: [{ tableId: 't1', x: 2, y: 3 }] });
    http.expectOne((r) => r.url === '/api/service/layout' && r.method === 'POST').flush({ undoId: 'u2' });
    expect((await laid).value).toEqual({ undoId: 'u2' });
    TestBed.tick();
    http.expectOne('/api/service/reminders').flush([]);

    const undone = service.undo('u2');
    http.expectOne((r) => r.url === '/api/service/undo/u2' && r.method === 'POST').flush(null);
    expect((await undone).error).toBeNull();
    TestBed.tick();
    http.expectOne('/api/service/reminders').flush([]);
  });
});
