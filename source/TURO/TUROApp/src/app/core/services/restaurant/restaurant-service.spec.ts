import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiError, Restaurant } from '../../../models';
import { RestaurantService } from './restaurant-service';

const RESTAURANT: Restaurant = {
  id: 'r', name: 'Chez nous', timeZone: 'Europe/Paris', defaultRotation: 105, seatTolerance: 3, lateGrace: 10,
  reminderEnabled: true, reminderDelayHours: 24, autoConfirmation: false, suggestCombinations: false,
  minBookingNoticeMinutes: 60, bookingHorizonDays: 60, zones: [], services: [], cancellationConditions: [], users: [],
};

describe('RestaurantService', () => {
  let service: RestaurantService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RestaurantService);
    http = TestBed.inject(HttpTestingController);
  });

  it('should put the placement settings and show the saved restaurant at once', async () => {
    const request = { defaultRotation: 105, seatTolerance: 3, lateGrace: 10, suggestCombinations: false };
    const result = service.updatePlacement(request);
    const call = http.expectOne('/api/restaurant/settings/placement');
    expect(call.request.method).toBe('PUT');
    expect(call.request.body).toEqual(request);
    call.flush(RESTAURANT);

    expect(await result).toEqual({ value: RESTAURANT, error: null });
    expect(service.model()).toEqual(RESTAURANT);
  });

  it('should put the booking window', async () => {
    const result = service.updateBookingWindow({ minNoticeMinutes: 90, horizonDays: 30 });
    const call = http.expectOne('/api/restaurant/settings/booking-window');
    expect(call.request.method).toBe('PUT');
    expect(call.request.body).toEqual({ minNoticeMinutes: 90, horizonDays: 30 });
    call.flush(RESTAURANT);

    expect((await result).error).toBeNull();
  });

  it('should keep the shown restaurant when a save is refused', async () => {
    const result = service.updatePlacement({ defaultRotation: 100, seatTolerance: 3, lateGrace: 10, suggestCombinations: true });
    http.expectOne('/api/restaurant/settings/placement').flush(
      { statusCode: 400, message: 'Invalid request : default rotation must be a multiple of 15 minutes.', error: 'InvalidRequest' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(await result).toEqual({
      value: null,
      error: 'Invalid request : default rotation must be a multiple of 15 minutes.',
      code: ApiError.InvalidRequest,
    });
    expect(service.model()).toBeNull();
  });

  it('should ask the API for the preview of a tolerance', async () => {
    const result = service.previewPlacement(4, 2);
    const call = http.expectOne((r) => r.url === '/api/restaurant/settings/placement/preview');
    expect(call.request.params.get('covers')).toBe('4');
    expect(call.request.params.get('tolerance')).toBe('2');
    call.flush([{ id: 't5', name: 'T5', capacity: 4, kind: 'Table', fit: 'Perfect' }]);

    expect((await result).value).toEqual([{ id: 't5', name: 'T5', capacity: 4, kind: 'Table', fit: 'Perfect' }]);
  });
});
