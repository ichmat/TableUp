namespace TUROAPI.Services
{
    /// <summary>
    /// Règles géométriques du plan (§12.1) : mètres, rotation par pas de 15°.
    /// x / y = coin haut-gauche du rectangle non tourné, la rotation se fait autour du centre.
    /// La position n'est pas tenue d'être sur la grille de 25 cm : l'éditeur colle aussi un objet au bord de son voisin
    /// </summary>
    public static class FloorPlanRules
    {
        public const double RotationStep = 15;
        private const double Epsilon = 1e-6;

        public static bool IsValidRotation(double rotation) =>
            rotation >= 0 && rotation < 360
            && Math.Abs(rotation / RotationStep - Math.Round(rotation / RotationStep)) < Epsilon;

        /// <summary>
        /// L'objet, tel qu'il est tourné (autour de son centre), tient dans la salle : on juge sa boîte englobante,
        /// la place qu'il occupe réellement à l'écran
        /// </summary>
        public static bool FitsIn(double x, double y, double width, double height, double rotation, double zoneWidth, double zoneHeight)
        {
            double radians = rotation * Math.PI / 180;
            double cos = Math.Abs(Math.Cos(radians));
            double sin = Math.Abs(Math.Sin(radians));
            double turnedWidth = width * cos + height * sin;
            double turnedHeight = width * sin + height * cos;
            double left = x + (width - turnedWidth) / 2;
            double top = y + (height - turnedHeight) / 2;
            return left >= -Epsilon && top >= -Epsilon
                && left + turnedWidth <= zoneWidth + Epsilon && top + turnedHeight <= zoneHeight + Epsilon;
        }

        public static bool AreEqual(double a, double b) => Math.Abs(a - b) < Epsilon;
    }
}
