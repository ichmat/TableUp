import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DraftCombination } from '../../../models';
import { CombinationPanelComponent } from './combination-panel-component';

const COMBINATION: DraftCombination = { id: 'c', name: '12-13-14', capacity: 12, tableIds: ['a', 'b', 'c'], isActive: true };

describe('CombinationPanelComponent', () => {
  let fixture: ComponentFixture<CombinationPanelComponent>;
  let host: HTMLElement;
  let changes: { id: string, patch: Partial<DraftCombination> }[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CombinationPanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(CombinationPanelComponent);
    host = fixture.nativeElement;
    fixture.componentRef.setInput('combination', COMBINATION);
    fixture.componentRef.setInput('memberNames', ['12', '13', '14']);
    fixture.componentRef.setInput('isPublished', true);
    changes = [];
    fixture.componentInstance.changed.subscribe((c) => changes.push(c));
    fixture.detectChanges();
  });

  it('should name all its tables', () => {
    expect(host.textContent).toContain('Tables 12, 13 et 14');
  });

  it('should offer to separate an active combination only', () => {
    let separated = 0;
    fixture.componentInstance.separate.subscribe(() => separated++);
    [...host.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Séparer')!.click();
    expect(separated).toBe(1);

    fixture.componentRef.setInput('combination', { ...COMBINATION, isActive: false });
    fixture.detectChanges();
    expect([...host.querySelectorAll('button')].some((b) => b.textContent!.trim() === 'Séparer')).toBeFalse();
    expect(host.textContent).toContain('En sommeil');
  });

  it('should commit the name on Enter', () => {
    const name = host.querySelector<HTMLInputElement>('[data-field="name"] input')!;
    name.value = ' Fenêtre ';
    name.dispatchEvent(new Event('input'));
    name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(changes).toEqual([{ id: 'c', patch: { name: 'Fenêtre' } }]);
  });

  it('should commit the seats when the field is left', () => {
    const seats = host.querySelector<HTMLInputElement>('[data-field="capacity"] input')!;
    seats.value = '7';
    seats.dispatchEvent(new Event('input'));
    seats.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(changes).toEqual([{ id: 'c', patch: { capacity: 7 } }]);
  });

  it('should offer to remove only a combination never published', () => {
    expect(host.textContent).not.toContain('Retirer');
    fixture.componentRef.setInput('isPublished', false);
    fixture.detectChanges();
    expect(host.textContent).toContain('Retirer');
  });
});
