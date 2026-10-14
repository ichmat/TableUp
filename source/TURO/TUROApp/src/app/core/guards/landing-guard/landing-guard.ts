import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { ServiceViewService } from '../../services/service-view/service-view.service';

/**
 * §4.6 : à l'ouverture de l'application — ou juste après la connexion —, un service en cours mène au plan.
 * Ensuite l'Accueil reste atteignable depuis le rail, même en plein service. Une API muette laisse entrer
 */
export const landingGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const view = inject(ServiceViewService);
  if (!auth.isConnected() || (router.navigated && !router.url.startsWith('/login'))) {
    return true;
  }
  const result = await view.current();
  return result.value?.service?.state === 'InProgress' ? router.parseUrl('/service') : true;
};
