import { Component, input } from '@angular/core';
import { DayWeek } from '../../../models';
import { DayWeekPipe } from '../../../shared/pipes/day-week/day-week-pipe';

@Component({
  imports: [DayWeekPipe],
  selector: 'app-usual-opening-hours-component',
  templateUrl: './usual-opening-hours-component.html',
})
export class UsualOpeningHoursComponent {
  dayOfWeek = input.required<DayWeek>();
}
