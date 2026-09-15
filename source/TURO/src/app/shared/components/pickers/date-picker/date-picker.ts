import { AfterViewInit, Component, computed, input, output, signal, Signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { Button } from '../../button/button';

type CalendarDay = {
  date: Date;
  class: string;
};

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

  readonly weekDays = WEEK_DAYS;
  readonly arrowLeft = ArrowLeft01Icon;
  readonly arrowRight = ArrowRight01Icon;

  // Distance de défilement (molette) ou de glissement (tactile) équivalente à un changement de mois.
  private readonly WHEEL_STEP_PX = 50;
  private readonly SWIPE_STEP_PX = 50;

  private wheelAccumulated = 0;
  private touchStart: { x: number; y: number } | null = null;

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

  protected monthLabel: Signal<string> = computed(() =>
    MONTHS[this.displayedMonth().getMonth()] + ' ' + this.displayedMonth().getFullYear()
  );

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

  protected setDate(date: Date){
    this.currentDate.set(startOfDay(date));
    this.displayedMonth.set(startOfMonth(date));
  }

  protected setToToday() {
    this.setDate(new Date());
  }

  protected changeMonth(delta: number){
    this.displayedMonth.update(month => new Date(month.getFullYear(), month.getMonth() + delta, 1));
  }

  protected onValidate(){
    this.validate.emit(new Date(this.currentDate()));
  }

  protected onCancel(){
    this.closePicker();
  }

  openPicker(defaultDate: Date){
    this.setDate(defaultDate);
    this.wheelAccumulated = 0;
    this.updatePosition();
    this.isHidden = false;
  }

  closePicker(){
    this.isHidden = true;
  }

  //#region EVENT

  onScroll($event: WheelEvent) {
    // Firefox peut exprimer le défilement en lignes plutôt qu'en pixels
    const delta = $event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? $event.deltaY : $event.deltaY * 100;
    if(Math.sign(delta) !== Math.sign(this.wheelAccumulated)){
      this.wheelAccumulated = 0;
    }
    this.wheelAccumulated += delta;

    // Un seul mois par cran : un pavé tactile envoie une rafale de petits événements
    if(Math.abs(this.wheelAccumulated) >= this.WHEEL_STEP_PX){
      this.changeMonth(Math.sign(this.wheelAccumulated));
      this.wheelAccumulated = 0;
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

const WEEK_DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
