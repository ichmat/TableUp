import { Component, computed, inject, input, NgZone, OnDestroy, output, signal } from '@angular/core';
import { twMerge } from 'tailwind-merge';
import {
  ReservationDay, ReservationListItem, ReservationPeriod, ReservationSource, ReservationStatus, SOURCE_CHOICE_LABEL, SOURCE_LABEL,
} from '../../../models';
import { ReservationService } from '../../../core/services/reservation/reservation.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { Button } from '../../../shared/components/button/button';
import { Input } from '../../../shared/components/inputs/input/input';
import { RESERVATION_STATUS_STYLE } from '../../../shared/components/constants/reservation-status-style';
import { todayIn } from '../../../shared/utils/calendar-date';
import { timeIn } from '../../../shared/utils/time-of-day';
import { ReservationActions } from '../reservation-actions';
import { dayHeader, guestName, marks, pendingBanner, quickAction, STATUS_FILTER_LABEL } from '../reservation-display';

const SEARCH_DELAY_MS = 300;
const CLOCK_MS = 60_000;

/** L'écran Réservations (§6.1) : une période, des jours groupés, une action rapide par ligne (§6.4) */
@Component({
  imports: [Input, Button],
  selector: 'app-reservation-list',
  templateUrl: './reservation-list.html',
})
export class ReservationList implements OnDestroy {
  private _reservations = inject(ReservationService);
  private _restaurant = inject(RestaurantService);
  private _actions = inject(ReservationActions);

  selectedId = input<string | null>(null);
  opened = output<string>();
  create = output<void>();

  protected readonly periods: { value: ReservationPeriod, label: string }[] = [
    { value: 'Upcoming', label: 'À venir' },
    { value: 'Today', label: "Aujourd'hui" },
    { value: 'Past', label: 'Passées' },
  ];
  protected readonly statuses = Object.keys(STATUS_FILTER_LABEL) as ReservationStatus[];
  protected readonly statusLabel = STATUS_FILTER_LABEL;
  protected readonly sources = Object.keys(SOURCE_CHOICE_LABEL) as ReservationSource[];
  protected readonly sourceChoice = SOURCE_CHOICE_LABEL;
  protected readonly sourceLabel = SOURCE_LABEL;
  protected readonly statusStyle = RESERVATION_STATUS_STYLE;
  protected readonly guestName = guestName;
  protected readonly marks = marks;
  protected readonly quickAction = quickAction;

  protected query = this._reservations.query;
  protected page = this._reservations.page;
  protected listFailed = this._reservations.listFailed;
  protected zones = computed(() => this._restaurant.model()?.zones ?? []);
  protected searchText = signal(this._reservations.query().search);
  protected busyId = signal<string | null>(null);

  private _timeZone = computed(() => this._restaurant.model()?.timeZone ?? 'Europe/Paris');
  // L'âge de la plus ancienne demande avance tout seul
  private _now = signal(new Date());
  // Hors de la zone : une horloge permanente empêcherait l'application de devenir stable ; le signal suffit au rendu
  private _clock = inject(NgZone).runOutsideAngular(() => setInterval(() => this._now.set(new Date()), CLOCK_MS));
  private _searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected banner = computed(() => {
    const current = this.page();
    return current === null ? null : pendingBanner(current.pending, this._now());
  });

  protected dayHeader(day: ReservationDay): string {
    return dayHeader(day, todayIn(this._timeZone()));
  }

  protected time(item: ReservationListItem): string {
    return timeIn(this._timeZone(), new Date(item.start));
  }

  protected onSearch(text: string) {
    this.searchText.set(text);
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this._reservations.setQuery({ search: text }), SEARCH_DELAY_MS);
  }

  protected setPeriod(period: ReservationPeriod) {
    this._reservations.setQuery({ period });
  }

  protected setStatus(value: string) {
    this._reservations.setQuery({ status: value === '' ? null : value as ReservationStatus });
  }

  protected setSource(value: string) {
    this._reservations.setQuery({ source: value === '' ? null : value as ReservationSource });
  }

  protected setZone(value: string) {
    this._reservations.setQuery({ zoneId: value === '' ? null : value });
  }

  /** « Les traiter » : les demandes à venir, et rien d'autre */
  protected showRequests() {
    this._reservations.setQuery({ period: 'Upcoming', status: 'Pending' });
  }

  protected showMore() {
    this._reservations.showMore();
  }

  protected async act(item: ReservationListItem, gesture: 'accept' | 'refuse' | 'arrive' | 'release') {
    if (this.busyId() !== null) {
      return;
    }
    this.busyId.set(item.id);
    await this._actions.run(item.id, gesture);
    this.busyId.set(null);
  }

  protected place(item: ReservationListItem) {
    this._actions.place(item.serviceDay, item.id);
  }

  protected chipClass(active: boolean): string {
    return twMerge('px-3 py-1 rounded-full border-2 border-border-soft cursor-pointer',
      active ? 'bg-slate text-surface border-slate' : 'bg-surface hover:bg-app');
  }

  protected rowClass(item: ReservationListItem): string {
    return twMerge('flex flex-row items-center gap-2 px-2 py-2 text-sm cursor-pointer border-t border-border-soft hover:bg-app',
      item.id === this.selectedId() ? 'bg-app' : '');
  }

  /** BADGE-01 : la seule couleur forte de la ligne, toujours à la même abscisse */
  protected statusClass(item: ReservationListItem): string {
    return twMerge('text-[0.65rem] font-bold px-1.5 rounded whitespace-nowrap', this.statusStyle[item.status].className);
  }

  ngOnDestroy() {
    clearTimeout(this._searchTimer);
    clearInterval(this._clock);
  }
}
