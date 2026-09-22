import { afterRenderEffect, Component, computed, ElementRef, inject, input, linkedSignal, model, output, viewChild } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { Time03Icon } from '@hugeicons/core-free-icons';
import { twMerge } from 'tailwind-merge';
import { DEFAULT_INPUT_STYLE, INPUT_DISABLED_STYLE, INPUT_ERROR_STYLE } from '../../constants/input-style';
import { TimePicker } from '../../pickers/time-picker/time-picker';

@Component({
  imports: [HugeiconsIconComponent, TimePicker],
  selector: 'app-time-input',
  templateUrl: './time-input.html',
  host: { '(focusout)': 'onFocusOut($event)' },
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
export class TimeInput implements FormValueControl<string> {
  /** Format `HH:mm`, comme la valeur d'un `<input type="time">`. Chaîne vide si aucune heure */
  value = model<string>('');
  timeValue = model<Date>();
  touch = output<void>();

  disabled = input(false);
  readonly = input(false);
  invalid = input(false);
  touched = input(false);
  required = input(false);

  inputClass = input<string>();
  step = input<number>(1);

  inputHour = viewChild.required<ElementRef<HTMLInputElement>>('inputHour');
  inputMin = viewChild.required<ElementRef<HTMLInputElement>>('inputMin');

  picker = viewChild.required(TimePicker);

  clock = Time03Icon;

  randomId = self.crypto.randomUUID();

  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  showError = computed(() => this.invalid() && this.touched());

  wrapperClass = computed(() => twMerge(DEFAULT_INPUT_STYLE, '[&>input]:focus:outline-none', this.inputClass(),
    this.showError() ? INPUT_ERROR_STYLE : '',
    this.disabled() ? INPUT_DISABLED_STYLE : '',
  ));

  /** Heure affichée : suit la dernière des deux valeurs modifiées par le parent (`timeValue` ou `value`) */
  private currentTime = linkedSignal<{ date?: Date; text: string }, Date | undefined>({
    source: () => ({ date: this.timeValue(), text: this.value() }),
    computation: (source, previous) => {
      if(previous === undefined){
        return source.date ?? parseTime(source.text);
      }
      if(source.date !== previous.source.date){
        return source.date;
      }
      return parseTime(source.text);
    },
  });

  /** Heure actuellement écrite dans les champs, au format `HH:mm` */
  private displayedTime?: string;

  constructor(){
    afterRenderEffect(() => {
      const time = this.currentTime();
      if(formatTime(time) !== this.displayedTime){
        this.resetInputs(time);
      }
    });
  }

  focus(options?: FocusOptions){
    if(!this.disabled()){
      this.inputHour().nativeElement.focus(options);
    }
  }

  protected onFocusOut(event: FocusEvent){
    if(!this.host.nativeElement.contains(event.relatedTarget as Node | null)){
      this.touch.emit();
    }
  }

  private resetInputs(time: Date | undefined){
    this.displayedTime = formatTime(time);
    this.inputHour().nativeElement.value = time ? twoDigitNumber(time.getHours()) : '';
    this.inputMin().nativeElement.value = time ? twoDigitNumber(time.getMinutes()) : '';
  }

  private setTime(time: Date | undefined){
    this.timeValue.set(time);
    this.value.set(formatTime(time));
    this.resetInputs(time);
  }

  triggerChangeTimeValue(){
    const hour = Number(this.inputHour().nativeElement.value);
    const minute = Number(this.inputMin().nativeElement.value);

    if(!isNaN(hour) && !isNaN(minute)){
      const newDate = new Date();
      newDate.setHours(hour, minute, 0, 0);
      this.setTime(newDate);
    }
  }

  displayPicker(){
    if(this.disabled() || this.readonly()){
      return;
    }
    if(this.picker().isHidden){
      this.picker().openPicker(this.currentTime() ?? new Date());
    }else{
      this.picker().closePicker();
    }
  }

  pickerNewDate(newDate: Date) {
    this.picker().closePicker();
    this.setTime(newDate);
    this.touch.emit();
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
    const hourInput = this.inputHour().nativeElement;
    if(hourInput.value === ''){
      this.setTime(undefined);
      return;
    }

    const hour = Number(hourInput.value);
    if(isNaN(hour) || hour < 0 || hourInput.value.length > 2){
      hourInput.value = "00";
    }
    else if(hour > 23){
      hourInput.value = "23";
    }

    if(this.inputMin().nativeElement.value === ""){
      this.inputMin().nativeElement.value = "00";
    }

    this.triggerChangeTimeValue();
  }

  minChange() {
    const minInput = this.inputMin().nativeElement;
    if(minInput.value === ''){
      this.setTime(undefined);
      return;
    }

    const minute = Number(minInput.value);
    if(isNaN(minute) || minute < 0 || minInput.value.length > 2){
      minInput.value = "00";
    }
    else if(minute > 59){
      minInput.value = "59";
    }
    this.triggerChangeTimeValue();
  }
}

function twoDigitNumber(number: number): string {
  return number.toString().padStart(2, '0');
}

function formatTime(time: Date | undefined): string {
  return time ? twoDigitNumber(time.getHours()) + ':' + twoDigitNumber(time.getMinutes()) : '';
}

/** `HH:mm` → Date du jour à cette heure, ou `undefined` si la chaîne n'est pas une heure valide */
function parseTime(text: string): Date | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if(match === null){
    return undefined;
  }
  const hour = Number(match[1]);
  const min = Number(match[2]);
  if(hour > 23 || min > 59){
    return undefined;
  }
  const date = new Date();
  date.setHours(hour, min, 0, 0);
  return date;
}
