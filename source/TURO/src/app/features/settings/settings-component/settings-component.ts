import { Component } from '@angular/core';
import { SettingsPages } from '../../../models/settings.model';

@Component({
  imports: [],
  selector: 'app-settings-component',
  templateUrl: './settings-component.html',
  styles:``
})
export class SettingsComponent {
  currentSetting: SettingsPages = 'Openings';

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
