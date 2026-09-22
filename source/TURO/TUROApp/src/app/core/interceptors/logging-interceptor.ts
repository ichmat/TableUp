import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../services/auth/auth.service';
import { inject } from '@angular/core';

export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  if(authService.token() !== null){
    req.headers.append('Authorization', authService.token()!)
  }

  return next(req);
};
