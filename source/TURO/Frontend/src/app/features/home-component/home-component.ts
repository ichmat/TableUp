import { Component } from '@angular/core';
import { Button } from '../../shared/components/button/button';
import { Input } from '../../shared/components/inputs/input/input';
import { User03FreeIcons } from '@hugeicons/core-free-icons';
import { TimeInput } from '../../shared/components/inputs/time-input/time-input';
import { DateInput } from '../../shared/components/inputs/date-input/date-input';

@Component({
  imports: [Button, Input, TimeInput, DateInput],
  selector: 'app-home-component',
  templateUrl: './home-component.html',
  styles:``
})
export class HomeComponent {
  user = User03FreeIcons;

  inputVal:number = 0;

  timeValue: string = "12:00";

  dateValue?: Date;
  dateValueString: string = "2026-09-15";
}
