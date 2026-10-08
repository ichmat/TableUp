import { Routes } from '@angular/router';
import { HomeComponent } from './features/home-component/home-component';
import { ServiceComponent } from './features/service-component/service-component';
import { BookingComponent } from './features/booking-component/booking-component';
import { ClientsComponent } from './features/clients-component/clients-component';
import { SettingsComponent } from './features/settings/settings-component/settings-component';
import { authGuard } from './core/guards/auth-guard/auth-guard';
import { landingGuard } from './core/guards/landing-guard/landing-guard';
import { LoginComponents } from './features/login-components/login-components';
import { confirmFloorPlanLeave, FloorPlanEditorComponent } from './features/settings/floor-plan-editor/floor-plan-editor-component';

export const routes: Routes = [
    {path: "", component: HomeComponent, canActivate: [authGuard, landingGuard]},
    {path: "service", component: ServiceComponent, canActivate: [authGuard]},
    {path: "reservation", component: BookingComponent, canActivate: [authGuard]},
    {path: "clients", component: ClientsComponent, canActivate: [authGuard]},
    // Plein écran, sans le rail (§12)
    {path: "parametres/plan", component: FloorPlanEditorComponent, canActivate: [authGuard], canDeactivate: [confirmFloorPlanLeave], data: { fullScreen: true }},
    {path: "parametres", component: SettingsComponent, canActivate: [authGuard]},

    {path: "login", component: LoginComponents},
    {path: "**", redirectTo:"" },
];
