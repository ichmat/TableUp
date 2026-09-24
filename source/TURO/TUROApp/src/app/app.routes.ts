import { Routes } from '@angular/router';
import { HomeComponent } from './features/home-component/home-component';
import { ServiceComponent } from './features/service-component/service-component';
import { BookingComponent } from './features/booking-component/booking-component';
import { ClientsComponent } from './features/clients-component/clients-component';
import { SettingsComponent } from './features/settings/settings-component/settings-component';
import { authGuard } from './core/guards/auth-guard/auth-guard';
import { LoginComponents } from './features/login-components/login-components';

export const routes: Routes = [
    {path: "", component: HomeComponent, canActivate: [authGuard]},
    {path: "service", component: ServiceComponent, canActivate: [authGuard]},
    {path: "reservation", component: BookingComponent, canActivate: [authGuard]},
    {path: "clients", component: ClientsComponent, canActivate: [authGuard]},
    {path: "parametres", component: SettingsComponent, canActivate: [authGuard]},

    {path: "login", component: LoginComponents},
    {path: "**", redirectTo:"" },
];
