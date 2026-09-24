import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { loggingInterceptor } from './core/interceptors/logging-interceptor';
import { RealtimeService } from './core/services/realtime/realtime.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideHttpClient(withInterceptors([loggingInterceptor])),
    // la connexion SignalR suit l'authentification dès le démarrage, même si aucun écran n'utilise encore ses données
    provideAppInitializer(() => { inject(RealtimeService); }),
  ]
};
