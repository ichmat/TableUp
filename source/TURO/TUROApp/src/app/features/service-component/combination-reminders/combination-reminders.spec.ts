import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CombinationReminder } from '../../../models';
import { CombinationReminders } from './combination-reminders';

describe('CombinationReminders', () => {
  let fixture: ComponentFixture<CombinationReminders>;
  const reminder: CombinationReminder = {
    combinationId: 'c1', name: '12-13', kind: 'Approach', dueAt: '2026-10-10T19:30:00Z', tableIds: ['t12', 't13'], tableNames: ['12', '13'],
    reservation: { id: 'r1', start: '2026-10-10T19:30:00Z', guestName: 'Nguyen', covers: 8, status: 'Confirmed', serviceDay: '2026-10-10', claimedTable: null }, separates: [],
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(CombinationReminders);
    fixture.componentRef.setInput('reminders', [reminder]);
    fixture.componentRef.setInput('timeZone', 'UTC');
    fixture.detectChanges();
  });

  it('should show one card per reminder, with its three answers', () => {
    const card = (fixture.nativeElement as HTMLElement).querySelector('[data-reminder="c1"]')!;
    expect(card.textContent).toContain('Rapprocher 12 et 13');
    expect(card.textContent).toContain('Nguyen · 8 p · 19:30');
    expect(card.querySelectorAll('button').length).toBe(3);
  });

  it('should drop "Finalement non" once the guests are seated', () => {
    fixture.componentRef.setInput('reminders', [{ ...reminder, reservation: { ...reminder.reservation!, status: 'Seated' } }]);
    fixture.detectChanges();

    const card = (fixture.nativeElement as HTMLElement).querySelector('[data-reminder="c1"]')!;
    expect(card.querySelectorAll('button').length).toBe(2);
    expect(card.textContent).not.toContain('Finalement non');
  });

  it('should emit the answer touched', () => {
    let answered: unknown = null;
    fixture.componentInstance.answered.subscribe((event) => (answered = event));

    const later = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent!.includes('Pas encore'))!;
    later.click();

    expect(answered).toEqual({ reminder, answer: 'Later' });
  });
});
