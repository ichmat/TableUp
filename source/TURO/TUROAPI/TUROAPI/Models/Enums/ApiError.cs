using System.Net;
using TUROAPI.Tools.Attributes;

namespace TUROAPI.Models.Enums
{
    public enum ApiError
    {
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
    }
}
