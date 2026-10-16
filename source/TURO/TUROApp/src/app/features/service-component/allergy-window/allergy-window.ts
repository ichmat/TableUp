import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ServiceAllergy } from '../../../models';
import { timeIn } from '../../../shared/utils/time-of-day';
import { guestName } from '../../booking-component/reservation-display';

/**
 * §5.3 : heure · nom · allergène · table, dans l'ordre où on le dit en cuisine. La fenêtre survole et se ferme ;
 * aucun bouton « vu » : on range l'information, on ne la déclare jamais traitée
 */
@Component({
  selector: 'app-allergy-window',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-backdrop class="fixed inset-0 z-30" (click)="closed.emit()"></div>
    <div class="absolute right-0 top-full mt-2 z-40 w-80 rounded-xl bg-surface shadow-2xl p-3 flex flex-col gap-2 text-sm">
      <p class="font-bold text-coral-ink">Allergies du service</p>
      @for (line of allergies(); track line.reservationId) {
        <p data-allergy-line class="flex flex-row items-center gap-2">
          <span class="w-11 font-bold tabular-nums">{{ time(line.start) }}</span>
          <span class="font-bold">{{ guestName(line.guestName === null ? null : { name: line.guestName }) }}</span>
          <span class="grow text-coral-ink">{{ line.allergies }}</span>
          @if (line.placeName) {
            <span class="font-bold">{{ line.placeName }}</span>
          } @else {
            <!-- L'information manquante est nommée plutôt que vide -->
            <span data-to-place class="px-1 rounded border border-dashed border-text-muted text-text-muted">À placer</span>
          }
        </p>
      }
    </div>
  `,
})
export class AllergyWindow {
  allergies = input.required<ServiceAllergy[]>();
  timeZone = input.required<string>();
  closed = output<void>();

  protected readonly guestName = guestName;

  protected time(start: string): string {
    return timeIn(this.timeZone(), new Date(start));
  }
}
