import { ChangeDetectionStrategy, Component, computed, inject, input, NgZone, OnDestroy, output, signal } from '@angular/core';
import { twMerge } from 'tailwind-merge';
import { ServiceSnapshot } from '../../../models';
import { formatLongDate } from '../../../shared/utils/calendar-date';
import { timeIn } from '../../../shared/utils/time-of-day';
import { AllergyWindow } from '../allergy-window/allergy-window';
import { ServicePicker } from '../service-picker/service-picker';

/** Un service choisi dans le sélecteur : son jour et l'heure d'ouverture de sa plage */
export interface ServiceChoice {
  day: string,
  /** `HH:mm` */
  opening: string,
}

const CLOCK_MS = 15_000;

/**
 * §4.3 / §5.3 : horloge · état du service · date (le sélecteur) · couverts ; « Aujourd'hui » hors du service par défaut ;
 * la pastille « Allergies » ; le « + » global
 */
@Component({
  selector: 'app-service-header',
  imports: [ServicePicker, AllergyWindow],
  templateUrl: './service-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceHeader implements OnDestroy {
  snapshot = input.required<ServiceSnapshot>();
  timeZone = input.required<string>();
  /** Faux : le restaurant n'a déclaré aucun service */
  hasServices = input(true);
  chosen = output<ServiceChoice>();
  today = output<void>();
  create = output<void>();

  protected pickerOpen = signal(false);
  protected allergiesOpen = signal(false);

  private _now = signal(Date.now());
  // Hors de la zone : une horloge permanente empêcherait l'application de devenir stable
  private _clock = inject(NgZone).runOutsideAngular(() => setInterval(() => this._now.set(Date.now()), CLOCK_MS));
  protected clock = computed(() => timeIn(this.timeZone(), new Date(this._now())));

  protected status = computed<{ text: string, highlight: string | null }>(() => {
    const snapshot = this.snapshot();
    const service = snapshot.service;
    if (service === null) {
      return { text: this.hasServices() ? 'Fermé ce jour' : 'Aucun service configuré', highlight: null };
    }
    switch (service.state) {
      case 'InProgress': {
        const count = snapshot.toPlace.length;
        return { text: 'Service en cours', highlight: count > 0 ? `${count} à placer` : null };
      }
      case 'Finished': return { text: 'Service terminé', highlight: null };
      case 'Upcoming': return { text: `À venir · ${service.opening.slice(0, 5)}`, highlight: null };
    }
  });

  protected date = computed(() => {
    const label = formatLongDate(this.snapshot().day);
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  protected barClass = computed(() => twMerge('relative flex flex-row flex-wrap items-center gap-3 rounded-xl px-3 py-2 shadow',
    this.snapshot().isDefault ? 'bg-surface' : 'bg-app border-2 border-border'));

  protected choose(choice: ServiceChoice) {
    this.pickerOpen.set(false);
    this.chosen.emit(choice);
  }

  ngOnDestroy() {
    clearInterval(this._clock);
  }
}
