import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { DAYS_OF_WEEK } from '../../../models';
import { ModalService } from '../../../core/services/modal/modal.service';
import { RestaurantService } from '../../../core/services/restaurant/restaurant-service';
import { DayWeekPipe } from '../../../shared/pipes/day-week/day-week-pipe';
import { formatMinutes, toMinutes } from '../../../shared/utils/time-of-day';
import { ServiceSlotsEditorComponent } from '../service-slots-editor-component/service-slots-editor-component';

@Component({
  imports: [DayWeekPipe, ServiceSlotsEditorComponent],
  selector: 'app-services-and-time-slots-components',
  templateUrl: './services-and-time-slots-components.html',
})
export class ServicesAndTimeSlotsComponents {
  private _modalService = inject(ModalService);
  protected restaurantService = inject(RestaurantService);

  protected readonly formatMinutes = formatMinutes;
  protected readonly toMinutes = toMinutes;

  private _editor = viewChild(ServiceSlotsEditorComponent);
  private _selectedId = signal<string | null>(null);

  /** Services groupés par jour, dans l'ordre de la semaine puis de l'ouverture. Les jours fermés sont omis */
  protected servicesByDay = computed(() => {
    const services = this.restaurantService.model()?.services ?? [];
    return DAYS_OF_WEEK
      .map((day) => ({
        day,
        services: services
          .filter((service) => service.day === day)
          .sort((a, b) => toMinutes(a.opening) - toMinutes(b.opening)),
      }))
      .filter((group) => group.services.length > 0);
  });

  /** Le service choisi, ou le premier de la semaine s'il n'existe plus (supprimé depuis Ouvertures) */
  protected selected = computed(() => {
    const services = this.servicesByDay().flatMap((group) => group.services);
    return services.find((service) => service.id === this._selectedId()) ?? services[0] ?? null;
  });

  protected defaultRotation = computed(() => this.restaurantService.model()?.defaultRotation ?? 0);

  async select(id: string) {
    if (id === this.selected()?.id) {
      return;
    }
    if (this._editor()?.hasChanges()) {
      const leave = await this._modalService.confirmModal(
        "Modifications non enregistrées",
        "Les réglages modifiés de ce service seront perdus.",
        "Abandonner",
        "Rester",
      );
      if (!leave) {
        return;
      }
    }
    this._selectedId.set(id);
  }
}
