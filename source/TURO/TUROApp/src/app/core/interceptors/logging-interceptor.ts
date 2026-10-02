import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { AuthService } from '../services/auth/auth.service';
import { inject } from '@angular/core';
import { catchError, switchMap, tap, throwError } from 'rxjs';
import { ApiError, isApiErrorResponse } from '../../models';
import { Router } from '@angular/router';

/** Routes qui ne doivent jamais déclencher de refresh (sinon boucle ou refresh inutile) */
const NO_REFRESH_URLS = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'];

export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(withToken(req, authService.token())).pipe(
    catchError((httpError: unknown) => {
      // jeton illisible (clé de signature changée, jeton altéré…) : il ne redeviendra jamais valide
      if (httpError instanceof HttpErrorResponse
        && isApiErrorResponse(httpError.error)
        && httpError.error.error === ApiError.UnreadableToken) {
        authService.clearToken();
        logApiError(req, httpError);
        return throwError(() => {
          router.navigate(["/login"]);
          return httpError;
        });
      }

      // seul un JWT expiré justifie un refresh ; sur /api/auth/refresh, `TokenExpired`
      // signifie que le refresh token lui-même est mort, d'où l'exclusion des routes d'auth
      const canRefresh = httpError instanceof HttpErrorResponse
        && isApiErrorResponse(httpError.error)
        && httpError.error.error === ApiError.TokenExpired
        && !NO_REFRESH_URLS.includes(req.url);

      if (!canRefresh) {
        logApiError(req, httpError);
        return throwError(() => httpError);
      }

      return authService.refreshToken().pipe(
        // refresh refusé : l'appelant reçoit l'erreur d'origine, pas celle du refresh
        catchError(() => {
          logApiError(req, httpError);
          router.navigate(["/login"]);
          return throwError(() => httpError)
        }),
        // `next` ne repasse pas par cet intercepteur : une seule relance au maximum
        switchMap((jwt) => next(withToken(req, jwt)).pipe(
          tap({ error: (retryError: unknown) => logApiError(req, retryError) }),
        )),
      );
    }),
  );
};

function withToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token === null
    ? req
    : req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Trace dans la console chaque refus ou échec de l'API, avec son message : un 4xx en avertissement,
 * un 5xx ou une API injoignable en erreur. Un JWT expiré puis rafraîchi n'est pas tracé, ce n'en est pas un
 */
function logApiError(req: HttpRequest<unknown>, error: unknown) {
  const route = `[API] ${req.method} ${req.urlWithParams}`;
  if (!(error instanceof HttpErrorResponse)) {
    console.error(`${route} :`, error);
    return;
  }
  if (error.status === 0) {
    console.error(`${route} : API injoignable (${error.message})`);
    return;
  }
  const message = isApiErrorResponse(error.error) ? error.error.message : error.message;
  const line = `${route} ${error.status} : ${message}`;
  if (error.status >= 500) {
    console.error(line);
  } else {
    console.warn(line);
  }
}
