import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { CombinationReminder } from '../../models';
import { ServiceViewService } from '../../core/services/service-view/service-view.service';
import { NavComponent } from './nav-component';

describe('NavComponent', () => {
  let component: NavComponent;
  let fixture: ComponentFixture<NavComponent>;
  const dueReminders = signal<CombinationReminder[]>([]);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavComponent],
      providers: [{ provide: ServiceViewService, useValue: { dueReminders } }],
    })
      .compileComponents();

    fixture = TestBed.createComponent(NavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should lay the rail over the screens, since it covers them and never pushes them (§4.4)', () => {
    // Le rail n'existe que connecté : un module neuf, qui lit le jeton à la construction d'AuthService
    TestBed.resetTestingModule();
    localStorage.setItem('jwt', 'token');
    TestBed.configureTestingModule({
      imports: [NavComponent],
      providers: [provideRouter([]), { provide: ServiceViewService, useValue: { dueReminders } }],
    });
    const connected = TestBed.createComponent(NavComponent);
    connected.detectChanges();

    const nav = (connected.nativeElement as HTMLElement).querySelector('nav')!;
    expect(nav.className).toContain('z-30');
    localStorage.removeItem('jwt');
  });

  it('should show a violet dot on Service while a reminder waits, away from that screen', async () => {
    TestBed.resetTestingModule();
    localStorage.setItem('jwt', 'token');
    TestBed.configureTestingModule({
      imports: [NavComponent],
      providers: [
        provideRouter([{ path: 'service', children: [] }, { path: 'clients', children: [] }]),
        { provide: ServiceViewService, useValue: { dueReminders } },
      ],
    });
    const connected = TestBed.createComponent(NavComponent);
    const dot = () => (connected.nativeElement as HTMLElement).querySelector('[data-reminder-dot]');
    await TestBed.inject(Router).navigateByUrl('/clients');
    dueReminders.set([{ combinationId: 'c1' } as CombinationReminder]);
    connected.detectChanges();
    expect(dot()).not.toBeNull();

    await TestBed.inject(Router).navigateByUrl('/service');
    connected.detectChanges();
    expect(dot()).toBeNull();
    dueReminders.set([]);
    localStorage.removeItem('jwt');
  });
});
