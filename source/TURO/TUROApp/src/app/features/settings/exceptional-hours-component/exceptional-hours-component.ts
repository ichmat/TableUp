import { Component, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { DayWeek, ExceptionalClosure } from '../../../models';
import { ClosureService } from '../../../core/services/closure/closure.service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { dayOfWeek, monthGrid, parseIsoDate, todayIn } from '../../../shared/utils/calendar-date';
import { ClosureEditorComponent } from '../closure-editor-component/closure-editor-component';

/** `usual-closed` : aucun service ce jour de la semaine. Un jour normal ne porte aucune marque (PAR-01) */
type DayState = 'normal' | 'usual-closed' | 'closed' | 'modified';

interface CalendarDay {
  date: string,
  dayOfMonth: number,
  inMonth: boolean,
  isPast: boolean,
  isToday: boolean,
  state: DayState,
  closure: ExceptionalClosure | null,
  clickable: boolean,
}

/** Utilisé tant que le restaurant n'est pas chargé */
const FALLBACK_TIME_ZONE = 'Europe/Paris';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAY_HEADERS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

/** Horaires exceptionnels : un calendrier mensuel des exceptions (§9.3), et le panneau de la période choisie */
@Component({
  imports: [ClosureEditorComponent],
  selector: 'app-exceptional-hours-component',
  templateUrl: './exceptional-hours-component.html',
})
export class ExceptionalHoursComponent {
  private _modalService = inject(ModalService);
  protected closureService = inject(ClosureService);
  protected restaurantService = inject(RestaurantService);

  protected readonly months = MONTHS;
  protected readonly dayHeaders = DAY_HEADERS;

  private _editor = viewChild(ClosureEditorComponent);

  protected today = computed(() => todayIn(this.restaurantService.model()?.timeZone || FALLBACK_TIME_ZONE));
  protected year = linkedSignal(() => parseIsoDate(this.today()).year);
  /** De 1 à 12 */
  protected month = linkedSignal(() => parseIsoDate(this.today()).month);

  protected selectedDate = signal<string | null>(null);

  /** Jours de la semaine qui ont au moins un service habituel */
  private _openDays = computed(() => new Set<DayWeek>((this.restaurantService.model()?.services ?? []).map((s) => s.day)));

  protected days = computed<CalendarDay[]>(() => {
    const today = this.today();
    const month = this.month();
    return monthGrid(this.year(), month).map((date) => {
      const closure = this.closureOf(date);
      const isPast = date < today;
      const inMonth = parseIsoDate(date).month === month;
      const state: DayState = closure !== null
        ? (closure.type === 'Closed' ? 'closed' : 'modified')
        : (this._openDays().has(dayOfWeek(date)) ? 'normal' : 'usual-closed');
      return {
        date,
        dayOfMonth: parseIsoDate(date).day,
        inMonth,
        isPast,
        isToday: date === today,
        state,
        closure,
        // Fermeture habituelle non cliquable (PAR-03) ; le passé ne se prévoit plus ;
        // sans la liste des exceptions, on ne prévoit rien à l'aveugle
        clickable: inMonth && !isPast && state !== 'usual-closed' && !this.closureService.loadFailed(),
      };
    });
  });

  /** Mois de l'année affichée qui portent au moins une exception */
  protected monthsWithExceptions = computed(() => {
    const year = this.year();
    const months = new Set<number>();
    for (const closure of this.closureService.closures()) {
      for (let month = 1; month <= 12; month++) {
        const first = `${year}-${String(month).padStart(2, '0')}-01`;
        const last = `${year}-${String(month).padStart(2, '0')}-31`;
        if (closure.from <= last && closure.to >= first) {
          months.add(month);
        }
      }
    }
    return months;
  });

  protected selectedClosure = computed(() => {
    const date = this.selectedDate();
    return date === null ? null : this.closureOf(date);
  });

  /** Recrée le panneau quand on passe à une autre exception ou un autre jour libre */
  protected editorKeys = computed(() => {
    const date = this.selectedDate();
    if (date === null) {
      return [];
    }
    return [this.selectedClosure()?.id ?? `new-${date}`];
  });

  async select(day: CalendarDay) {
    if (!day.clickable || day.date === this.selectedDate()) {
      return;
    }
    if (!(await this.confirmLeave())) {
      return;
    }
    this.selectedDate.set(day.date);
  }

  selectMonth(month: number) {
    this.month.set(month);
  }

  shiftYear(delta: number) {
    this.year.update((year) => year + delta);
  }

  closeEditor() {
    this.selectedDate.set(null);
  }

  dayClass(day: CalendarDay): string {
    const base = 'h-10 rounded-md text-sm tabular-nums border-2 flex items-center justify-center';
    if (!day.inMonth) {
      return `${base} border-transparent text-border`;
    }
    const states: Record<DayState, string> = {
      'normal': 'border-transparent bg-surface text-text',
      'usual-closed': 'border-transparent hatch-usual-closed text-text-muted/60',
      'closed': 'border-coral hatch-closed text-coral-ink font-bold line-through',
      'modified': 'border-dashed border-amber bg-amber-soft text-amber-ink font-bold',
    };
    return [
      base,
      states[day.state],
      day.isPast ? 'opacity-50' : '',
      day.clickable ? 'cursor-pointer hover:brightness-95' : 'cursor-default',
      day.isToday ? 'underline underline-offset-4' : '',
      // La sélection est une interaction, d'où l'orange
      day.date === this.selectedDate() ? 'ring-3 ring-interactive' : '',
    ].join(' ');
  }

  private closureOf(date: string): ExceptionalClosure | null {
    return this.closureService.closures().find((c) => c.from <= date && date <= c.to) ?? null;
  }

  private async confirmLeave(): Promise<boolean> {
    if (!this._editor()?.hasChanges()) {
      return true;
    }
    return this._modalService.confirmModal(
      'Modifications non enregistrées',
      'La saisie de cette exception sera perdue.',
      'Abandonner',
      'Rester',
    );
  }
}
