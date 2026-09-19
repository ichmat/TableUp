using System.Text;

namespace TUROAPI.Tools.Logging
{
    internal sealed class TuroLogger(TuroLoggerProvider provider, IHttpContextAccessor http) : ILogger
    {
        // Le filtrage par niveau est fait en amont par la factory, à partir d'appsettings.json
        public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel)) return;

            var type = logLevel switch
            {
                LogLevel.Trace or LogLevel.Debug => LogType.Debug,
                LogLevel.Information => LogType.Info,
                _ => (LogType)logLevel
            };

            var sb = new StringBuilder($"{DateTime.Now:yyyy-MM-dd HH:mm:ss} [{type}]");

            var request = http.HttpContext?.Request;
            if (request is not null)
                sb.Append($" {request.Method} {request.Path}");

            if (eventId.Name == LogEvents.HttpResponse)
                sb.Append($" {eventId.Id}");

            var message = formatter(state, exception);
            if (string.IsNullOrEmpty(message) && exception is not null)
                message = $"{exception.GetType().Name}: {exception.Message}";
            sb.Append(" : ").Append(message);

            if (exception is not null && logLevel >= LogLevel.Error)
                sb.AppendLine().Append(exception.StackTrace);

            provider.Write(logLevel, sb.ToString());
        }
    }
}
