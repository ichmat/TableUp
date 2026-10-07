import { Component } from '@angular/core';
import { UsualOpeningHoursComponent } from '../usual-opening-hours-component/usual-opening-hours-component';
import { ExceptionalHoursComponent } from '../exceptional-hours-component/exceptional-hours-component';

@Component({
  imports: [UsualOpeningHoursComponent, ExceptionalHoursComponent],
  selector: 'app-openings-component',
  templateUrl: './openings-component.html',
})
export class OpeningsComponent {
}
