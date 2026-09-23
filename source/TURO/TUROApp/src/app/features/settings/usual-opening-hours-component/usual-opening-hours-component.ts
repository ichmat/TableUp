import { Component, computed, effect, inject, input } from '@angular/core';
import { DayWeek } from '../../../models';
import { DayWeekPipe } from '../../../shared/pipes/day-week/day-week-pipe';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { Button } from '../../../shared/components/button/button';
import { TimeOnlyPipe } from '../../../shared/pipes/time-only/time-only-pipe';

@Component({
  imports: [DayWeekPipe, Button, TimeOnlyPipe],
  selector: 'app-usual-opening-hours-component',
  templateUrl: './usual-opening-hours-component.html',
})
export class UsualOpeningHoursComponent {
  dayOfWeek = input.required<DayWeek>();

  protected restaurantService = inject(RestaurantService);
  protected currentServices = computed(() => 
    this.restaurantService.model()?.services.filter(
      (service) => service.day === this.dayOfWeek()
    ));

  constructor(){
    effect(() => {
      if(this.currentServices() !== undefined && this.currentServices()!.length > 0){
        console.log(this.currentServices());
      }
    })
  }
}
