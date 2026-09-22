using System.Net;
using System.Reflection;
using TUROAPI.Models.Enums;
using TUROAPI.Tools.Attributes;

namespace TUROAPI
{
    internal class ApiErrorException : Exception
    {
        internal readonly HttpStatusCode HttpStatusCode;
        internal new readonly string Message;
        internal readonly ApiError ApiError;

        internal ApiErrorException(ApiError error, params string[] args) : base()
        {
            var fieldInfo = error.GetType().GetField(error.ToString());
            ApiErrorInfoAttribute? infoAttribute = fieldInfo?.GetCustomAttribute<ApiErrorInfoAttribute>();
            if (infoAttribute == null)
            {
                throw new InvalidOperationException(
                    $"The ApiError enum value '{error}' does not have an associated ApiErrorInfoAttribute.");
            }

            HttpStatusCode = infoAttribute.StatusCode;
            Message = string.Format(infoAttribute.Message, args);
            ApiError = error;
        }
    }
}
