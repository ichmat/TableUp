namespace TUROAPI.Services
{
    /// <summary>
    /// Règles géométriques du plan (§12.1) : mètres, grille de 25 cm, rotation par pas de 15°.
    /// x / y = coin haut-gauche du rectangle non tourné, la rotation se fait autour du centre
    /// </summary>
    public static class FloorPlanRules
    {
        public const double GridStep = 0.25;
        public const double RotationStep = 15;
        private const double Epsilon = 1e-6;

        public static bool IsOnGrid(double value) =>
            Math.Abs(value / GridStep - Math.Round(value / GridStep)) < Epsilon;

        public static bool IsValidRotation(double rotation) =>
            rotation >= 0 && rotation < 360
            && Math.Abs(rotation / RotationStep - Math.Round(rotation / RotationStep)) < Epsilon;

        /// <summary>Le rectangle non tourné tient dans la salle</summary>
        public static bool FitsIn(double x, double y, double width, double height, double zoneWidth, double zoneHeight) =>
            x >= -Epsilon && y >= -Epsilon
            && x + width <= zoneWidth + Epsilon && y + height <= zoneHeight + Epsilon;

        public static bool AreEqual(double a, double b) => Math.Abs(a - b) < Epsilon;
    }
}
