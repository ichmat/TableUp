import { Component, computed, inject, input } from '@angular/core';
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

  addService(){
    // Réglages de créneaux par défaut, modifiables ensuite dans « Services et créneaux »
    let data : ServiceModel = {
      id: "",
      restaurantId: "",
      day: this.dayOfWeek(),
      opening: '',
      closing: '',
      slotStep: 15,
      occupancyMode: 'Rotation',
      expectedDuration: null,
      maxCadence: null,
      coverCap: null,
    }
    this.displayModal("Ajouter service", data).then((isOk) => {
      if(isOk){
        this.restaurantService.createService(data).then((error) => this.showError(error));
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
    // Copie : le modèle affiché ne change qu'au rechargement, une fois l'API d'accord
    const data = {...service};
    this.displayModal("Modifier service", data).then((isOk) => {
      if(isOk){
        this.restaurantService.updateService(service.id, data).then((error) => this.showError(error));
      }
    });
  }

  deleteService(service:ServiceModel){
    this.restaurantService.deleteService(service.id).then((error) => this.showError(error));
  }

  private showError(error: string | null){
    if(error !== null){
      this._modalService.infoModal("Erreur", error);
    }
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
      ]
    )
  }
}
