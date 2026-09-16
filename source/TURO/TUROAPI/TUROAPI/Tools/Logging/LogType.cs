namespace TUROAPI.Tools.Logging
{
    public enum LogType { Debug = 1, Info = 2, Warning = 3, Error = 4, Critical = 5 }

    public static class LogEvents
    {
        // Marque les logs émis par le middleware : l'Id de l'EventId porte le status code
        public const string HttpResponse = "HttpResponse";
    }
}
