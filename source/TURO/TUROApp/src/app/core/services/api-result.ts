import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiError, isApiErrorResponse } from '../../models';

/** Réponse d'une écriture : la valeur renvoyée par l'API, ou le message à montrer (et le code de l'API s'il y en a un) */
export type ApiResult<T> = { value: T, error: null } | { value: null, error: string, code?: ApiError };

/** Le message de l'API, ou un message générique si l'erreur ne vient pas d'elle */
export function errorMessage(error: unknown): string {
    return error instanceof HttpErrorResponse && isApiErrorResponse(error.error)
        ? error.error.message
        : "La modification n'a pas été enregistrée.";
}

export function toApiResult<T>(request: Observable<T>): Promise<ApiResult<T>> {
    return new Promise<ApiResult<T>>((resolve) => {
        request.subscribe({
            next: (value) => resolve({ value, error: null }),
            error: (error: unknown) => {
                const code = error instanceof HttpErrorResponse && isApiErrorResponse(error.error) ? error.error.error : undefined;
                // pas de clé `code: undefined` : les `toEqual` existants comparent { value, error } seuls
                resolve(code === undefined
                    ? { value: null, error: errorMessage(error) }
                    : { value: null, error: errorMessage(error), code });
            },
        });
    });
}
