import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlanLegend } from './plan-legend';

describe('PlanLegend', () => {
  let fixture: ComponentFixture<PlanLegend>;
  const keys = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-legend]')).map((e) => e.getAttribute('data-legend'));

  beforeEach(() => {
    fixture = TestBed.createComponent(PlanLegend);
  });

  it('should always show free, reserved, occupied and late', () => {
    fixture.detectChanges();
    expect(keys()).toEqual(['Free', 'Reserved', 'Occupied', 'Late']);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('En retard');
  });

  it('should add « to clean » only when the restaurant tracks it', () => {
    fixture.componentRef.setInput('trackCleaning', true);
    fixture.detectChanges();
    expect(keys()).toEqual(['Free', 'Reserved', 'Occupied', 'ToClean', 'Late']);
  });
});
