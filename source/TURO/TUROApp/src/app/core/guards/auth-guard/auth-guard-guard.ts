import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { inject } from '@angular/core';

export const authGuardGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router: Router = inject(Router);
  console.log("authGuardGuard", `is login page ${state.url.match("login")}`)

  if(state.url.match("login") && authService.isConnected()){
    return router.parseUrl('/');
  }else if(!authService.isConnected()){
    return router.parseUrl('/login');
  }

  return true;
};
