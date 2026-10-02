namespace TUROAPI.Test.Infrastructure
{
    /// <summary>Les dates vues du restaurant de test, dans son fuseau, comme l'API les calcule</summary>
    public static class Dates
    {
        public const string TimeZoneId = "Europe/Paris";
        private static readonly TimeZoneInfo Zone = TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId);

        public static DateOnly Today => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Zone));

        public static DateTime ToUtc(DateOnly day, TimeOnly localTime) =>
            TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(localTime), Zone);

        /// <summary>Le premier <paramref name="day"/> à au moins une semaine : jamais « passé » pendant un test</summary>
        public static DateOnly Next(DayOfWeek day)
        {
            DateOnly date = Today.AddDays(7);
            while (date.DayOfWeek != day)
            {
                date = date.AddDays(1);
            }
            return date;
        }

        /// <summary>Le dernier <paramref name="day"/> strictement avant aujourd'hui</summary>
        public static DateOnly Previous(DayOfWeek day)
        {
            DateOnly date = Today.AddDays(-1);
            while (date.DayOfWeek != day)
            {
                date = date.AddDays(-1);
            }
            return date;
        }
    }
}
