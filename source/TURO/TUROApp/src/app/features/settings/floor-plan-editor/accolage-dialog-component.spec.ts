import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlanCombination, PlanTable } from '../../../models';
import { AccolageDialogComponent } from './accolage-dialog-component';

const T12: PlanTable = { id: 'a', zoneId: 'z', name: '12', capacity: 4, shape: 'Square', x: 0, y: 0, width: 0.9, height: 0.9, rotation: 0 };
const T13: PlanTable = { ...T12, id: 'b', name: '13', x: 0.9 };
const T14: PlanTable = { ...T12, id: 'c', name: '14', x: 1.8 };
const PAIR: PlanCombination = { id: 'p', name: '12-13', capacity: 8, tableIds: ['a', 'b'], isActive: true };

describe('AccolageDialogComponent', () => {
  let fixture: ComponentFixture<AccolageDialogComponent>;
  let host: HTMLElement;
  let created: { name: string, capacity: number }[];
  let reactivated: number;
  let dismissed: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AccolageDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(AccolageDialogComponent);
    host = fixture.nativeElement;
    fixture.componentRef.setInput('members', [T13, T12]);
    fixture.componentRef.setInput('tables', [T12, T13, T14]);
    fixture.componentRef.setInput('combinations', []);
    created = [];
    reactivated = 0;
    dismissed = 0;
    fixture.componentInstance.create.subscribe((c) => created.push(c));
    fixture.componentInstance.reactivate.subscribe(() => reactivated++);
    fixture.componentInstance.dismiss.subscribe(() => dismissed++);
    fixture.detectChanges();
  });

  const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent!.trim() === text)!;
  const field = (name: string) => host.querySelector<HTMLInputElement>(`[data-field="${name}"] input`)!;

  it('should propose the name in natural order and the sum of the seats', () => {
    expect(host.textContent).toContain('Créer la table 12-13 ?');
    expect(field('name').value).toBe('12-13');
    expect(field('capacity').value).toBe('8');
  });

  it('should create with the edited values', () => {
    field('capacity').value = '7';
    field('capacity').dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('Créer').click();
    expect(created).toEqual([{ name: '12-13', capacity: 7 }]);
  });

  it('should only move the tables on "Non, juste les déplacer"', () => {
    button('Non, juste les déplacer').click();
    expect(dismissed).toBe(1);
    expect(created).toEqual([]);
  });

  it('should refuse a name already taken', () => {
    field('name').value = '12';
    field('name').dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.textContent).toContain('Une table ou une combinaison porte déjà ce nom');
    button('Créer').click();
    expect(created).toEqual([]);
  });

  it('should propose a chain, announce the combination it deactivates, and not count it as a conflict', () => {
    fixture.componentRef.setInput('members', [T14, T12, T13]);
    fixture.componentRef.setInput('combinations', [PAIR]);
    fixture.componentRef.setInput('deactivated', [PAIR]);
    fixture.detectChanges();

    expect(host.textContent).toContain('Créer la table 12-13-14 ?');
    expect(field('capacity').value).toBe('12');
    expect(host.querySelector('[data-deactivated]')!.textContent).toContain('12-13 sera désactivée.');
    button('Créer').click();
    expect(created).toEqual([{ name: '12-13-14', capacity: 12 }]);
  });

  it('should show the error of a default name longer than 20 characters', () => {
    const long = (id: string, name: string): PlanTable => ({ ...T12, id, name });
    fixture.componentRef.setInput('members', [long('a', 'Terrasse1'), long('b', 'Terrasse2'), long('c', 'Terrasse3')]);
    fixture.componentRef.setInput('tables', [long('a', 'Terrasse1'), long('b', 'Terrasse2'), long('c', 'Terrasse3')]);
    fixture.detectChanges();
    expect(host.textContent).toContain('Le nom est limité à 20 caractères');
    button('Créer').click();
    expect(created).toEqual([]);
  });

  it('should offer to reactivate a known combination instead of creating it', () => {
    fixture.componentRef.setInput('existing', { ...PAIR, isActive: false });
    fixture.detectChanges();
    expect(host.textContent).toContain('Réactiver la table 12-13 ?');
    expect(host.querySelector('[data-field="name"]')).toBeNull();
    button('Réactiver').click();
    expect(reactivated).toBe(1);
    expect(created).toEqual([]);
  });
});
