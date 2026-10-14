import { ComponentFixture, TestBed } from '@angular/core/testing';
import { utc } from '../testing/service-fixtures';
import { AllergyWindow } from './allergy-window';

describe('AllergyWindow', () => {
  let fixture: ComponentFixture<AllergyWindow>;
  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(AllergyWindow);
    fixture.componentRef.setInput('allergies', [
      { reservationId: 'r1', start: utc('19:30'), guestName: 'Bekkali', allergies: 'Arachide', placeName: 'T3' },
      { reservationId: 'r2', start: utc('20:30'), guestName: 'Moreau', allergies: 'Gluten', placeName: null },
    ]);
    fixture.componentRef.setInput('timeZone', 'UTC');
    fixture.detectChanges();
  });

  it('should read time, name, allergen and table, in the order said in the kitchen', () => {
    const lines = Array.from(element().querySelectorAll('[data-allergy-line]')).map((l) => Array.from(l.children).map((cell) => cell.textContent!.trim()).join(' '));

    expect(lines).toEqual(['19:30 Bekkali Arachide T3', '20:30 Moreau Gluten À placer']);
    expect(element().querySelector('[data-to-place]')!.getAttribute('class')).toContain('border-dashed');
  });

  it('should close when touched beside, with no « seen » button', () => {
    const closed = jasmine.createSpy('closed');
    fixture.componentInstance.closed.subscribe(closed);

    (element().querySelector('[data-backdrop]') as HTMLElement).click();

    expect(closed).toHaveBeenCalledTimes(1);
    expect(element().textContent).not.toMatch(/vu|transmis/i);
  });
});
