import { Component, input, output } from '@angular/core';
import { PlanCombination } from '../../../models';
import { Button } from '../../../shared/components/button/button';

/** Une table vient d'être écartée de sa combinaison active : on demande avant de séparer, les deux réponses pèsent autant */
@Component({
  imports: [Button],
  selector: 'app-separation-dialog-component',
  templateUrl: './separation-dialog-component.html',
})
export class SeparationDialogComponent {
  combination = input.required<PlanCombination>();
  /** La combinaison des tables restées collées : elle redevient active */
  reactivated = input<PlanCombination | null>(null);

  separate = output<void>();
  dismiss = output<void>();
}
