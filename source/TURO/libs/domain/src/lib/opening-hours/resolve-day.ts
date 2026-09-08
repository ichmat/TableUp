import type {
  CivilDate,
  ResolvedDay,
  ScheduleException,
  WeeklySchedule,
} from './opening-hours.types';

/**
 * Résout, pour une date donnée, les services qui s'appliquent réellement —
 * en confrontant les horaires habituels au calendrier des exceptions (§9.3).
 *
 * ÉTAPE 1 — à implémenter. Les tests de `resolve-day.spec.ts` disent quoi.
 */
export function resolveDay(
  date: CivilDate,
  weekly: WeeklySchedule,
  exceptions: readonly ScheduleException[]
): ResolvedDay {
  throw new Error('resolveDay : à implémenter (étape 1)');
}
