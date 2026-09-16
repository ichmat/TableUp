using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Responses
{
    public class ApiErrorResponse
    {
        /// <summary>
        /// The HTTP status code of the error.
        /// </summary>
        public int StatusCode { get; set; }

        /// <summary>
        /// The human-readable error message.
        /// </summary>
        public string Message { get; set; }

        /// <summary>
        /// The specific API error identifier.
        /// </summary>
        public ApiError Error { get; set; }

        internal ApiErrorResponse(ApiErrorException exception)
        {
            StatusCode = (int)exception.HttpStatusCode;
            Message = exception.Message;
            Error = exception.ApiError;
        }
    }
}
