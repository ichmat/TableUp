import { AfterViewInit, Component, computed, input, output, signal, Signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { Button } from '../../button/button';
import { MAX_YEAR, MIN_YEAR } from '../../constants/date-limits';

type CalendarDay = {
  date: Date;
  class: string;
};

type Column = 'month' | 'year';

@Component({
  imports: [Button, HugeiconsIconComponent],
  selector: 'app-date-picker',
  templateUrl: './date-picker.html',
})
export class DatePicker implements AfterViewInit {

  idFor = input.required<string>();
  validate = output<Date>();

  isHidden = true;

  protected position = signal<{ top: number; left: number }>({ top: 0, left: 0 });

  /** Jour sélectionné (à minuit) */
  protected currentDate = signal<Date>(startOfDay(new Date()), { equal: sameTime });
  /** Premier jour du mois affiché */
  protected displayedMonth = signal<Date>(startOfMonth(new Date()), { equal: sameTime });

  /** `days` : calendrier du mois, `months` : listes des mois et des années */
  protected view = signal<'days' | 'months'>('days');
  /** Mois affiché à l'ouverture de la vue `months`, restauré si l'on annule */
  private monthBeforeMonthsView = this.displayedMonth();

  readonly weekDays = WEEK_DAYS;
  readonly months = MONTHS;
  readonly arrowLeft = ArrowLeft01Icon;
  readonly arrowRight = ArrowRight01Icon;

  // Distance de défilement (molette) ou de glissement (tactile) équivalente à un cran.
  private readonly WHEEL_STEP_PX = 50;
  private readonly SWIPE_STEP_PX = 50;
  private readonly TOUCH_STEP_PX = 24;
  // Nombre d'années rendues de part et d'autre de l'année courante (les autres seraient masquées)
  private readonly VISIBLE_YEARS = 10;

  private wheelAccumulated = 0;
  private touchStart: { x: number; y: number } | null = null;

  private columnTouchY: number | null = null;
  private columnTouchAccumulated = 0;

  private parent!: HTMLElement;

  ngAfterViewInit(): void {
    const parent = document.getElementById(this.idFor());
    if(parent === null){
      throw new Error("parent not found");
    }
    this.parent = parent;
  }

  private updatePosition(){
    const rect = this.parent.getBoundingClientRect();
    this.position.set({
      top: rect.bottom,
      left: rect.left,
    });
  }

  protected currentDateLabel: Signal<string> = computed(() => formatDate(this.currentDate()));

  /** Toujours 6 semaines (42 jours), pour que la hauteur du calendrier ne change pas d'un mois à l'autre */
  protected days: Signal<CalendarDay[]> = computed(() => {
    const month = this.displayedMonth();
    const selected = this.currentDate();
    const today = startOfDay(new Date());
    // getDay() commence au dimanche (0) : on décale pour commencer la semaine au lundi
    const offset = (month.getDay() + 6) % 7;

    const days: CalendarDay[] = [];
    for(let i = 0; i < 42; i++){
      const date = new Date(month.getFullYear(), month.getMonth(), 1 - offset + i);
      days.push({
        date,
        class: [
          'h-8 leading-8 rounded-md cursor-pointer hover:bg-interactive',
          date.getMonth() !== month.getMonth() ? 'text-text-muted' : '',
          sameTime(date, today) ? 'font-black inset-ring-2 inset-ring-text-muted' : '',
          sameTime(date, selected) ? 'bg-text-muted shadow-md' : '',
        ].join(' '),
      });
    }
    return days;
  });

  // Listes de la vue `months` : les valeurs précédentes sont triées de la plus proche à la plus lointaine
  protected monthsBefore: Signal<number[]> = computed(() =>
    range(0, this.displayedMonth().getMonth()).reverse()
  );
  protected monthsAfter: Signal<number[]> = computed(() =>
    range(this.displayedMonth().getMonth() + 1, 12)
  );
  protected yearsBefore: Signal<number[]> = computed(() => {
    const year = this.displayedMonth().getFullYear();
    return range(Math.max(MIN_YEAR, year - this.VISIBLE_YEARS), year).reverse();
  });
  protected yearsAfter: Signal<number[]> = computed(() => {
    const year = this.displayedMonth().getFullYear();
    return range(year + 1, Math.min(MAX_YEAR, year + this.VISIBLE_YEARS) + 1);
  });

  protected setDate(date: Date){
    this.currentDate.set(startOfDay(date));
    this.displayedMonth.set(startOfMonth(date));
  }

  protected setToToday() {
    this.setDate(new Date());
    this.view.set('days');
  }

  protected changeMonth(delta: number){
    const month = this.displayedMonth();
    this.setDisplayedMonth(month.getFullYear(), month.getMonth() + delta);
  }

  protected setMonth(month: number){
    this.setDisplayedMonth(this.displayedMonth().getFullYear(), clamp(month, 0, 11));
  }

  protected setYear(year: number){
    this.setDisplayedMonth(clamp(year, MIN_YEAR, MAX_YEAR), this.displayedMonth().getMonth());
  }

  /** Le mois peut déborder (-1, 12…) : il est reporté sur l'année, puis borné à [MIN_YEAR, MAX_YEAR] */
  private setDisplayedMonth(year: number, month: number){
    const date = new Date(year, month, 1);
    if(date.getFullYear() < MIN_YEAR){
      date.setFullYear(MIN_YEAR, 0);
    }
    if(date.getFullYear() > MAX_YEAR){
      date.setFullYear(MAX_YEAR, 11);
    }
    this.displayedMonth.set(date);
  }

  protected toggleMonthsView(){
    if(this.view() === 'months'){
      this.view.set('days');
    }else{
      this.monthBeforeMonthsView = this.displayedMonth();
      this.view.set('months');
    }
  }

  protected onValidate(){
    if(this.view() === 'months'){
      this.view.set('days');
      return;
    }
    this.validate.emit(new Date(this.currentDate()));
  }

  protected onCancel(){
    if(this.view() === 'months'){
      this.displayedMonth.set(this.monthBeforeMonthsView);
      this.view.set('days');
      return;
    }
    this.closePicker();
  }

  openPicker(defaultDate: Date){
    this.setDate(defaultDate);
    this.view.set('days');
    this.wheelAccumulated = 0;
    this.updatePosition();
    this.isHidden = false;
  }

  closePicker(){
    this.isHidden = true;
  }

  private shiftColumn(column: Column, step: number){
    if(column === 'month'){
      this.setMonth(this.displayedMonth().getMonth() + step);
    }else{
      this.setYear(this.displayedMonth().getFullYear() + step);
    }
  }

  //#region EVENT

  /** Convertit un événement molette en cran : -1, 0 ou 1 */
  private wheelStep($event: WheelEvent): number {
    // Sans ça la page défile aussi, et le picker (fixed) se décale par rapport à son champ
    $event.preventDefault();
    // Firefox peut exprimer le défilement en lignes plutôt qu'en pixels
    const delta = $event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? $event.deltaY : $event.deltaY * 100;
    if(Math.sign(delta) !== Math.sign(this.wheelAccumulated)){
      this.wheelAccumulated = 0;
    }
    this.wheelAccumulated += delta;

    // Un seul cran à la fois : un pavé tactile envoie une rafale de petits événements
    if(Math.abs(this.wheelAccumulated) < this.WHEEL_STEP_PX){
      return 0;
    }
    const step = Math.sign(this.wheelAccumulated);
    this.wheelAccumulated = 0;
    return step;
  }

  onScroll($event: WheelEvent) {
    const step = this.wheelStep($event);
    if(step !== 0){
      this.changeMonth(step);
    }
  }

  onColumnScroll($event: WheelEvent, column: Column) {
    const step = this.wheelStep($event);
    if(step !== 0){
      this.shiftColumn(column, step);
    }
  }

  onTouchStart($event: TouchEvent) {
    this.touchStart = { x: $event.touches[0].clientX, y: $event.touches[0].clientY };
  }

  onTouchEnd($event: TouchEvent) {
    if(this.touchStart === null) return;

    const touch = $event.changedTouches[0];
    const dx = touch.clientX - this.touchStart.x;
    const dy = touch.clientY - this.touchStart.y;
    this.touchStart = null;

    // Glisser vers la gauche ou vers le haut : mois suivant
    const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    if(Math.abs(delta) >= this.SWIPE_STEP_PX){
      this.changeMonth(delta < 0 ? 1 : -1);
    }
  }

  onTouchCancel() {
    this.touchStart = null;
  }

  onColumnTouchStart($event: TouchEvent) {
    this.columnTouchY = $event.touches[0].clientY;
    this.columnTouchAccumulated = 0;
  }

  onColumnTouchMove($event: TouchEvent, column: Column) {
    if(this.columnTouchY === null) return;

    const currentY = $event.touches[0].clientY;
    this.columnTouchAccumulated += currentY - this.columnTouchY;
    this.columnTouchY = currentY;

    while(this.columnTouchAccumulated <= -this.TOUCH_STEP_PX){
      this.shiftColumn(column, 1);
      this.columnTouchAccumulated += this.TOUCH_STEP_PX;
    }
    while(this.columnTouchAccumulated >= this.TOUCH_STEP_PX){
      this.shiftColumn(column, -1);
      this.columnTouchAccumulated -= this.TOUCH_STEP_PX;
    }
  }

  onColumnTouchEnd() {
    this.columnTouchY = null;
    this.columnTouchAccumulated = 0;
  }

  //#endregion EVENT
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameTime(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

function formatDate(date: Date): string {
  return String(date.getDate()).padStart(2, '0') + '/'
    + String(date.getMonth() + 1).padStart(2, '0') + '/'
    + date.getFullYear();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Entiers de `start` (inclus) à `end` (exclu) */
function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
}

const WEEK_DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
