import { Routes } from '@angular/router';
import { HomeComponent } from './features/home-component/home-component';
import { ServiceComponent } from './features/service-component/service-component';
import { BookingComponent } from './features/booking-component/booking-component';
import { ClientsComponent } from './features/clients-component/clients-component';
import { SettingsComponent } from './features/settings/settings-component/settings-component';
import { authGuardGuard } from './core/guards/auth-guard/auth-guard-guard';
import { LoginComponents } from './features/login-components/login-components';

export const routes: Routes = [
    {path: "", component: HomeComponent, canActivate: [authGuardGuard]},
    {path: "service", component: ServiceComponent, canActivate: [authGuardGuard]},
    {path: "reservation", component: BookingComponent, canActivate: [authGuardGuard]},
    {path: "clients", component: ClientsComponent, canActivate: [authGuardGuard]},
    {path: "parametres", component: SettingsComponent, canActivate: [authGuardGuard]},

    {path: "login", component: LoginComponents},
    {path: "**", redirectTo:"" },
];
