import { AfterViewInit, Component, computed, ElementRef, input, model, viewChild } from '@angular/core';
import { form, validate } from '@angular/forms/signals';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { Time03Icon } from '@hugeicons/core-free-icons';
import { twMerge } from 'tailwind-merge';
import { DEFAULT_INPUT_STYLE } from '../../constants/input-style';

@Component({
  imports: [HugeiconsIconComponent],
  selector: 'app-time-input',
  templateUrl: './time-input.html',
  styles: `
  input[type=number]::-webkit-inner-spin-button, 
  input[type=number]::-webkit-outer-spin-button { 
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      margin: 0; 
  }
  `
})
export class TimeInput {
  inputClass = input<string>();
  step = input<number>();
  timeValue = model<Date>();
  timeValueString = model<string>();

  inputHour = viewChild.required<ElementRef<HTMLInputElement>>('inputHour');
  inputMin = viewChild.required<ElementRef<HTMLInputElement>>('inputMin');

  clock = Time03Icon
  
  wrapperClass = computed(() => twMerge(DEFAULT_INPUT_STYLE, '[&>input]:focus:outline-none' , this.inputClass()))

  // timeValueForm = form(this.timeValueInternal, (path) => {
  //   validate(path.hour, ({value}) => value() < 0 || value() > 23 ? { kind: 'range', message: 'Heure invalide' } : null)
  //   validate(path.minute, ({value}) => value() < 0 || value() > 59 ? { kind: 'range', message: 'Minute invalide' } : null)
  // })

  ngAfterViewInit(){
    if(this.timeValueString() && this.timeValue() === undefined){
      const splitted = this.timeValueString()!.split(':')
      console.log(splitted);
      if(splitted.length === 2){
        const hour = Number(splitted[0]);
        const min = Number(splitted[1]);
        if(!isNaN(hour) && !isNaN(min) && hour >= 0 && hour <= 23 && min >= 0 && min <= 59){
          const newDate = new Date();
          newDate.setHours(hour, min, 0);
          this.timeValue.set(newDate);
        }
      }
    }

    this.resetInputs();
  }

  twoDigitNumber(number:string):string{
    if(number.length === 1){
      return '0'+number;
    }
    return number;
  }

  resetInputs(){
    if(this.timeValue() !== undefined){
      this.inputHour().nativeElement.value = 
        this.twoDigitNumber(this.timeValue()!.getHours().toString())
      this.inputMin().nativeElement.value = 
         this.twoDigitNumber(this.timeValue()!.getMinutes().toString())
    }else{
      this.inputHour().nativeElement.value = ""
      this.inputMin().nativeElement.value = ""
    }
  }

  triggerChangeTimeValue(){
     const hour = Number(this.inputHour().nativeElement.value);
     const minute = Number(this.inputMin().nativeElement.value);

     if(isNaN(hour) === false && isNaN(minute) === false){
      const newDate = new Date();
      newDate.setHours(hour, minute, 0);
      this.timeValue.set(newDate);
      this.timeValueString.set(
        this.twoDigitNumber(hour.toString())+':'+ this.twoDigitNumber(minute.toString()))
    }
  }

  displayPicker(){
    
  }

  selectAllOnFocus(event: FocusEvent) {
    (event.target as HTMLInputElement).select();
  }

  onEnterKey(isHourEnter: boolean) {
    if(isHourEnter){
      this.inputMin().nativeElement.focus();
    }else{
      this.inputMin().nativeElement.blur();
    }
  }

  hourChange() {
    const hour = Number(this.inputHour().nativeElement.value)
    if(isNaN(hour) || hour < 0 || this.inputHour().nativeElement.value.length > 2){
      this.inputHour().nativeElement.value = "00"
    }
    else if(hour > 23){
      this.inputHour().nativeElement.value = "23"
    }

    if(this.inputMin().nativeElement.value === ""){
      this.inputMin().nativeElement.value = "00"
    }

    this.triggerChangeTimeValue();
  }

   minChange() {
    const minute = Number(this.inputMin().nativeElement.value)
    if(isNaN(minute) || minute < 0 || this.inputMin().nativeElement.value.length > 2){
      this.inputMin().nativeElement.value = "00"
    }
    else if(minute > 59){
      this.inputMin().nativeElement.value = "59"
    }
    this.triggerChangeTimeValue();
  }
}
