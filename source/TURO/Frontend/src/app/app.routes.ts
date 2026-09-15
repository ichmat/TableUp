import { Routes } from '@angular/router';
import { HomeComponent } from './features/home-component/home-component';
import { ServiceComponent } from './features/service-component/service-component';
import { BookingComponent } from './features/booking-component/booking-component';
import { ClientsComponent } from './features/clients-component/clients-component';
import { SettingsComponent } from './features/settings/settings-component/settings-component';

export const routes: Routes = [
    {path: "", component: HomeComponent},
    {path: "service", component: ServiceComponent},
    {path: "reservation", component: BookingComponent},
    {path: "clients", component: ClientsComponent},
    {path: "parametres", component: SettingsComponent},
    {path: "**", redirectTo:"" }
];
