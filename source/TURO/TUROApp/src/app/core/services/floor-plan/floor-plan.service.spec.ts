import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiError } from '../../../models';
import { FloorPlanService } from './floor-plan.service';

describe('FloorPlanService', () => {
  let service: FloorPlanService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FloorPlanService);
    http = TestBed.inject(HttpTestingController);
  });

  it('should resolve a missing draft as null', async () => {
    const result = service.getDraft();
    http.expectOne('/api/restaurant/floor-plan/draft').flush(null, { status: 204, statusText: 'No Content' });

    expect(await result).toEqual({ value: null, error: null });
  });

  it('should default the decors of a draft saved before the decor existed', async () => {
    const result = service.getDraft();
    http.expectOne('/api/restaurant/floor-plan/draft').flush({ tables: [], updatedAt: '2026-10-01T10:00:00Z' });

    expect((await result).value).toEqual({ tables: [], decors: [], combinations: [], updatedAt: '2026-10-01T10:00:00Z' });
  });

  it('should carry the API error code, to tell a non-admin apart', async () => {
    const result = service.getDraft();
    http.expectOne('/api/restaurant/floor-plan/draft').flush(
      { statusCode: 403, message: 'The token does not have admin privileges.', error: 'NotAdmin' },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(await result).toEqual({ value: null, error: 'The token does not have admin privileges.', code: ApiError.NotAdmin });
  });

  it('should put the zone order as a list of ids', async () => {
    const result = service.reorderZones(['b', 'a']);
    const call = http.expectOne('/api/restaurant/floor-plan/zones/order');
    expect(call.request.method).toBe('PUT');
    expect(call.request.body).toEqual({ zoneIds: ['b', 'a'] });
    call.flush([]);

    expect((await result).error).toBeNull();
  });
});
