/** Miroir de `TUROAPI/Models/Enums/ApiError.cs`, sérialisé par nom */
export enum ApiError{
    Unknown = 'Unknown',
    None = 'None',
    NoAuthenticationTokenGiven = 'NoAuthenticationTokenGiven',
    UnreadableToken = 'UnreadableToken',
    NotAdmin = 'NotAdmin',
    InvalidLoginOrPassword = 'InvalidLoginOrPassword',
    TokenExpired = 'TokenExpired',
    InvalidModification = 'InvalidModification',
    NotFound = 'NotFound',
    ReservationsImpacted = 'ReservationsImpacted',
}

export interface ApiErrorResponse{
    statusCode: number;
    message: string;
    error: ApiError;
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
    return typeof value === 'object' && value !== null
        && 'error' in value && typeof value.error === 'string'
        && 'message' in value && typeof value.message === 'string';
}