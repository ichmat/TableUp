namespace TUROAPI.Services
{
    /// <summary>
    /// Les plages d'ouverture vues sur la semaine : un service qui ferme « avant » d'ouvrir passe minuit et déborde sur le
    /// lendemain, et le dimanche soir déborde sur le lundi
    /// </summary>
    public static class WeeklyHours
    {
        private const int MinutesPerDay = 24 * 60;
        private const int MinutesPerWeek = 7 * MinutesPerDay;

        /// <summary>`[début, fin)` en minutes depuis dimanche 00:00 ; une ouverture égale à la fermeture dure 24 h</summary>
        public static (int Start, int End) SpanOf(DayOfWeek day, TimeOnly opening, TimeOnly closing)
        {
            int start = (int)day * MinutesPerDay + opening.Hour * 60 + opening.Minute;
            // TimeOnly fait le tour du cadran : 01:00 − 19:00 = 6 h
            int length = (int)(closing - opening).TotalMinutes;
            return (start, start + (length == 0 ? MinutesPerDay : length));
        }

        /// <summary>Bord à bord ne chevauche pas</summary>
        public static bool Overlap((int Start, int End) a, (int Start, int End) b) =>
            new[] { -MinutesPerWeek, 0, MinutesPerWeek }.Any(shift => a.Start < b.End + shift && b.Start + shift < a.End);
    }
}
