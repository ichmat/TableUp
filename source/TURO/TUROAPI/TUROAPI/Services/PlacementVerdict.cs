using TUROAPI.Models.Enums;

namespace TUROAPI.Services
{
    /// <summary>
    /// La règle de places du placement (§4.3), seule autorité : l'aperçu des Paramètres et le futur moteur la partagent.
    /// Elle ne regarde que les places ; l'occupation, la zone et la propreté relèvent du moteur
    /// </summary>
    public static class PlacementVerdict
    {
        // Une place vide ne se discute pas : fixe, ce n'est pas un réglage
        public const int BaseTolerance = 1;

        public static PlacementFit Of(int covers, int capacity, int tolerance)
        {
            int emptySeats = capacity - covers;
            if (emptySeats < 0)
            {
                return PlacementFit.TooSmall;
            }
            if (emptySeats <= BaseTolerance)
            {
                return PlacementFit.Perfect;
            }
            return emptySeats <= tolerance ? PlacementFit.WithinTolerance : PlacementFit.NotAdvised;
        }
    }
}
