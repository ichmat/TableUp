import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { ServiceViewService } from '../../services/service-view/service-view.service';
import { serviceSnapshot } from '../../../features/service-component/testing/service-fixtures';
import { landingGuard } from './landing-guard';

describe('landingGuard', () => {
  const serviceUrl = {} as UrlTree;
  const router = { navigated: false, url: '/', parseUrl: jasmine.createSpy('parseUrl').and.returnValue(serviceUrl) };
  const isConnected = signal(true);
  const view = jasmine.createSpyObj<ServiceViewService>('ServiceViewService', ['current']);
  const run = () => TestBed.runInInjectionContext(() => landingGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

  beforeEach(() => {
    router.navigated = false;
    router.url = '/';
    isConnected.set(true);
    view.current.calls.reset();
    view.current.and.resolveTo({ value: serviceSnapshot(), error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: { isConnected } },
        { provide: ServiceViewService, useValue: view },
      ],
    });
  });

  it('should land on the service when one is in progress at opening', async () => {
    expect(await run()).toBe(serviceUrl);
    expect(router.parseUrl).toHaveBeenCalledWith('/service');
  });

  it('should land on the home screen when no service is in progress, or when the API cannot tell', async () => {
    view.current.and.resolveTo({ value: serviceSnapshot({ service: { ...serviceSnapshot().service!, state: 'Upcoming' } }), error: null });
    expect(await run()).toBeTrue();

    view.current.and.resolveTo({ value: null, error: 'hors ligne' });
    expect(await run()).toBeTrue();
  });

  it('should land again right after signing in', async () => {
    router.navigated = true;
    router.url = '/login';
    expect(await run()).toBe(serviceUrl);
  });

  it('should let the home screen be reached during a service, from the rail', async () => {
    router.navigated = true;
    router.url = '/service?day=2026-10-10';

    expect(await run()).toBeTrue();
    expect(view.current).not.toHaveBeenCalled();
  });

  it('should ask nothing before sign-in', async () => {
    isConnected.set(false);

    expect(await run()).toBeTrue();
    expect(view.current).not.toHaveBeenCalled();
  });
});
