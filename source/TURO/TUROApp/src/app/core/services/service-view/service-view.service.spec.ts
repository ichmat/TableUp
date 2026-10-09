import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { DataScope } from '../../../models';
import { RealtimeService } from '../realtime/realtime.service';
import { serviceSnapshot } from '../../../features/service-component/testing/service-fixtures';
import { SERVICE_SCOPES, ServiceViewService } from './service-view.service';

describe('ServiceViewService', () => {
  let service: ServiceViewService;
  let http: HttpTestingController;
  const handlers = new Map<DataScope, () => void>();
  const snapshotCall = (): TestRequest => http.expectOne((r) => r.url === '/api/service' && r.method === 'GET');
  const settle = async () => {
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
  };

  beforeEach(() => {
    localStorage.setItem('jwt', 'token');
    handlers.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: RealtimeService, useValue: { onDataChanged: (scope: DataScope, reload: () => void) => { handlers.set(scope, reload); return () => undefined; } } },
      ],
    });
    service = TestBed.inject(ServiceViewService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
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
      handlers.get(scope)!();
      TestBed.tick();
      snapshotCall().flush(serviceSnapshot());
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
});
