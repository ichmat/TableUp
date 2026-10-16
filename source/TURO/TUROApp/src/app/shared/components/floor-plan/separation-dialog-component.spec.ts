import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlanCombination } from '../../../models';
import { SeparationDialogComponent } from './separation-dialog-component';

const CHAIN: PlanCombination = { id: 'chain', name: '12-13-14', capacity: 12, tableIds: ['a', 'b', 'c'], isActive: true };
const PAIR: PlanCombination = { id: 'p', name: '12-13', capacity: 8, tableIds: ['a', 'b'], isActive: false };

describe('SeparationDialogComponent', () => {
  let fixture: ComponentFixture<SeparationDialogComponent>;
  let host: HTMLElement;
  let separated: number;
  let dismissed: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SeparationDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(SeparationDialogComponent);
    host = fixture.nativeElement;
    fixture.componentRef.setInput('combination', CHAIN);
    separated = 0;
    dismissed = 0;
    fixture.componentInstance.separate.subscribe(() => separated++);
    fixture.componentInstance.dismiss.subscribe(() => dismissed++);
    fixture.detectChanges();
  });

  const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent!.trim() === text)!;

  it('should ask before separating, with two answers of equal weight', () => {
    expect(host.textContent).toContain('Séparer la table 12-13-14 ?');
    expect(host.querySelector('[data-reactivated]')).toBeNull();
    button('Séparer').click();
    button('Non, juste la déplacer').click();
    expect(separated).toBe(1);
    expect(dismissed).toBe(1);
  });

  it('should say which combination becomes active again', () => {
    fixture.componentRef.setInput('reactivated', PAIR);
    fixture.detectChanges();
    expect(host.querySelector('[data-reactivated]')!.textContent).toContain('12-13 redevient active');
  });
});
