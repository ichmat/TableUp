import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { loggingInterceptor } from './logging-interceptor';

describe('loggingInterceptor', () => {
  const interceptor: HttpInterceptorFn = (req, next) => 
    TestBed.runInInjectionContext(() => loggingInterceptor(req, next));

  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([loggingInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  it('should be created', () => {
    expect(interceptor).toBeTruthy();
  });

  it('should log an API refusal as a warning, with its message', async () => {
    const warn = spyOn(console, 'warn');
    const call = firstValueFrom(http.put('/api/restaurant/settings/service/1', {})).catch(() => null);
    backend.expectOne('/api/restaurant/settings/service/1').flush(
      { statusCode: 403, message: 'Invalid modification : slot step must be 15 or 30 minutes.', error: 'InvalidModification' },
      { status: 403, statusText: 'Forbidden' },
    );
    await call;

    expect(warn).toHaveBeenCalledOnceWith('[API] PUT /api/restaurant/settings/service/1 403 : Invalid modification : slot step must be 15 or 30 minutes.');
  });

  it('should log a server failure as an error', async () => {
    const error = spyOn(console, 'error');
    const call = firstValueFrom(http.get('/api/restaurant')).catch(() => null);
    backend.expectOne('/api/restaurant').flush(
      { statusCode: 500, message: 'An unknown error occurred.', error: 'Unknown' },
      { status: 500, statusText: 'Internal Server Error' },
    );
    await call;

    expect(error).toHaveBeenCalledOnceWith('[API] GET /api/restaurant 500 : An unknown error occurred.');
  });

  it('should say when the API cannot be reached', async () => {
    const error = spyOn(console, 'error');
    const call = firstValueFrom(http.get('/api/restaurant')).catch(() => null);
    backend.expectOne('/api/restaurant').error(new ProgressEvent('error'));
    await call;

    expect(error).toHaveBeenCalledOnceWith(jasmine.stringContaining('[API] GET /api/restaurant : API injoignable'));
  });
});
