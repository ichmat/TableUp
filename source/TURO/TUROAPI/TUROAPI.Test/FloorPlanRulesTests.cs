using TUROAPI.Services;

namespace TUROAPI.Test
{
    /// <summary>§12.1 : mètres, rotation par pas de 15° autour du centre, objet jugé sur sa boîte englobante tournée</summary>
    [TestClass]
    public sealed class FloorPlanRulesTests
    {
        [TestMethod]
        [DataRow(0d)]
        [DataRow(15d)]
        [DataRow(90d)]
        [DataRow(345d)]
        [DataRow(30.0000000001d)]
        public void Rotation_by_steps_of_15_below_360_is_valid(double rotation)
        {
            Assert.IsTrue(FloorPlanRules.IsValidRotation(rotation));
        }

        [TestMethod]
        [DataRow(-15d)]
        [DataRow(360d)]
        [DataRow(7.5d)]
        [DataRow(359.99d)]
        [DataRow(15.001d)]
        public void Other_rotations_are_invalid(double rotation)
        {
            Assert.IsFalse(FloorPlanRules.IsValidRotation(rotation));
        }

        // Salle de 8 × 6 m
        [TestMethod]
        [DataRow(0d, 0d, 8d, 6d, 0d, true)]             // la salle entière
        [DataRow(7.2d, 5.2d, 0.8d, 0.8d, 0d, true)]     // collée au coin opposé
        [DataRow(7.2000001d, 0d, 0.8d, 0.8d, 0d, true)] // bruit de calcul flottant toléré (1e-6)
        [DataRow(7.21d, 0d, 0.8d, 0.8d, 0d, false)]
        [DataRow(-0.01d, 0d, 0.8d, 0.8d, 0d, false)]
        [DataRow(0d, 0.9d, 2d, 0.4d, 90d, true)]        // tournée d'un quart : 0,4 × 2 vue d'en haut
        [DataRow(0d, 0.1d, 2d, 0.4d, 90d, false)]       // tient à plat, déborde une fois tournée
        [DataRow(1d, 1d, 2d, 0.4d, 270d, true)]         // 270° : même boîte qu'à 90°
        [DataRow(0d, 0d, 1d, 1d, 45d, false)]           // un carré à 45° occupe 1,414 m
        [DataRow(0.21d, 0.21d, 1d, 1d, 45d, true)]
        public void FitsIn_judges_the_turned_bounding_box(double x, double y, double width, double height, double rotation, bool expected)
        {
            Assert.AreEqual(expected, FloorPlanRules.FitsIn(x, y, width, height, rotation, 8, 6));
        }

        [TestMethod]
        public void AreEqual_tolerates_floating_point_noise_only()
        {
            Assert.IsTrue(FloorPlanRules.AreEqual(0.1 + 0.2, 0.3));
            Assert.IsFalse(FloorPlanRules.AreEqual(0.7, 0.71));
        }
    }
}
