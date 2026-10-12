import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlacementApproach } from '../../../models';
import { ApproachList, approachKey } from './approach-list';

const APPROACH = (n: number, change: Partial<PlacementApproach> = {}): PlacementApproach => ({
  combinationId: null, tableIds: [`a${n}`, `b${n}`], zoneId: 'z1', name: `${n}-${n + 1}`, capacity: 8, level: 'WithReserve',
  reasons: [{ kind: 'Approach', with: [`${n}`, `${n + 1}`] }], next: null, distance: n, ...change,
});

describe('ApproachList', () => {
  let fixture: ComponentFixture<ApproachList>;
  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(ApproachList);
    fixture.componentRef.setInput('approaches', [1, 2, 3, 4, 5, 6, 7].map((n) => APPROACH(n)));
    fixture.componentRef.setInput('timeZone', 'UTC');
    fixture.detectChanges();
  });

  it('should show five approaches, then all of them on demand', () => {
    expect(element().textContent).toContain('Rapprochements · 7');
    expect(element().querySelectorAll('[data-approach]').length).toBe(5);

    (element().querySelector('[data-more]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element().querySelectorAll('[data-approach]').length).toBe(7);
  });

  it('should name the tables, and say a pair is new', () => {
    const first = element().querySelector(`[data-approach="${approachKey(APPROACH(1))}"]`)!;
    expect(first.textContent).toContain('1 + 2 · 8 places');
    expect(first.textContent).toContain('nouvelle combinaison');
  });

  it('should select a line, and place from its button without selecting it', () => {
    const selected: PlacementApproach[] = [];
    const placed: PlacementApproach[] = [];
    fixture.componentInstance.selected.subscribe((a) => selected.push(a));
    fixture.componentInstance.placed.subscribe((a) => placed.push(a));

    const line = element().querySelector('[data-approach]') as HTMLElement;
    line.click();
    (line.querySelector('app-button button') as HTMLElement).click();

    expect(selected.map((a) => a.name)).toEqual(['1-2']);
    expect(placed.map((a) => a.name)).toEqual(['1-2']);
  });
});
