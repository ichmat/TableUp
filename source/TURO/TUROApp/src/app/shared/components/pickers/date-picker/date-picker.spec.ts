import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePicker } from './date-picker';

describe('DatePicker', () => {
  let fixture: ComponentFixture<DatePicker>;
  let field: HTMLInputElement;
  const panel = () => (fixture.nativeElement as HTMLElement).firstElementChild as HTMLElement;

  beforeEach(async () => {
    // Le sélecteur se place sous le champ qu'il sert : ce champ doit exister dans la page
    field = document.createElement('input');
    field.id = 'date-picker-field';
    document.body.appendChild(field);
    await TestBed.configureTestingModule({ imports: [DatePicker] }).compileComponents();
    fixture = TestBed.createComponent(DatePicker);
    fixture.componentRef.setInput('idFor', field.id);
    fixture.detectChanges();
  });

  afterEach(() => field.remove());

  it('should stay hidden until its field opens it, and hide again on « Annuler »', () => {
    expect(panel().classList).toContain('hidden');

    fixture.componentInstance.openPicker(new Date(2026, 9, 10, 20, 30));
    fixture.detectChanges();
    expect(panel().classList).not.toContain('hidden');

    Array.from(panel().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Annuler')!.click();
    fixture.detectChanges();
    expect(panel().classList).toContain('hidden');
  });
});
