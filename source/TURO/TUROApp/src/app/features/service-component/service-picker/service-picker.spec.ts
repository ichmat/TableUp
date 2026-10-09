import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ExceptionalClosure, Restaurant } from '../../../models';
import { ServiceViewService } from '../../../core/services/service-view/service-view.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { ClosureService } from '../../../core/services/closure/closure.service';
import { serviceSnapshot } from '../testing/service-fixtures';
import { ServicePicker } from './service-picker';

describe('ServicePicker', () => {
  let fixture: ComponentFixture<ServicePicker>;
  let view: jasmine.SpyObj<ServiceViewService>;
  const element = () => fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    view = jasmine.createSpyObj<ServiceViewService>('ServiceViewService', ['calendar', 'peek']);
    view.calendar.and.resolveTo({ value: ['2026-10-10'], error: null });
    view.peek.and.callFake(async (day: string) => ({
      value: serviceSnapshot({
        day,
        windows: [
          { opening: '12:00:00', closing: '14:30:00', state: 'Finished', expectedCovers: 18 },
          { opening: '19:00:00', closing: '23:00:00', state: 'InProgress', expectedCovers: 32 },
        ],
      }),
      error: null,
    }));
    await TestBed.configureTestingModule({
      imports: [ServicePicker],
      providers: [
        { provide: ServiceViewService, useValue: view },
        // ouvert le samedi seulement ; le samedi 17 est fermé
        { provide: RestaurantService, useValue: { model: signal({ services: [{ day: 'Saturday' }] } as Restaurant) } },
        { provide: ClosureService, useValue: { closures: signal([{ from: '2026-10-17', to: '2026-10-17', type: 'Closed' } as ExceptionalClosure]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ServicePicker);
    fixture.componentRef.setInput('day', '2026-10-10');
    await settle();
  });

  it('should grey the closed days and those without service, and dot the days carrying reservations', () => {
    expect((element().querySelector('[data-day="2026-10-10"]') as HTMLButtonElement).disabled).toBeFalse();
    expect((element().querySelector('[data-day="2026-10-17"]') as HTMLButtonElement).disabled).toBeTrue();
    expect((element().querySelector('[data-day="2026-10-12"]') as HTMLButtonElement).disabled).toBeTrue();
    expect(element().querySelector('[data-day="2026-10-10"] [data-dot]')).not.toBeNull();
    expect(element().querySelector('[data-day="2026-10-03"] [data-dot]')).toBeNull();
    expect(view.calendar).toHaveBeenCalledWith('2026-10');
  });

  it('should list the services of the chosen day with their state and covers', () => {
    expect(element().querySelector('[data-window="12:00"]')!.textContent!.replace(/\s+/g, ' ')).toContain('12:00 – 14:30 · Terminé · 18 couverts');
    expect(element().querySelector('[data-window="19:00"]')!.textContent).toContain('En cours');
  });

  it('should hand back the service chosen, and peek at another day without choosing it', async () => {
    const chosen = jasmine.createSpy('chosen');
    fixture.componentInstance.chosen.subscribe(chosen);

    (element().querySelector('[data-day="2026-10-03"]') as HTMLButtonElement).click();
    await settle();
    expect(view.peek).toHaveBeenCalledWith('2026-10-03');
    expect(chosen).not.toHaveBeenCalled();

    (element().querySelector('[data-window="19:00"]') as HTMLButtonElement).click();
    expect(chosen).toHaveBeenCalledOnceWith({ day: '2026-10-03', opening: '19:00' });
  });

  it('should turn the months', async () => {
    (element().querySelector('[data-month-next]') as HTMLButtonElement).click();
    await settle();

    expect(view.calendar).toHaveBeenCalledWith('2026-11');
    expect(element().querySelector('[data-day="2026-11-14"]')).not.toBeNull();
  });
});
