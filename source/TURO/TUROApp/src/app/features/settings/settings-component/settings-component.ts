import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SettingsPages } from '../../../models/settings.model';
import { OpeningsComponent } from '../openings-component/openings-component';
import { ServicesAndTimeSlotsComponents } from '../services-and-time-slots-components/services-and-time-slots-components';
import { RoomsAndTablesComponent } from '../rooms-and-tables-component/rooms-and-tables-component';
import { PlacementSettingsComponent } from '../placement-settings-component/placement-settings-component';
import { BookingRulesComponent } from '../booking-rules-component/booking-rules-component';

/** `/parametres?page=salles` : le retour de l'éditeur de plan rouvre la bonne section */
const PAGES_BY_QUERY: Record<string, SettingsPages> = {
  salles: 'Room & tables',
};

@Component({
  imports: [OpeningsComponent, ServicesAndTimeSlotsComponents, RoomsAndTablesComponent, PlacementSettingsComponent, BookingRulesComponent],
  selector: 'app-settings-component',
  templateUrl: './settings-component.html',
  styles:``
})
export class SettingsComponent {
  currentSetting: SettingsPages =
    PAGES_BY_QUERY[inject(ActivatedRoute).snapshot.queryParamMap.get('page') ?? ''] ?? 'Openings';

  isActive(setting: SettingsPages): string{
    if(this.currentSetting === setting){
      return 'bg-slate text-app';
    }
    return '';
  }

  changeSettingPage(setting: SettingsPages){
    this.currentSetting = setting;
  }
}
