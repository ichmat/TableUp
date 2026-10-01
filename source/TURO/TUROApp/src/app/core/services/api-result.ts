import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isApiErrorResponse } from '../../models';

/** Réponse d'une écriture : la valeur renvoyée par l'API, ou le message à montrer */
export type ApiResult<T> = { value: T, error: null } | { value: null, error: string };

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
            error: (error: unknown) => resolve({ value: null, error: errorMessage(error) }),
        });
    });
}
