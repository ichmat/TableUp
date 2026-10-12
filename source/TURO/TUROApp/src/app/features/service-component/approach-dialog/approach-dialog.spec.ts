import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlacementApproach, PlanTable } from '../../../models';
import { ApproachDialog } from './approach-dialog';

const TABLE = (id: string, name: string): PlanTable => ({ id, zoneId: 'z1', name, capacity: 4, shape: 'Square', x: 0, y: 0, width: 0.8, height: 0.8, rotation: 0 });
const PAIR: PlacementApproach = {
  combinationId: null, tableIds: ['t12', 't13'], zoneId: 'z1', name: '12-13', capacity: 8, level: 'WithReserve',
  reasons: [{ kind: 'Approach', with: ['12', '13'] }], next: null, distance: 1.5,
};

describe('ApproachDialog', () => {
  let fixture: ComponentFixture<ApproachDialog>;
  const element = () => fixture.nativeElement as HTMLElement;
  const confirm = () => Array.from(element().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Placer')!;

  beforeEach(() => {
    fixture = TestBed.createComponent(ApproachDialog);
    fixture.componentRef.setInput('approach', PAIR);
    fixture.componentRef.setInput('guest', 'Nguyen');
    fixture.componentRef.setInput('covers', 7);
    fixture.componentRef.setInput('message', 'Rapprochement nécessaire — les tables 12 et 13…');
    fixture.componentRef.setInput('tables', [TABLE('t12', '12'), TABLE('t13', '13')]);
    fixture.componentRef.setInput('combinations', []);
    fixture.detectChanges();
  });

  it('should propose the default name and the summed seats, then confirm them', () => {
    let confirmed: unknown = null;
    fixture.componentInstance.confirmed.subscribe((value) => (confirmed = value));
    expect(element().textContent).toContain('Placer Nguyen sur 12 + 13 ?');
    expect(element().textContent).toContain('Rapprochement nécessaire');

    confirm().click();

    expect(confirmed).toEqual({ name: '12-13', capacity: 8 });
  });

  it('should refuse fewer seats than the party', () => {
    let confirmed = false;
    fixture.componentInstance.confirmed.subscribe(() => (confirmed = true));
    const capacity = element().querySelector('[data-field="capacity"] input') as HTMLInputElement;
    capacity.value = '6';
    capacity.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(element().textContent).toContain('Au moins 7 places pour ce groupe');
    confirm().click();
    expect(confirmed).toBeFalse();
  });

  it('should refuse a name a table already has', () => {
    let confirmed = false;
    fixture.componentInstance.confirmed.subscribe(() => (confirmed = true));
    const name = element().querySelector('[data-field="name"] input') as HTMLInputElement;
    name.value = '12';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(element().textContent).toContain('Une table ou une combinaison porte déjà ce nom');
    confirm().click();
    expect(confirmed).toBeFalse();
  });
});
