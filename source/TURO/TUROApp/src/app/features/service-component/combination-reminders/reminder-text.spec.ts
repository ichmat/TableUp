import { CombinationReminder } from '../../../models';
import { answeredMessage, answersOf, reminderDetail, reminderTitle } from './reminder-text';

const REMINDER = (change: Partial<CombinationReminder> = {}): CombinationReminder => ({
  combinationId: 'c1', name: '12-13', kind: 'Approach', dueAt: '2026-10-10T19:30:00Z', tableIds: ['t12', 't13'], tableNames: ['12', '13'],
  reservation: { id: 'r1', start: '2026-10-10T19:30:00Z', guestName: 'Nguyen', covers: 8, status: 'Confirmed', serviceDay: '2026-10-10', claimedTable: null }, separates: [], ...change,
});

describe('reminder-text', () => {
  it('should ask to push the tables together, and say what it separates', () => {
    expect(reminderTitle(REMINDER())).toBe('Rapprocher 12 et 13');
    expect(reminderDetail(REMINDER(), 'UTC')).toBe('Nguyen · 8 p · 19:30');
    expect(reminderDetail(REMINDER({ separates: ['13-14'] }), 'UTC')).toBe('Nguyen · 8 p · 19:30\n13-14 sera séparée.');
    expect(answersOf(REMINDER()).map((a) => a.label)).toEqual(["Oui, c'est fait", 'Pas encore', 'Finalement non']);
  });

  it('should not offer "Finalement non" once the guests are seated', () => {
    const seated = REMINDER({ reservation: { ...REMINDER().reservation!, status: 'Seated' } });
    expect(answersOf(seated).map((a) => a.answer)).toEqual(['Done', 'Later']);
  });

  const SEPARATE = (serviceDay: string, start: string) => REMINDER({
    kind: 'Separate', reservation: { id: 'r2', start, guestName: 'Moreau', covers: 4, status: 'Confirmed', serviceDay, claimedTable: '12' },
  });
  const NOW = new Date('2026-10-10T18:00:00Z');

  it('should ask to separate for the reservation that claims a table', () => {
    const separate = SEPARATE('2026-10-10', '2026-10-10T20:00:00Z');
    expect(reminderTitle(separate)).toBe('Séparer 12 et 13');
    expect(reminderDetail(separate, 'UTC', NOW)).toBe('La 12 est attendue seule à 20:00 (Moreau).');
    expect(answersOf(separate).map((a) => a.answer)).toEqual(['Separate', 'KeepTogether']);
  });

  it('should date a claim of another service day', () => {
    expect(reminderDetail(SEPARATE('2026-10-17', '2026-10-17T12:00:00Z'), 'UTC', NOW)).toBe('La 12 est attendue seule sam. 17 oct. à 12:00 (Moreau).');
  });

  it('should ask after a no-show', () => {
    const noShow = REMINDER({ kind: 'AfterNoShow' });
    expect(reminderTitle(noShow)).toBe("Nguyen ne s'est pas présenté.");
    expect(reminderDetail(noShow, 'UTC')).toBe('Séparer 12 et 13 ?');
    expect(answersOf(noShow).map((a) => a.label)).toEqual(['Oui', 'Non']);
  });

  it('should say what each answer did', () => {
    expect(answeredMessage(REMINDER(), 'Done')).toBe('12-13 collée');
    expect(answeredMessage(REMINDER(), 'Later')).toBe('Rappel dans 10 min');
    expect(answeredMessage(REMINDER(), 'Abandon')).toBe('Nguyen retourne dans À placer');
    expect(answeredMessage(REMINDER(), 'Separate')).toBe('12-13 séparée');
    expect(answeredMessage(REMINDER(), 'KeepTogether')).toBe('12-13 reste collée');
  });
});
