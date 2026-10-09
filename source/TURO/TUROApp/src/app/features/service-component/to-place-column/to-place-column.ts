import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ServiceReservation, SOURCE_LABEL } from '../../../models';
import { timeIn } from '../../../shared/utils/time-of-day';
import { guestName, marks } from '../../booking-component/reservation-display';

/** §5.7 : 126 px, repliable ; deux groupes qu'on ne peut pas confondre, une pastille par réservation */
@Component({
  selector: 'app-to-place-column',
  imports: [NgTemplateOutlet],
  templateUrl: './to-place-column.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToPlaceColumn {
  toPlace = input.required<ServiceReservation[]>();
  pending = input.required<ServiceReservation[]>();
  timeZone = input.required<string>();
  opened = output<string>();
  /** Un appui sur une pastille : l'écran en fait un glisser au-delà du seuil (§5.8) */
  pressed = output<{ id: string, label: string, event: PointerEvent }>();

  protected collapsed = signal(false);
  protected readonly sourceLabel = SOURCE_LABEL;
  protected readonly guestName = guestName;
  protected readonly marks = marks;

  protected source(reservation: ServiceReservation): string {
    return this.sourceLabel[reservation.source];
  }

  protected time(reservation: ServiceReservation): string {
    return timeIn(this.timeZone(), new Date(reservation.start));
  }
}
