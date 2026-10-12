namespace TUROAPI.Services
{
    /// <summary>« 12-13 » : le nom proposé d'une combinaison, ses tables dans l'ordre naturel (RAPP-04), comme l'éditeur</summary>
    public static class CombinationNames
    {
        private static readonly Comparer<string> Natural = Comparer<string>.Create((a, b) =>
            int.TryParse(a, out int x) && int.TryParse(b, out int y) ? x.CompareTo(y) : string.Compare(a, b, StringComparison.OrdinalIgnoreCase));

        public static string Default(IEnumerable<string> names) =>
            string.Join("-", names.Select(n => n.Trim()).OrderBy(n => n, Natural));
    }
}
