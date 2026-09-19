using System.Diagnostics;
using TUROAPI.Tools.Logging;

namespace TUROAPI.Middleware
{
    public class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        public const string ErrorKey = "Turo.Error";

        public async Task InvokeAsync(HttpContext context)
        {
            if (!context.Request.Path.StartsWithSegments("/api"))
            {
                await next(context);
                return;
            }

            var sw = Stopwatch.StartNew();
            try
            {
                await next(context);
            }
            catch (Exception ex)
            {
                // Exception non rattrapée par le filtre MVC
                Write(500, null, ex);
                throw;
            }
            finally
            {
                sw.Stop();
            }

            var error = context.Items[ErrorKey];

            Write(context.Response.StatusCode, 
                error as string ?? (error is null ? $"{sw.ElapsedMilliseconds} ms" : null), 
                error as Exception);
        }

        private void Write(int status, string? message, Exception? exception)
        {
            var level = status >= 500 ? LogLevel.Error
                      : status >= 400 ? LogLevel.Warning
                      : LogLevel.Information;

            logger.Log(level, new EventId(status, LogEvents.HttpResponse), message ?? "", exception, (s, _) => s);
        }
    }
}
