import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, output } from '@angular/core';
import { ServiceSnapshot } from '../../../models';
import { serviceReservation, serviceSnapshot, utc } from '../testing/service-fixtures';
import { ServiceChoice, ServiceHeader } from './service-header';

@Component({ selector: 'app-service-picker', template: 'PICKER {{ day() }}' })
class PickerStub { day = input.required<string>(); chosen = output<ServiceChoice>(); closed = output<void>(); }
@Component({ selector: 'app-allergy-window', template: 'ALLERGY WINDOW' })
class AllergyStub { allergies = input.required<unknown[]>(); timeZone = input.required<string>(); closed = output<void>(); }

describe('ServiceHeader', () => {
  let fixture: ComponentFixture<ServiceHeader>;
  const element = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => element().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  const show = (snapshot: ServiceSnapshot) => {
    fixture.componentRef.setInput('snapshot', snapshot);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ServiceHeader] })
      .overrideComponent(ServiceHeader, { set: { imports: [PickerStub, AllergyStub] } }).compileComponents();
    fixture = TestBed.createComponent(ServiceHeader);
    fixture.componentRef.setInput('timeZone', 'UTC');
    show(serviceSnapshot({ toPlace: [serviceReservation({ id: 'a' }), serviceReservation({ id: 'b' }), serviceReservation({ id: 'c' })] }));
  });

  it('should tell the service in progress and what is left to place, in orange', () => {
    expect(text('[data-status]')).toBe('Service en cours — 3 à placer');
    expect(element().querySelector('[data-status] .text-interactive')!.textContent).toContain('3 à placer');
    expect(text('[data-date]')).toBe('Samedi 10 octobre');
    expect(text('[data-covers]')).toBe('32/48 couverts');
  });

  it('should tell an upcoming, a finished, a closed and an unconfigured day', () => {
    show(serviceSnapshot({ service: { ...serviceSnapshot().service!, state: 'Upcoming' } }));
    expect(text('[data-status]')).toBe('À venir · 19:00');
    show(serviceSnapshot({ service: { ...serviceSnapshot().service!, state: 'Finished' } }));
    expect(text('[data-status]')).toBe('Service terminé');
    show(serviceSnapshot({ service: null, windows: [] }));
    expect(text('[data-status]')).toBe('Fermé ce jour');
    expect(element().querySelector('[data-covers]')).toBeNull();
    fixture.componentRef.setInput('hasServices', false);
    fixture.detectChanges();
    expect(text('[data-status]')).toBe('Aucun service configuré');
  });

  it('should offer « Aujourd\'hui » only away from the default service, and change tone', () => {
    expect(element().querySelector('[data-today]')).toBeNull();

    show(serviceSnapshot({ isDefault: false }));
    const today = jasmine.createSpy('today');
    fixture.componentInstance.today.subscribe(today);
    (element().querySelector('[data-today]') as HTMLButtonElement).click();

    expect(today).toHaveBeenCalledTimes(1);
    expect(element().firstElementChild!.getAttribute('class')).toContain('bg-app');
  });

  it('should show the allergy button only when the service has some, and open its window', () => {
    expect(element().querySelector('[data-allergies]')).toBeNull();

    show(serviceSnapshot({ allergies: [{ reservationId: 'r1', start: utc('19:30'), guestName: 'Bekkali', allergies: 'Arachide', placeName: 'T3' }] }));
    expect(text('[data-allergies]')).toBe('Allergies · 1');
    (element().querySelector('[data-allergies]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element().textContent).toContain('ALLERGY WINDOW');
    expect(element().querySelector('[data-allergies]')).not.toBeNull();
  });

  it('should open the picker on the date, and the form on +', () => {
    const create = jasmine.createSpy('create');
    fixture.componentInstance.create.subscribe(create);

    (element().querySelector('[data-date]') as HTMLButtonElement).click();
    (element().querySelector('[data-create]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element().textContent).toContain('PICKER 2026-10-10');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
