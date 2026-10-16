import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { ApiError, DataScope, ReservationDetail, ReservationPage, ReservationRequest } from '../../../models';
import { RealtimeService } from '../realtime/realtime.service';
import { ReservationService } from './reservation.service';

const PAGE: ReservationPage = { days: [], hasMore: false, pending: { count: 0, oldestCreatedAt: null } };
const DETAIL: ReservationDetail = {
  id: 'r1', start: '2026-10-10T18:00:00Z', serviceDay: '2026-10-10', covers: 4, duration: 105, status: 'Confirmed', source: 'Phone',
  note: null, preferredZoneId: null, preferredZoneName: null, createdAt: '2026-10-07T10:00:00Z', cancelledBy: null, version: 7,
  place: null, placeTooSmall: false, noShowFrom: '2026-10-10T18:15:00Z', client: null, events: [],
};
const REQUEST: ReservationRequest = {
  serviceDay: '2026-10-10', time: '20:00:00', covers: 4, duration: null, note: null, preferredZoneId: null, source: 'Phone',
  phone: '0612345678', name: 'Sophie', email: null, version: null,
};

describe('ReservationService', () => {
  let service: ReservationService;
  let http: HttpTestingController;
  const handlers = new Map<DataScope, () => void>();

  const listCall = (): TestRequest => http.expectOne((r) => r.url === '/api/reservations' && r.method === 'GET');
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
    service = TestBed.inject(ReservationService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });

  afterEach(() => localStorage.removeItem('jwt'));

  it('should ask for fourteen upcoming days without filters', () => {
    const call = listCall();

    expect(call.request.params.get('period')).toBe('Upcoming');
    expect(call.request.params.get('days')).toBe('14');
    expect(call.request.params.keys().sort()).toEqual(['days', 'period']);
  });

  it('should add fourteen days on show more, and go back to fourteen when a filter changes', async () => {
    listCall().flush(PAGE);
    await settle();

    service.showMore();
    TestBed.tick();
    const more = listCall();
    expect(more.request.params.get('days')).toBe('28');
    more.flush(PAGE);
    await settle();

    service.setQuery({ period: 'Past', status: 'NoShow', source: 'WalkIn', zoneId: 'z1', search: ' 06 12 ' });
    TestBed.tick();
    const call = listCall();
    expect(call.request.params.get('days')).toBe('14');
    expect(call.request.params.get('period')).toBe('Past');
    expect(call.request.params.get('status')).toBe('NoShow');
    expect(call.request.params.get('source')).toBe('WalkIn');
    expect(call.request.params.get('zoneId')).toBe('z1');
    expect(call.request.params.get('search')).toBe('06 12');
  });

  it('should keep the previous page while the next one loads', async () => {
    listCall().flush({ ...PAGE, hasMore: true });
    await settle();
    expect(service.page()?.hasMore).toBeTrue();

    service.setQuery({ period: 'Today' });
    TestBed.tick();

    expect(service.page()?.hasMore).toBeTrue();
    listCall().flush(PAGE);
    await settle();
    expect(service.page()?.hasMore).toBeFalse();
  });

  it('should load the open sheet and reload it with the list on a reservations or clients notification', async () => {
    listCall().flush(PAGE);
    service.select('r1');
    TestBed.tick();
    http.expectOne('/api/reservations/r1').flush(DETAIL);
    await settle();
    expect(service.detail()?.covers).toBe(4);

    handlers.get(DataScope.Reservations)!();
    TestBed.tick();
    listCall().flush(PAGE);
    http.expectOne('/api/reservations/r1').flush({ ...DETAIL, covers: 6 });
    await settle();
    expect(service.detail()?.covers).toBe(6);

    // Les compteurs du client vivent sur la fiche réservation
    handlers.get(DataScope.Clients)!();
    TestBed.tick();
    http.expectOne('/api/reservations/r1').flush(DETAIL);
  });

  it('should load a client sheet without touching the clients screen selection', async () => {
    listCall().flush(PAGE);
    service.selectClient('c1');
    TestBed.tick();

    http.expectOne('/api/clients/c1').flush({ id: 'c1', name: 'Sophie' });
    await settle();
    expect(service.client()?.name).toBe('Sophie');
  });

  it('should post a gesture and show its answer in the open sheet at once', async () => {
    listCall().flush(PAGE);
    service.select('r1');
    TestBed.tick();
    http.expectOne('/api/reservations/r1').flush(DETAIL);
    await settle();

    const result = service.act('r1', 'no-show');
    http.expectOne((r) => r.url === '/api/reservations/r1/no-show' && r.method === 'POST')
      .flush({ reservation: { ...DETAIL, status: 'NoShow' }, eventId: 'e1' });

    expect((await result).value?.eventId).toBe('e1');
    expect(service.detail()?.status).toBe('NoShow');
    TestBed.tick();
    listCall().flush(PAGE);
  });

  it('should say who cancels', async () => {
    listCall().flush(PAGE);
    const result = service.cancel('r1', 'Restaurant');

    const call = http.expectOne((r) => r.url === '/api/reservations/r1/cancel');
    expect(call.request.body).toEqual({ by: 'Restaurant' });
    call.flush({ reservation: { ...DETAIL, status: 'Cancelled' }, eventId: 'e2' });
    expect((await result).value?.eventId).toBe('e2');
  });

  it('should place on a table or a combination', async () => {
    listCall().flush(PAGE);
    const result = service.place('r1', { tableId: 't5' });

    const call = http.expectOne((r) => r.url === '/api/reservations/r1/place' && r.method === 'POST');
    expect(call.request.body).toEqual({ tableId: 't5' });
    call.flush({ reservation: { ...DETAIL, place: { name: '5', capacity: 4 } }, eventId: 'e3' });
    expect((await result).value?.eventId).toBe('e3');
  });

  it('should create and update with the request as is', async () => {
    listCall().flush(PAGE);
    const created = service.create(REQUEST);
    const post = http.expectOne((r) => r.url === '/api/reservations' && r.method === 'POST');
    expect(post.request.body).toEqual(REQUEST);
    post.flush({ reservation: DETAIL, eventId: 'e3' }, { status: 201, statusText: 'Created' });
    expect((await created).value?.reservation.id).toBe('r1');

    const updated = service.update('r1', { ...REQUEST, version: 7 });
    http.expectOne((r) => r.url === '/api/reservations/r1' && r.method === 'PUT').flush({ reservation: DETAIL, eventId: null });
    expect((await updated).value?.eventId).toBeNull();
  });

  it('should give back the API code when an undo comes too late', async () => {
    listCall().flush(PAGE);
    const result = service.undo('r1', 'e1');
    http.expectOne((r) => r.url === '/api/reservations/r1/undo/e1' && r.method === 'POST').flush(
      { statusCode: 409, message: 'This action can no longer be undone.', error: 'UndoExpired' },
      { status: 409, statusText: 'Conflict' });

    const outcome = await result;
    expect(outcome.error === null ? null : outcome.code).toBe(ApiError.UndoExpired);
  });

  it('should read the slots of a day', async () => {
    listCall().flush(PAGE);
    const result = service.slots('2026-10-10');
    const call = http.expectOne((r) => r.url === '/api/reservations/slots');
    expect(call.request.params.get('day')).toBe('2026-10-10');
    call.flush([{ opening: '19:00:00', closing: '23:00:00', slotStep: 30, duration: 105, slots: ['19:00:00'] }]);

    expect((await result).value?.[0].duration).toBe(105);
  });
});
