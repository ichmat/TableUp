using TUROAPI.Services;

namespace TUROAPI.Test
{
    /// <summary>
    /// Verdict de places (§4.3) : jamais de tolérance vers le bas, une place vide reste parfaite,
    /// au-delà de la tolérance la table reste plaçable mais déconseillée
    /// </summary>
    [TestClass]
    public sealed class PlacementVerdictTests
    {
        [TestMethod]
        [DataRow(4, 3, 2, PlacementFit.TooSmall)]
        [DataRow(6, 5, 20, PlacementFit.TooSmall)]
        [DataRow(4, 4, 2, PlacementFit.Perfect)]
        [DataRow(4, 5, 2, PlacementFit.Perfect)]
        [DataRow(4, 6, 2, PlacementFit.WithinTolerance)]
        [DataRow(4, 7, 2, PlacementFit.NotAdvised)]
        [DataRow(4, 10, 2, PlacementFit.NotAdvised)]
        [DataRow(4, 5, 1, PlacementFit.Perfect)]
        [DataRow(4, 6, 1, PlacementFit.NotAdvised)]
        [DataRow(4, 10, 6, PlacementFit.WithinTolerance)]
        public void Fit_depends_on_empty_seats_only(int covers, int capacity, int tolerance, PlacementFit expected)
        {
            Assert.AreEqual(expected, PlacementVerdict.Of(covers, capacity, tolerance));
        }
    }
}
