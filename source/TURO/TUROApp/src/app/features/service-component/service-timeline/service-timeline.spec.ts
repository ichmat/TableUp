import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ServiceSlot } from '../../../models';
import { slotsOf } from '../testing/service-fixtures';
import { ServiceTimeline } from './service-timeline';

describe('ServiceTimeline', () => {
  let fixture: ComponentFixture<ServiceTimeline>;
  const slots: ServiceSlot[] = slotsOf(['19:00', '19:30', '20:00']).map((slot, i) => ({ ...slot, covers: [8, 16, 28][i], takenTables: [1, 2, 4][i], hasUnplaced: i === 2 }));
  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(ServiceTimeline);
    fixture.componentRef.setInput('slots', slots);
    fixture.componentRef.setInput('activeIndex', 1);
    fixture.componentRef.setInput('tableCount', 8);
    fixture.detectChanges();
  });

  it('should show each slot with its time and covers, the active one marked', () => {
    expect(element().querySelector('[data-slot="19:00"]')!.textContent).toContain('8c');
    expect(element().querySelector('[data-slot="19:30"]')!.hasAttribute('data-active')).toBeTrue();
    expect(element().querySelector('[data-slot="19:00"]')!.hasAttribute('data-active')).toBeFalse();
    expect(element().querySelector('[data-slot="19:30"]')!.getAttribute('class')).toContain('bg-interactive');
  });

  it('should make the slots big enough to hit during a service', () => {
    expect(element().querySelector('[data-slot]')!.getAttribute('class')).toContain('min-w-24');
  });

  it('should fill each bar with the share of tables taken', () => {
    const bar = element().querySelector('[data-slot="20:00"] [data-fill]') as HTMLElement;
    expect(bar.style.width).toBe('50%');
  });

  it('should flag the slots holding unplaced arrivals, without a count', () => {
    expect(element().querySelectorAll('[data-unplaced]').length).toBe(1);
    expect(element().querySelector('[data-slot="20:00"] [data-unplaced]')!.textContent!.trim()).toBe('!');
  });

  it('should hand back the touched slot', () => {
    const picked = jasmine.createSpy('picked');
    fixture.componentInstance.picked.subscribe(picked);

    (element().querySelector('[data-slot="20:00"]') as HTMLButtonElement).click();

    expect(picked).toHaveBeenCalledOnceWith(2);
  });
});
