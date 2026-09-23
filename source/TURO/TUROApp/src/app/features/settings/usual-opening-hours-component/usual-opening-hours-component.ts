import { Component, computed, effect, inject, input } from '@angular/core';
import { DayWeek, RestaurantService as ServiceModel } from '../../../models';
import { DayWeekPipe } from '../../../shared/pipes/day-week/day-week-pipe';
import { Button } from '../../../shared/components/button/button';
import { TimeOnlyPipe } from '../../../shared/pipes/time-only/time-only-pipe';
import { ModalService } from '../../../core/services/modal/modal.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';

@Component({
  imports: [DayWeekPipe, Button, TimeOnlyPipe],
  selector: 'app-usual-opening-hours-component',
  templateUrl: './usual-opening-hours-component.html',
})
export class UsualOpeningHoursComponent {
  private _modalService = inject(ModalService);

  dayOfWeek = input.required<DayWeek>();

  protected restaurantService = inject(RestaurantService);
  protected currentServices = computed(() => 
    this.restaurantService.model()?.services.filter(
      (service) => service.day === this.dayOfWeek()
    ));
  private _containService = computed(() => this.currentServices !== undefined && this.currentServices.length > 0);

  addService(){
    let data : ServiceModel = {
      id: "",
      restaurantId: "",
      day: this.dayOfWeek(),
      opening: '',
      closing: '',
      slotStep: 15,
      occupancyMode: 'Rotate',
      expectedDuration: null,
      maxCadence: null,
      coverCap: null,
    }
    this._modalService.formModal(
      "Ajouter service",
      [
        { label: "Ouverture", valueType: 'time', }
      ]
    );
  }
}
