using System.Net;

namespace TUROAPI.Tools.Attributes
{
    [AttributeUsage(AttributeTargets.Field, AllowMultiple = false, Inherited = false)]
    public class ApiErrorInfoAttribute : Attribute
    {
        public HttpStatusCode StatusCode { get; private set; }
        public string Message { get; private set; }

        public ApiErrorInfoAttribute(HttpStatusCode statusCode, string message)
        {
            StatusCode = statusCode;
            Message = message;
        }
    }
}
