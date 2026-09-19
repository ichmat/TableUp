namespace TUROAPI.Tools.Logging
{
    public sealed class TuroLoggerProvider(string logDirectory, IHttpContextAccessor http) : ILoggerProvider
    {
        private readonly Lock _lock = new();

        public ILogger CreateLogger(string categoryName) => new TuroLogger(this, http);

        internal void Write(LogLevel level, string line)
        {
            lock (_lock)
            {
                Console.ForegroundColor = level switch
                {
                    >= LogLevel.Error => ConsoleColor.Red,
                    LogLevel.Warning => ConsoleColor.Yellow,
                    _ => ConsoleColor.Gray
                };
                Console.WriteLine(line);
                Console.ResetColor();

                Directory.CreateDirectory(logDirectory);
                File.AppendAllText(Path.Combine(logDirectory, $"turo-{DateTime.Now:yyyy-MM-dd}.log"), line + Environment.NewLine);
            }
        }

        public void Dispose() { }
    }
}
