import { Component, computed, effect, inject, input } from '@angular/core';
import { DayWeek, OccupancyMode, RestaurantService as ServiceModel } from '../../../models';
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
    this.displayModal("Ajouter service", data).then((isOk) => {
      if(isOk){
        this.restaurantService.createService(data);
      }
    });
  }

  displayAction(service:ServiceModel){
    this._modalService.actionModal(
      "Actions", 
      "Voulez vous Modifier ou Supprimer l'horraire ?",
      [
        {text: "Modifier", type: 'Primary', onClick: () => this.updateService(service)},
        {text: "Supprimer", type: 'Tertiary', onClick: () => this.deleteService(service)},
      ]
    )
  }

  updateService(service:ServiceModel){
    this.displayModal("Modifier service", service).then((isOk) => {
      if(isOk){
        this.restaurantService.updateService(service.id, service);
      }
    });
  }

  deleteService(service:ServiceModel){
    this.restaurantService.deleteService(service.id);
  }

  displayModal(title:string, data:ServiceModel): Promise<boolean>{
    return this._modalService.formModal(
      title,
      [
        {
          valueType: 'time', 
          label: "Ouverture Service", 
          defaultValue: data.opening,
          required: true, 
          setValue: (val) => data.opening = val ?? '' 
        },
        {
          valueType: 'time', 
          label: "Fermeture Service", 
          defaultValue: data.closing,
          required: true, 
          setValue: (val) => data.closing = val ?? '' 
        },
        
        {
          valueType: 'radio-number', 
          label: "Pas pour chaque créneaux", 
          required: true,
          defaultValue: data.slotStep,
          options: [
            {label:"15 min", value: 15},
            {label:"30 min", value: 30},
            {label:"1 h", value: 60},
          ],
          setValue: (val) => data.slotStep = val ?? 15
        },

        {
          valueType: 'radio', 
          label: "Type d'occupation", 
          required: true,
          defaultValue: data.occupancyMode,
          options: [
            {label:"Rotation", value: 'Rotate'},
            {label:"Service unique", value: 'SingleService'},
          ],
          setValue: (val) => data.occupancyMode = val as OccupancyMode
        },

        {valueType: 'number', label: "Durée moyen d'une réservation", defaultValue: data.expectedDuration, setValue: (val) => data.expectedDuration = val },
        {valueType: 'number', label: "Nb couvert max par créneaux", defaultValue: data.maxCadence, setValue: (val) => data.maxCadence = val },
        {valueType: 'number', label: "Nb couvert max du service", defaultValue: data.coverCap, setValue: (val) => data.coverCap = val },
      ]
    )
  }
}
