using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Requests
{
    /// <summary>
    /// Corps de `POST /api/reservations` et `PUT /api/reservations/{id}`. La modification ignore l'identité et la source,
    /// et exige `Version`
    /// </summary>
    public class ReservationRequest
    {
        /// <summary>Date locale du service (RES-02)</summary>
        public DateOnly ServiceDay { get; set; }
        /// <summary>Heure locale du restaurant, un créneau de `GET /api/reservations/slots`</summary>
        public TimeOnly Time { get; set; }
        public int Covers { get; set; }
        /// <summary>Minutes ; `null` prend la durée de la plage (service, sinon rotation par défaut)</summary>
        public int? Duration { get; set; }
        public string? Note { get; set; }
        public Guid? PreferredZoneId { get; set; }
        public ReservationSource Source { get; set; } = ReservationSource.Phone;
        public string? Phone { get; set; }
        public string? Name { get; set; }
        public string? Email { get; set; }
        /// <summary>La version lue avec la réservation ; obligatoire pour la modifier</summary>
        public uint? Version { get; set; }
    }
}
