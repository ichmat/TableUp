import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { AuthService } from '../services/auth/auth.service';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { ApiError, isApiErrorResponse } from '../../models';

/** Routes qui ne doivent jamais déclencher de refresh (sinon boucle ou refresh inutile) */
const NO_REFRESH_URLS = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'];

export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(withToken(req, authService.token())).pipe(
    catchError((httpError: unknown) => {
      // jeton illisible (clé de signature changée, jeton altéré…) : il ne redeviendra jamais valide
      if (httpError instanceof HttpErrorResponse
        && isApiErrorResponse(httpError.error)
        && httpError.error.error === ApiError.UnreadableToken) {
        authService.clearToken();
        return throwError(() => httpError);
      }

      // seul un JWT expiré justifie un refresh ; sur /api/auth/refresh, `TokenExpired`
      // signifie que le refresh token lui-même est mort, d'où l'exclusion des routes d'auth
      const canRefresh = httpError instanceof HttpErrorResponse
        && isApiErrorResponse(httpError.error)
        && httpError.error.error === ApiError.TokenExpired
        && !NO_REFRESH_URLS.includes(req.url);

      if (!canRefresh) {
        return throwError(() => httpError);
      }

      return authService.refreshToken().pipe(
        // refresh refusé : l'appelant reçoit l'erreur d'origine, pas celle du refresh
        catchError(() => throwError(() => httpError)),
        // `next` ne repasse pas par cet intercepteur : une seule relance au maximum
        switchMap((jwt) => next(withToken(req, jwt))),
      );
    }),
  );
};

function withToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token === null
    ? req
    : req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}
