import { Component } from '@angular/core';
import { UsualOpeningHoursComponent } from '../usual-opening-hours-component/usual-opening-hours-component';

@Component({
  imports: [UsualOpeningHoursComponent],
  selector: 'app-openings-component',
  templateUrl: './openings-component.html',
})
export class OpeningsComponent {
}
