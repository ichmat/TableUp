namespace TUROAPI.Services
{
    /// <summary>
    /// Plusieurs numéros et e-mails par fiche, rangés dans une seule colonne texte séparée par `;` :
    /// la première valeur est la principale. Une fusion ne perd ainsi aucun numéro
    /// </summary>
    public static class ContactList
    {
        public const char Separator = ';';

        public static List<string> Split(string? stored) =>
            string.IsNullOrEmpty(stored) ? [] : stored.Split(Separator, StringSplitOptions.RemoveEmptyEntries).ToList();

        public static string? Join(IEnumerable<string> values)
        {
            List<string> distinct = values.Distinct().ToList();
            return distinct.Count == 0 ? null : string.Join(Separator, distinct);
        }

        public static string? NormalizeEmail(string? raw) =>
            string.IsNullOrWhiteSpace(raw) ? null : raw.Trim().ToLowerInvariant();

        public static List<string> Phones(IEnumerable<string?> raw) =>
            raw.Select(PhoneNumber.Normalize).OfType<string>().Distinct().ToList();

        public static List<string> Emails(IEnumerable<string?> raw) =>
            raw.Select(NormalizeEmail).OfType<string>().Distinct().ToList();
    }
}
