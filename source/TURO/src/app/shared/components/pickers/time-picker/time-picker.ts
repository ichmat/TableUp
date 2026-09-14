import { Component, computed, input, model, output, Signal } from '@angular/core';
import { Button } from '../../button/button';

@Component({
  imports: [Button],
  selector: 'app-time-picker',
  templateUrl: './time-picker.html',
})
export class TimePicker {
  value = model<Date>();
  step = input<number>(DEFAULT_STEP);

  protected currentHour: number = 12;
  protected currentMin: number = 30;

  readonly hours = HOURS;

  private internalStep: Signal<number> = computed(() => {
    if(60 % this.step() === 0){
      return this.step()
    }
    return DEFAULT_STEP;
  });

  protected allMinutes: Signal<number[]> = computed(() => {
    const arr: number[] = [];
    let current = 0;
    while(current < 60){
      arr.push(current);
      current += this.internalStep();
    }
    return arr;
  });

  twoDigitNumber(number:string):string{
    if(number.length === 1){
      return '0'+number;
    }
    return number;
  }

  setToNow() {
  }
  
  setMinute(minute: number){
    this.currentMin = minute;
  }
  setHour(hour: number){
    this.currentHour = hour;
  }
}

const DEFAULT_STEP = 5;
const HOURS = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]