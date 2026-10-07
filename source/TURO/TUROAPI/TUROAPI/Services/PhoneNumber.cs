namespace TUROAPI.Services
{
    /// <summary>
    /// Le téléphone est la clé d'identité d'un client (§7.2) : deux écritures du même numéro doivent donner la même clé.
    /// Seule l'API normalise ; le front ne fait que l'affichage
    /// </summary>
    public static class PhoneNumber
    {
        /// <summary>
        /// Chiffres seuls, `+` en tête conservé ; `+33` ou `0033` suivis de 9 chiffres deviennent `0` + 9 chiffres.
        /// `null` quand il n'y a aucun chiffre
        /// </summary>
        public static string? Normalize(string? raw)
        {
            if (raw == null)
            {
                return null;
            }
            (bool plus, string digits) = Parse(raw);
            if (digits.Length == 0)
            {
                return null;
            }
            if (plus && digits.Length == 11 && digits.StartsWith("33"))
            {
                return "0" + digits[2..];
            }
            if (!plus && digits.Length == 13 && digits.StartsWith("0033"))
            {
                return "0" + digits[4..];
            }
            // « +33 (0)6 12 34 56 78 » : le zéro entre parenthèses ne se compose pas
            if (plus && digits.Length == 12 && digits.StartsWith("330"))
            {
                return "0" + digits[3..];
            }
            if (!plus && digits.Length == 14 && digits.StartsWith("00330"))
            {
                return "0" + digits[5..];
            }
            return plus ? "+" + digits : digits;
        }

        /// <summary>Même règle sans exigence de longueur : « +33 6 12 » cherche « 0612 »</summary>
        public static string SearchKey(string text)
        {
            (bool plus, string digits) = Parse(text);
            if (plus && digits.StartsWith("330"))
            {
                return "0" + digits[3..];
            }
            if (!plus && digits.StartsWith("00330"))
            {
                return "0" + digits[5..];
            }
            if (plus && digits.StartsWith("33"))
            {
                return "0" + digits[2..];
            }
            if (!plus && digits.StartsWith("0033"))
            {
                return "0" + digits[4..];
            }
            return plus ? "+" + digits : digits;
        }

        /// <summary>Lecture humaine (export) : `0612345678` → `06 12 34 56 78` ; tout autre numéro tel qu'enregistré</summary>
        public static string Format(string stored) =>
            stored.Length == 10 && stored[0] == '0' && stored.All(char.IsAsciiDigit)
                ? string.Join(' ', Enumerable.Range(0, 5).Select(i => stored.Substring(i * 2, 2)))
                : stored;

        private static (bool Plus, string Digits) Parse(string text)
        {
            string trimmed = text.Trim();
            return (trimmed.StartsWith('+'), new string(trimmed.Where(char.IsAsciiDigit).ToArray()));
        }
    }
}
