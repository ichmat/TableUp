import { resolveDay } from './resolve-day';
import type {
  ScheduleException,
  Service,
  WeeklySchedule,
} from './opening-hours.types';

const lunch: Service = { name: 'Midi', start: '12:00', end: '14:00' };
const dinner: Service = { name: 'Soir', start: '19:00', end: '22:30' };

/** Un bistrot ordinaire : fermé le lundi, midi et soir en semaine, soir seul le samedi. */
const weekly: WeeklySchedule = {
  monday: [],
  tuesday: [lunch, dinner],
  wednesday: [lunch, dinner],
  thursday: [lunch, dinner],
  friday: [lunch, dinner],
  saturday: [dinner],
  sunday: [lunch],
};

const noExceptions: readonly ScheduleException[] = [];

describe('resolveDay', () => {
  describe('without exceptions, a day follows the weekly schedule', () => {
    it('returns the regular services of that weekday', () => {
      // 2026-03-04 est un mercredi
      const day = resolveDay('2026-03-04', weekly, noExceptions);

      expect(day.services).toEqual([lunch, dinner]);
      expect(day.origin).toBe('regular');
      expect(day.date).toBe('2026-03-04');
    });

    it('returns a single service when the week only holds one', () => {
      // 2026-03-07 est un samedi : soir uniquement
      const day = resolveDay('2026-03-07', weekly, noExceptions);

      expect(day.services).toEqual([dinner]);
      expect(day.origin).toBe('regular');
    });

    it('returns an empty day when the restaurant is regularly closed', () => {
      // 2026-03-02 est un lundi
      const day = resolveDay('2026-03-02', weekly, noExceptions);

      expect(day.services).toEqual([]);
      // Une fermeture habituelle n'est PAS une exception :
      // §9.3 — « un jour normal ne porte aucune marque »
      expect(day.origin).toBe('regular');
    });

    it('resolves the weekday regardless of the running machine timezone', () => {
      // Le piège : `new Date('2026-03-03')` est interprété en UTC.
      // Sur une machine à l'ouest de Greenwich, `.getDay()` rend la veille —
      // et le mardi devient un lundi fermé. Ces quatre dates le débusquent.
      expect(resolveDay('2026-03-02', weekly, noExceptions).services).toEqual([]); // lundi
      expect(resolveDay('2026-03-03', weekly, noExceptions).services).toEqual([lunch, dinner]); // mardi
      expect(resolveDay('2026-03-07', weekly, noExceptions).services).toEqual([dinner]); // samedi
      expect(resolveDay('2026-03-08', weekly, noExceptions).services).toEqual([lunch]); // dimanche
    });
  });

  describe('an exception overrides the weekly schedule', () => {
    it('closes a day that is regularly open', () => {
      // 2026-12-24 est un jeudi, habituellement midi + soir
      const exceptions: ScheduleException[] = [{ date: '2026-12-24', kind: 'closure' }];

      const day = resolveDay('2026-12-24', weekly, exceptions);

      expect(day.services).toEqual([]);
      // Distinct de 'regular' : le calendrier du §9.3 doit hachurer ce jour-là
      expect(day.origin).toBe('exceptional_closure');
    });

    it('replaces the regular services entirely', () => {
      // 2026-03-03 est un mardi : midi + soir habituellement
      const lateDinner: Service = { name: 'Soir', start: '20:00', end: '23:00' };
      const exceptions: ScheduleException[] = [
        { date: '2026-03-03', kind: 'modified_hours', services: [lateDinner] },
      ];

      const day = resolveDay('2026-03-03', weekly, exceptions);

      // Le midi habituel ne survit pas : l'exception remplace, elle ne complète pas
      expect(day.services).toEqual([lateDinner]);
      expect(day.origin).toBe('modified_hours');
    });

    it('opens a day that is regularly closed', () => {
      // 2026-03-02 est un lundi, habituellement fermé
      const exceptions: ScheduleException[] = [
        { date: '2026-03-02', kind: 'modified_hours', services: [dinner] },
      ];

      const day = resolveDay('2026-03-02', weekly, exceptions);

      expect(day.services).toEqual([dinner]);
      expect(day.origin).toBe('modified_hours');
    });

    it('never leaks onto another day', () => {
      const exceptions: ScheduleException[] = [{ date: '2026-03-03', kind: 'closure' }];

      // La veille et le lendemain restent intacts
      expect(resolveDay('2026-03-02', weekly, exceptions).origin).toBe('regular');
      expect(resolveDay('2026-03-04', weekly, exceptions)).toEqual({
        date: '2026-03-04',
        services: [lunch, dinner],
        origin: 'regular',
      });
    });

    it('picks the right exception among several', () => {
      const exceptions: ScheduleException[] = [
        { date: '2026-03-02', kind: 'closure' },
        { date: '2026-12-24', kind: 'closure' },
        { date: '2026-03-03', kind: 'modified_hours', services: [dinner] },
      ];

      expect(resolveDay('2026-03-03', weekly, exceptions).services).toEqual([dinner]);
      expect(resolveDay('2026-12-24', weekly, exceptions).origin).toBe('exceptional_closure');
    });
  });
});
