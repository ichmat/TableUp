import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, resource } from '@angular/core';
import { twMerge } from 'tailwind-merge';
import { ServiceState, ServiceWindowState } from '../../../models';
import { ServiceViewService } from '../../../core/services/service-view/service-view.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { ClosureService } from '../../../core/services/closure/closure.service';
import { formatLongDate, monthGrid, parseIsoDate, toIsoDate } from '../../../shared/utils/calendar-date';
import { isServiceDay } from '../../booking-component/reservation-display';
import type { ServiceChoice } from '../service-header/service-header';

export const SERVICE_STATE_LABEL: Record<ServiceState, string> = {
  Finished: 'Terminé',
  InProgress: 'En cours',
  Upcoming: 'À venir',
};

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/**
 * §4.3 : le calendrier du mois — jours fermés grisés, un point sous les jours qui ont des réservations — et les services
 * du jour touché, avec leur état et leurs couverts. Toucher un jour ne change rien ; choisir un service, si
 */
@Component({
  selector: 'app-service-picker',
  templateUrl: './service-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicePicker {
  private _view = inject(ServiceViewService);
  private _restaurant = inject(RestaurantService);
  private _closures = inject(ClosureService);

  /** Le jour affiché par l'écran : le calendrier s'ouvre sur lui */
  day = input.required<string>();
  chosen = output<ServiceChoice>();
  closed = output<void>();

  protected selectedDay = linkedSignal(() => this.day());
  /** `AAAA-MM` */
  protected month = linkedSignal(() => this.day().slice(0, 7));

  private _calendar = resource({ params: () => this.month(), loader: ({ params }) => this._view.calendar(params) });
  private _marked = computed(() => new Set(this._calendar.value()?.value ?? []));
  private _peek = resource({ params: () => this.selectedDay(), loader: ({ params }) => this._view.peek(params) });
  protected windows = computed<ServiceWindowState[]>(() => this._peek.value()?.value?.windows ?? []);

  protected readonly weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  protected readonly stateLabel = SERVICE_STATE_LABEL;

  protected grid = computed(() => {
    const { year, month } = parseIsoDate(`${this.month()}-01`);
    return monthGrid(year, month);
  });

  protected monthLabel = computed(() => {
    const { year, month } = parseIsoDate(`${this.month()}-01`);
    return `${MONTHS[month - 1]} ${year}`;
  });

  protected dayLabel = computed(() => formatLongDate(this.selectedDay()));

  protected isOpen(day: string): boolean {
    return isServiceDay(day, this._restaurant.model()?.services ?? [], this._closures.closures());
  }

  protected isMarked(day: string): boolean {
    return this._marked().has(day);
  }

  protected dayClass(day: string): string {
    return twMerge('relative flex flex-col items-center justify-center size-9 rounded-lg text-sm cursor-pointer',
      day.slice(0, 7) !== this.month() && 'text-text-muted',
      day === this.selectedDay() ? 'bg-interactive text-surface' : 'hover:bg-app',
      !this.isOpen(day) && 'opacity-30 line-through cursor-not-allowed hover:bg-transparent');
  }

  protected pickDay(day: string) {
    if (this.isOpen(day)) {
      this.selectedDay.set(day);
    }
  }

  protected turn(offset: number) {
    const { year, month } = parseIsoDate(`${this.month()}-01`);
    const index = year * 12 + (month - 1) + offset;
    this.month.set(toIsoDate(Math.floor(index / 12), (index % 12) + 1, 1).slice(0, 7));
  }

  protected windowLabel(window: ServiceWindowState): string {
    return `${window.opening.slice(0, 5)} – ${window.closing.slice(0, 5)} · ${SERVICE_STATE_LABEL[window.state]} · ${window.expectedCovers} couverts`;
  }

  protected pickWindow(window: ServiceWindowState) {
    this.chosen.emit({ day: this.selectedDay(), opening: window.opening.slice(0, 5) });
  }
}
