import { afterRenderEffect, Component, computed, ElementRef, input, linkedSignal, model, viewChild } from '@angular/core';
import { Calendar03Icon } from '@hugeicons/core-free-icons';
import { twMerge } from 'tailwind-merge';
import { MAX_YEAR, MIN_YEAR } from '../../constants/date-limits';
import { DEFAULT_INPUT_STYLE } from '../../constants/input-style';
import { DatePicker } from '../../pickers/date-picker/date-picker';

@Component({
  imports: [ DatePicker],
  selector: 'app-date-input',
  templateUrl: './date-input.html',
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
export class DateInput {

  inputClass = input<string>();
  /** Date émise à minuit (heure locale) */
  dateValue = model<Date>();
  /** Format `AAAA-MM-JJ`, comme la valeur d'un `<input type="date">`. Chaîne vide si aucune date */
  dateValueString = model<string>();

  inputDay = viewChild.required<ElementRef<HTMLInputElement>>('inputDay');
  inputMonth = viewChild.required<ElementRef<HTMLInputElement>>('inputMonth');
  inputYear = viewChild.required<ElementRef<HTMLInputElement>>('inputYear');

  picker = viewChild.required(DatePicker);

  calendar = Calendar03Icon;
  readonly minYear = MIN_YEAR;
  readonly maxYear = MAX_YEAR;

  randomId = self.crypto.randomUUID();

  wrapperClass = computed(() => twMerge(DEFAULT_INPUT_STYLE, '[&>input]:focus:outline-none' , this.inputClass()))

  /** Date affichée : suit la dernière des deux valeurs modifiées par le parent (`dateValue` ou `dateValueString`) */
  private currentDate = linkedSignal<{ date?: Date; text?: string }, Date | undefined>({
    source: () => ({ date: this.dateValue(), text: this.dateValueString() }),
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

  private resetInputs(date: Date | undefined){
    this.displayedDate = date;
    setInputValue(this.inputDay().nativeElement, date ? twoDigitNumber(date.getDate()) : '');
    setInputValue(this.inputMonth().nativeElement, date ? twoDigitNumber(date.getMonth() + 1) : '');
    setInputValue(this.inputYear().nativeElement, date ? date.getFullYear().toString() : '');
  }

  private setDateValue(date: Date | undefined){
    if(date?.getTime() !== this.currentDate()?.getTime()){
      this.dateValue.set(date);
      this.dateValueString.set(date ? toIsoDate(date) : '');
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
    if(this.picker().isHidden){
      this.picker().openPicker(this.currentDate() ?? new Date());
    }else{
      this.picker().closePicker();
    }
  }

  pickerNewDate(newDate: Date) {
    this.picker().closePicker();
    this.setDateValue(newDate);
  }

  selectAllOnFocus(event: FocusEvent) {
    (event.target as HTMLInputElement).select();
  }
}

function twoDigitNumber(number: number): string {
  return number.toString().padStart(2, '0');
}

function toIsoDate(date: Date): string {
  return date.getFullYear().toString().padStart(4, '0') + '-'
    + twoDigitNumber(date.getMonth() + 1) + '-'
    + twoDigitNumber(date.getDate());
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** N'écrit que si la valeur change, pour ne pas perdre la sélection d'un champ focus */
function setInputValue(input: HTMLInputElement, value: string){
  if(input.value !== value){
    input.value = value;
  }
}
