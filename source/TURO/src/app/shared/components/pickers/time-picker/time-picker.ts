import { AfterViewInit, Component, computed, input, model, output, signal, Signal } from '@angular/core';
import { Button } from '../../button/button';

@Component({
  imports: [Button],
  selector: 'app-time-picker',
  templateUrl: './time-picker.html',
})
export class TimePicker implements AfterViewInit {

  step = input<number>(DEFAULT_STEP);
  idFor = input.required<string>();
  validate = output<Date>();

  protected currentHour: number = 12;
  protected currentMin: number = 30;

  isHidden = true;

  protected position = signal<{ top: number; left: number }>({ top: 0, left: 0 });

  readonly hours = HOURS;
  // Nombre de pixels de glissement équivalents à un "cran" (comme un deltaY de molette).
  private readonly TOUCH_STEP_PX = 24;

  private hourTouchY: number | null = null;
  private hourTouchAccumulated = 0;

  private minTouchY: number | null = null;
  private minTouchAccumulated = 0;

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

  protected twoDigitNumber(number:string):string{
    if(number.length === 1){
      return '0'+number;
    }
    return number;
  }

  protected setToNow() {
    const now = new Date(Date.now())
    this.setMinute(now.getMinutes());
    this.setHour(now.getHours());
  }
  
  protected setMinute(minute: number){
    if(minute < 0) minute = 0;
    if(minute > 59) minute = this.currentMin;
    this.currentMin = minute;
  }
  protected setHour(hour: number){
    if(hour < 0) hour = 0;
    if(hour > 23) hour = 23;
    this.currentHour = hour;
  }

  protected onValidate(){
    const result = new Date();
    result.setHours(this.currentHour);
    result.setMinutes(this.currentMin);
    this.validate.emit(result);
  }

  protected onCancel(){
    this.closePicker();
  }

  openPicker(defaultDate: Date){
    this.currentHour = defaultDate.getHours();
    this.currentMin = defaultDate.getMinutes();
    this.updatePosition();
    this.isHidden = false;
  }

  closePicker(){
    this.isHidden = true;
  }

  //#region EVENT

  onMinScroll($event: WheelEvent) {
    if($event.deltaY < 0){
      this.setMinute(this.currentMin - this.internalStep());
    }else{
      this.setMinute(this.currentMin + this.internalStep());
    }
  }
  onHourScroll($event: WheelEvent) {
    if($event.deltaY < 0){
      this.setHour(this.currentHour - 1);
    }else{
      this.setHour(this.currentHour + 1);
    }
  }

  onHourTouchStart($event: TouchEvent) {
    this.hourTouchY = $event.touches[0].clientY;
    this.hourTouchAccumulated = 0;
  }

  onHourTouchMove($event: TouchEvent) {
    if(this.hourTouchY === null) return;

    const currentY = $event.touches[0].clientY;
    this.hourTouchAccumulated += currentY - this.hourTouchY;
    this.hourTouchY = currentY;

    while(this.hourTouchAccumulated <= -this.TOUCH_STEP_PX){
      this.setHour(this.currentHour + 1);
      this.hourTouchAccumulated += this.TOUCH_STEP_PX;
    }
    while(this.hourTouchAccumulated >= this.TOUCH_STEP_PX){
      this.setHour(this.currentHour - 1);
      this.hourTouchAccumulated -= this.TOUCH_STEP_PX;
    }
  }

  onHourTouchEnd() {
    this.hourTouchY = null;
    this.hourTouchAccumulated = 0;
  }

  onMinTouchStart($event: TouchEvent) {
    this.minTouchY = $event.touches[0].clientY;
    this.minTouchAccumulated = 0;
  }

  onMinTouchMove($event: TouchEvent) {
    if(this.minTouchY === null) return;

    const currentY = $event.touches[0].clientY;
    this.minTouchAccumulated += currentY - this.minTouchY;
    this.minTouchY = currentY;

    while(this.minTouchAccumulated <= -this.TOUCH_STEP_PX){
      this.setMinute(this.currentMin + this.internalStep());
      this.minTouchAccumulated += this.TOUCH_STEP_PX;
    }
    while(this.minTouchAccumulated >= this.TOUCH_STEP_PX){
      this.setMinute(this.currentMin - this.internalStep());
      this.minTouchAccumulated -= this.TOUCH_STEP_PX;
    }
  }

  onMinTouchEnd() {
    this.minTouchY = null;
    this.minTouchAccumulated = 0;
  }

  //#endregion EVENT
}

const DEFAULT_STEP = 5;
const HOURS = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]