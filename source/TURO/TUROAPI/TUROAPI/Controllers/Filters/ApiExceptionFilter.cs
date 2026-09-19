using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using TUROAPI.Middleware;
using TUROAPI.Models.Enums;
using TUROAPI.Models.Responses;

namespace TUROAPI.Controllers.Filters
{
    public class ApiExceptionFilter : ExceptionFilterAttribute
    {
        public override void OnException(ExceptionContext context)
        {
            if (context.Exception is ApiErrorException apiError)
            {
                context.HttpContext.Items[RequestLoggingMiddleware.ErrorKey] = apiError.Message;

                var response = new ApiErrorResponse(apiError);

                context.Result = new ObjectResult(response)
                {
                    StatusCode = response.StatusCode
                };

            }
            else
            {
                context.HttpContext.Items[RequestLoggingMiddleware.ErrorKey] = context.Exception;

                var response = new ApiErrorResponse(new ApiErrorException(ApiError.Unknown));

                context.Result = new ObjectResult(response)
                {
                    StatusCode = response.StatusCode
                };
            }

            context.ExceptionHandled = true;
        }

        public override Task OnExceptionAsync(ExceptionContext context)
        {
            OnException(context);
            return Task.CompletedTask;
        }
    }
}
