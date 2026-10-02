import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlanTable } from '../../../models';
import { AccolageDialogComponent } from './accolage-dialog-component';

const T12: PlanTable = { id: 'a', zoneId: 'z', name: '12', capacity: 4, shape: 'Square', x: 0, y: 0, width: 0.9, height: 0.9, rotation: 0 };
const T13: PlanTable = { ...T12, id: 'b', name: '13', x: 0.9 };

describe('AccolageDialogComponent', () => {
  let fixture: ComponentFixture<AccolageDialogComponent>;
  let host: HTMLElement;
  let created: { name: string, capacity: number }[];
  let dismissed: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AccolageDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(AccolageDialogComponent);
    host = fixture.nativeElement;
    fixture.componentRef.setInput('first', T13);
    fixture.componentRef.setInput('second', T12);
    fixture.componentRef.setInput('tables', [T12, T13]);
    fixture.componentRef.setInput('combinations', []);
    created = [];
    dismissed = 0;
    fixture.componentInstance.create.subscribe((c) => created.push(c));
    fixture.componentInstance.dismiss.subscribe(() => dismissed++);
    fixture.detectChanges();
  });

  const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent!.trim() === text)!;

  it('should propose the name in natural order and the sum of the seats', () => {
    expect(host.textContent).toContain('Créer la table 12-13 ?');
    expect(host.querySelector<HTMLInputElement>('[data-field="name"] input')!.value).toBe('12-13');
    expect(host.querySelector<HTMLInputElement>('[data-field="capacity"] input')!.value).toBe('8');
  });

  it('should create with the edited values', () => {
    const seats = host.querySelector<HTMLInputElement>('[data-field="capacity"] input')!;
    seats.value = '7';
    seats.dispatchEvent(new Event('input'));
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
    const name = host.querySelector<HTMLInputElement>('[data-field="name"] input')!;
    name.value = '12';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.textContent).toContain('Une table ou une combinaison porte déjà ce nom');
    button('Créer').click();
    expect(created).toEqual([]);
  });
});
