import { Component } from '@angular/core';
import { Button } from '../../shared/components/button/button';
import { Input } from '../../shared/components/inputs/input/input';
import { User03FreeIcons } from '@hugeicons/core-free-icons';
import { TimeInput } from '../../shared/components/inputs/time-input/time-input';
import { TimePicker } from '../../shared/components/pickers/time-picker/time-picker';

@Component({
  imports: [Button, Input, TimeInput, TimePicker],
  selector: 'app-home-component',
  templateUrl: './home-component.html',
  styles:``
})
export class HomeComponent {
  user = User03FreeIcons;

  inputVal:number = 0;

  timeValue: string = "12:00";
}
