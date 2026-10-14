import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CombinationReminder, ReminderAnswer } from '../../../models';
import { Button } from '../../../shared/components/button/button';
import { answersOf, reminderDetail, reminderTitle } from './reminder-text';

/**
 * COMB-06 : les rappels échus, en cartes au-dessus du plan. Ils survolent, ne poussent rien, et ne se ferment qu'en répondant :
 * aucun n'expire, aucun ne se coche « vu »
 */
@Component({
  selector: 'app-combination-reminders',
  imports: [Button],
  templateUrl: './combination-reminders.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CombinationReminders {
  reminders = input.required<readonly CombinationReminder[]>();
  timeZone = input.required<string>();
  answered = output<{ reminder: CombinationReminder, answer: ReminderAnswer }>();

  protected readonly title = reminderTitle;
  protected readonly detail = reminderDetail;
  protected readonly answers = answersOf;
}
