import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateInput } from './date-input';

describe('DateInput', () => {
  let component: DateInput;
  let fixture: ComponentFixture<DateInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateInput]
    })
      .compileComponents();

    fixture = TestBed.createComponent(DateInput);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  it('should grey the days the parent refuses, and never pick one', () => {
    fixture.componentRef.setInput('isDisabled', (date: Date) => date.getDay() === 0);
    component.value.set('2026-08-20');
    fixture.detectChanges();
    component.displayPicker();
    fixture.detectChanges();

    const greyed = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-disabled-day]')) as HTMLElement[];
    expect(greyed.length).toBeGreaterThan(0);
    greyed[0].click();
    fixture.detectChanges();
    const validate = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Valider')!;
    validate.click();

    expect(component.value()).toBe('2026-08-20');
  });
});
