import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ClosureRequest } from '../../../models';
import { ClosureService } from './closure.service';

const REQUEST: ClosureRequest = {
  from: '2026-12-24',
  to: '2026-12-24',
  type: 'Closed',
  replacementHours: null,
  reason: 'PublicHoliday',
  reasonDetail: null,
  customerMessage: null,
  cancelledReservationIds: [],
};

describe('ClosureService', () => {
  let service: ClosureService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ClosureService);
    http = TestBed.inject(HttpTestingController);
  });

  it('should return the API message when a closure is refused', async () => {
    const result = service.create(REQUEST);
    http.expectOne('/api/restaurant/closures').flush(
      { statusCode: 409, message: '2 active reservation(s) (6 covers) fall on the closed days', error: 'ClosureImpactsReservations' },
      { status: 409, statusText: 'Conflict' },
    );

    expect(await result).toEqual({ value: null, error: '2 active reservation(s) (6 covers) fall on the closed days' });
  });

  it('should post the draft closure to the impact route', async () => {
    const result = service.impact(REQUEST);
    const call = http.expectOne('/api/restaurant/closures/impact');
    expect(call.request.method).toBe('POST');
    call.flush([]);

    expect(await result).toEqual({ value: [], error: null });
  });
});

describe('ClosureService when connected', () => {
  beforeEach(() => {
    // AuthService lit le jeton à sa construction
    localStorage.setItem('jwt', 'token');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => localStorage.removeItem('jwt'));

  it('should expose no closure, without throwing, when the list cannot be loaded', async () => {
    const service = TestBed.inject(ClosureService);
    const http = TestBed.inject(HttpTestingController);
    TestBed.tick();

    http.expectOne('/api/restaurant/closures').flush(null, { status: 404, statusText: 'Not Found' });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(service.closures()).toEqual([]);
    expect(service.loadFailed()).toBeTrue();
  });
});
