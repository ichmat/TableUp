import { Component, computed, input } from '@angular/core';
import { ImpactedReservation } from '../../../models';
import { formatLongDate } from '../../../shared/utils/calendar-date';
import { formatMinutes, toMinutes } from '../../../shared/utils/time-of-day';

/** Les réservations qu'une fermeture laisserait sans service : heure, client, couverts, table et téléphone, prêt à composer (§9.5) */
@Component({
  selector: 'app-impacted-reservations-component',
  templateUrl: './impacted-reservations-component.html',
})
export class ImpactedReservationsComponent {
  reservations = input.required<ImpactedReservation[]>();

  protected readonly formatLongDate = formatLongDate;
  protected readonly formatMinutes = formatMinutes;
  protected readonly toMinutes = toMinutes;

  /** Sur plusieurs jours, chaque ligne porte sa date */
  protected spansDays = computed(() => new Set(this.reservations().map((r) => r.serviceDay)).size > 1);
}
