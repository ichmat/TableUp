using System.Text;

namespace TUROAPI.Services
{
    /// <summary>Export CSV pour Excel en français : `;` comme séparateur, UTF-8 avec BOM, échappement RFC 4180</summary>
    public static class ClientCsv
    {
        public static string Escape(string? value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return string.Empty;
            }
            // OWASP : une cellule qui commence par = + - @ serait exécutée comme une formule par Excel
            if ("=+-@\t\r".Contains(value[0]))
            {
                value = "'" + value;
            }
            return value.IndexOfAny([';', '"', '\n', '\r']) < 0
                ? value
                : $"\"{value.Replace("\"", "\"\"")}\"";
        }

        public static byte[] Build(IEnumerable<string[]> rows)
        {
            var text = new StringBuilder();
            foreach (string[] row in rows)
            {
                text.Append(string.Join(';', row.Select(Escape))).Append("\r\n");
            }
            return [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(text.ToString())];
        }
    }
}
