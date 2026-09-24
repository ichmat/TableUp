using System.Diagnostics;
using TUROAPI.Hubs;
using TUROAPI.Tools.Logging;

namespace TUROAPI.Middleware
{
    public class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        public const string ErrorKey = "Turo.Error";

        public async Task InvokeAsync(HttpContext context)
        {
            if (!context.Request.Path.StartsWithSegments("/api") || IsHubTransport(context.Request.Path))
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

        // La connexion SignalR dure des heures : la tracer comme une requête donnerait une durée absurde, loguée
        // à la fermeture. Seul le negotiate reste tracé, c'est lui qui porte les échecs d'authentification
        private static bool IsHubTransport(PathString path) =>
            path.StartsWithSegments(TuroHub.Path) && !path.StartsWithSegments($"{TuroHub.Path}/negotiate");

        private void Write(int status, string? message, Exception? exception)
        {
            var level = status >= 500 ? LogLevel.Error
                      : status >= 400 ? LogLevel.Warning
                      : LogLevel.Information;

            logger.Log(level, new EventId(status, LogEvents.HttpResponse), message ?? "", exception, (s, _) => s);
        }
    }
}
