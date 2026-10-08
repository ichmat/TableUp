using System.Net;
using TUROAPI.Tools.Attributes;

namespace TUROAPI.Models.Enums
{
    public enum ApiError
    {
        [ApiErrorInfo(HttpStatusCode.InternalServerError, "Critical data error : {0}")]
        CriticalDataInternalError = -2,
        [ApiErrorInfo(HttpStatusCode.InternalServerError, "An unknown error occurred.")]
        Unknown = -1,
        [ApiErrorInfo(HttpStatusCode.OK, "No error.")]
        None = 0,
        [ApiErrorInfo(HttpStatusCode.Unauthorized, "No authentication token given.")]
        NoAuthenticationTokenGiven = 1,
        [ApiErrorInfo(HttpStatusCode.Unauthorized, "Unreadable token")]
        UnreadableToken = 2,
        [ApiErrorInfo(HttpStatusCode.Forbidden, "The token does not have admin privileges.")]
        NotAdmin = 3,
        [ApiErrorInfo(HttpStatusCode.Unauthorized, "Invalid login or password")]
        InvalidLoginOrPassword = 4,
        [ApiErrorInfo(HttpStatusCode.Forbidden, "The token has expired.")]
        TokenExpired = 5,
        [ApiErrorInfo(HttpStatusCode.Forbidden, "Invalid modification : {0}")]
        InvalidModification = 6,
        [ApiErrorInfo(HttpStatusCode.NotFound, "{0}")]
        NotFound = 7,
        [ApiErrorInfo(HttpStatusCode.Conflict, "{0} active reservation(s) ({1} covers) would fall outside the new service hours.")]
        ReservationsImpacted = 8,
        [ApiErrorInfo(HttpStatusCode.Conflict, "{0} active reservation(s) ({1} covers) fall on the closed days or outside the replacement hours.")]
        ClosureImpactsReservations = 9,
        [ApiErrorInfo(HttpStatusCode.BadRequest, "Invalid request : {0}")]
        InvalidRequest = 10,
        [ApiErrorInfo(HttpStatusCode.Conflict, "This phone number already belongs to {0}.")]
        ClientPhoneTaken = 11,
        [ApiErrorInfo(HttpStatusCode.Conflict, "This client was changed on another device since it was opened.")]
        ClientChanged = 12,
        [ApiErrorInfo(HttpStatusCode.Conflict, "This reservation was changed on another device.")]
        ReservationChanged = 13,
        [ApiErrorInfo(HttpStatusCode.Conflict, "{0}")]
        ReservationActionNotAllowed = 14,
        [ApiErrorInfo(HttpStatusCode.BadRequest, "The restaurant is not open at this time: {0}")]
        OutsideService = 15,
        [ApiErrorInfo(HttpStatusCode.Conflict, "This action can no longer be undone.")]
        UndoExpired = 16,
    }
}
