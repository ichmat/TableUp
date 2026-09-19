namespace TUROAPI.Tools.Logging
{
    public static class AppLogger
    {
        private static ILoggerFactory? _factory;

        public static void Init(ILoggerFactory factory) => _factory = factory;

        public static void Log(LogType type, string message, Exception? exception = null)
            => _factory?.CreateLogger<TuroLogger>().Log((LogLevel)type, default, message, exception, (s, _) => s);
    }
}
