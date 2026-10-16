import { afterRenderEffect, Component, computed, ElementRef, inject, input, linkedSignal, model, output, viewChild } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { Calendar03Icon } from '@hugeicons/core-free-icons';
import { MAX_YEAR, MIN_YEAR } from '../../constants/date-limits';
import { inputWrapperClass } from '../../constants/input-style';
import { clamp, twoDigits } from '../../../utils/number';
import { DatePicker } from '../../pickers/date-picker/date-picker';

@Component({
  imports: [HugeiconsIconComponent, DatePicker],
  selector: 'app-date-input',
  templateUrl: './date-input.html',
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
export class DateInput implements FormValueControl<string> {
  /** Format `AAAA-MM-JJ`, comme la valeur d'un `<input type="date">`. Chaîne vide si aucune date */
  value = model<string>('');
  /** Date émise à minuit (heure locale) */
  dateValue = model<Date>();
  touch = output<void>();

  disabled = input(false);
  readonly = input(false);
  invalid = input(false);
  touched = input(false);
  required = input(false);

  inputClass = input<string>();
  /** Les jours que le calendrier grise et refuse */
  isDisabled = input<(date: Date) => boolean>(() => false);

  inputDay = viewChild.required<ElementRef<HTMLInputElement>>('inputDay');
  inputMonth = viewChild.required<ElementRef<HTMLInputElement>>('inputMonth');
  inputYear = viewChild.required<ElementRef<HTMLInputElement>>('inputYear');

  picker = viewChild.required(DatePicker);

  calendar = Calendar03Icon;
  readonly minYear = MIN_YEAR;
  readonly maxYear = MAX_YEAR;

  randomId = self.crypto.randomUUID();

  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  showError = computed(() => this.invalid() && this.touched());

  wrapperClass = computed(() =>
    inputWrapperClass(this.showError(), this.disabled(), '[&>input]:focus:outline-none', this.inputClass()));

  /** Date affichée : suit la dernière des deux valeurs modifiées par le parent (`dateValue` ou `value`) */
  private currentDate = linkedSignal<{ date?: Date; text: string }, Date | undefined>({
    source: () => ({ date: this.dateValue(), text: this.value() }),
    computation: (source, previous) => {
      if(previous === undefined){
        return source.date ?? parseIsoDate(source.text);
      }
      if(source.date !== previous.source.date){
        return source.date;
      }
      return parseIsoDate(source.text);
    },
  });

  /** Date actuellement écrite dans les champs */
  private displayedDate?: Date;

  constructor(){
    // Répercute dans les champs une valeur changée par le parent. Les saisies de l'utilisateur sont
    // déjà écrites : on ne réécrit pas, sinon un champ en cours de saisie serait écrasé au rendu suivant.
    afterRenderEffect(() => {
      const date = this.currentDate();
      if(date?.getTime() !== this.displayedDate?.getTime()){
        this.resetInputs(date);
      }
    });
  }

  focus(options?: FocusOptions){
    if(!this.disabled()){
      this.inputDay().nativeElement.focus(options);
    }
  }

  protected onFocusOut(event: FocusEvent){
    if(!this.host.nativeElement.contains(event.relatedTarget as Node | null)){
      this.touch.emit();
    }
  }

  private resetInputs(date: Date | undefined){
    this.displayedDate = date;
    setInputValue(this.inputDay().nativeElement, date ? twoDigits(date.getDate()) : '');
    setInputValue(this.inputMonth().nativeElement, date ? twoDigits(date.getMonth() + 1) : '');
    setInputValue(this.inputYear().nativeElement, date ? date.getFullYear().toString() : '');
  }

  private setDateValue(date: Date | undefined){
    if(date?.getTime() !== this.currentDate()?.getTime()){
      this.dateValue.set(date);
      this.value.set(date ? toIsoDate(date) : '');
    }
    // Mise à jour immédiate : le focus passe au champ suivant avant le prochain rendu
    this.resetInputs(date);
  }

  /**
   * Construit la date à partir des trois champs. Vider le champ modifié efface la date ;
   * les autres champs vides reprennent la date actuelle (ou celle du jour).
   */
  protected triggerChangeDateValue(event: Event){
    if((event.target as HTMLInputElement).value === ''){
      this.setDateValue(undefined);
      return;
    }

    const dayText = this.inputDay().nativeElement.value;
    const monthText = this.inputMonth().nativeElement.value;
    const yearText = this.inputYear().nativeElement.value;

    const fallback = this.currentDate() ?? new Date();

    let year = parseNumber(yearText) ?? fallback.getFullYear();
    if(year < 100){
      year += 2000;
    }
    year = clamp(year, MIN_YEAR, MAX_YEAR);

    const month = clamp(parseNumber(monthText) ?? fallback.getMonth() + 1, 1, 12);
    const daysInMonth = new Date(year, month, 0).getDate();
    const day = clamp(parseNumber(dayText) ?? fallback.getDate(), 1, daysInMonth);

    this.setDateValue(new Date(year, month - 1, day));
  }

  displayPicker(){
    if(this.disabled() || this.readonly()){
      return;
    }
    if(this.picker().isHidden){
      this.picker().openPicker(this.currentDate() ?? new Date());
    }else{
      this.picker().closePicker();
    }
  }

  pickerNewDate(newDate: Date) {
    this.picker().closePicker();
    this.setDateValue(newDate);
    this.touch.emit();
  }

  selectAllOnFocus(event: FocusEvent) {
    (event.target as HTMLInputElement).select();
  }
}

function toIsoDate(date: Date): string {
  return date.getFullYear().toString().padStart(4, '0') + '-'
    + twoDigits(date.getMonth() + 1) + '-'
    + twoDigits(date.getDate());
}

/** `AAAA-MM-JJ` → Date à minuit (heure locale), ou `undefined` si la chaîne n'est pas une date valide */
function parseIsoDate(text: string | undefined): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text ?? '');
  if(match === null){
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  // Refuse les dates qui « débordent », comme le 31/02
  if(date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day){
    return undefined;
  }
  return date;
}

function parseNumber(text: string): number | undefined {
  const number = Number(text);
  return text === '' || isNaN(number) ? undefined : Math.trunc(number);
}

/** N'écrit que si la valeur change, pour ne pas perdre la sélection d'un champ focus */
function setInputValue(input: HTMLInputElement, value: string){
  if(input.value !== value){
    input.value = value;
  }
}
