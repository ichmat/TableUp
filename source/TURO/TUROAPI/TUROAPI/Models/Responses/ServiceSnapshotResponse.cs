using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Responses
{
    /// <summary>L'écran Service (§5) : un service, ses créneaux, ses salles et ce qui occupe chaque table</summary>
    public class ServiceSnapshotResponse
    {
        /// <summary>Jour de service affiché, même sans service (jour fermé)</summary>
        public DateOnly Day { get; set; }
        /// <summary>L'horloge de l'API, UTC</summary>
        public DateTime Now { get; set; }
        public bool TrackTableCleaning { get; set; }
        public int LateGrace { get; set; }
        /// <summary>Le service affiché est celui de l'appel sans paramètre : sinon le front propose « Aujourd'hui »</summary>
        public bool IsDefault { get; set; }
        public ServiceInfoResponse? Service { get; set; }
        public List<ServiceWindowStateResponse> Windows { get; set; } = [];
        public List<ServiceSlotResponse> Slots { get; set; } = [];
        public List<ServiceZoneResponse> Zones { get; set; } = [];
        public List<ServiceReservationResponse> ToPlace { get; set; } = [];
        public List<ServiceReservationResponse> Pending { get; set; } = [];
        public List<ServiceAllergyResponse> Allergies { get; set; } = [];
    }

    public class ServiceInfoResponse
    {
        public TimeOnly Opening { get; set; }
        public TimeOnly Closing { get; set; }
        public int SlotStep { get; set; }
        public ServiceState State { get; set; }
        /// <summary>Couverts confirmés, assis et terminés</summary>
        public int ExpectedCovers { get; set; }
        /// <summary>Places des tables actives, toutes salles</summary>
        public int Capacity { get; set; }
        /// <summary>La durée d'un repas de cette plage, en minutes : la bulle du walk-in s'en sert avant l'appel</summary>
        public int DefaultDuration { get; set; }
    }

    public class ServiceWindowStateResponse
    {
        public TimeOnly Opening { get; set; }
        public TimeOnly Closing { get; set; }
        public ServiceState State { get; set; }
        public int ExpectedCovers { get; set; }
    }

    public class ServiceSlotResponse
    {
        public TimeOnly Time { get; set; }
        /// <summary>L'instant UTC du créneau : le front ne calcule aucun fuseau</summary>
        public DateTime At { get; set; }
        public int Covers { get; set; }
        public int TakenTables { get; set; }
        public bool HasUnplaced { get; set; }
    }

    public class ServiceZoneResponse
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public double Width { get; set; }
        public double Height { get; set; }
        public List<ServiceTableResponse> Tables { get; set; } = [];
        public List<DecorResponse> Decors { get; set; } = [];
        public List<CombinationResponse> Combinations { get; set; } = [];
    }

    public class ServiceTableResponse
    {
        public Guid Id { get; set; }
        public Guid ZoneId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public TableShape Shape { get; set; }
        public double X { get; set; }
        public double Y { get; set; }
        public double Width { get; set; }
        public double Height { get; set; }
        public double Rotation { get; set; }
        public DateTime? NeedsCleaningSince { get; set; }
        public List<ServiceOccupationResponse> Occupations { get; set; } = [];
    }

    public class ServiceOccupationResponse
    {
        public Guid ReservationId { get; set; }
        public DateTime Start { get; set; }
        public DateTime End { get; set; }
        public ReservationStatus Status { get; set; }
        /// <summary>`Start + LateGrace` pour une confirmée ; null sinon</summary>
        public DateTime? LateFrom { get; set; }
        /// <summary>La table ou la combinaison affectée : « 12-13 »</summary>
        public string PlaceName { get; set; } = string.Empty;
        /// <summary>Null : client de passage</summary>
        public string? GuestName { get; set; }
        public int Covers { get; set; }
        public bool HasAllergy { get; set; }
    }

    public class ServiceReservationResponse
    {
        public Guid Id { get; set; }
        public DateTime Start { get; set; }
        public int Covers { get; set; }
        public ReservationSource Source { get; set; }
        public ReservationListClientResponse? Client { get; set; }
    }

    public class ServiceAllergyResponse
    {
        public Guid ReservationId { get; set; }
        public DateTime Start { get; set; }
        public string? GuestName { get; set; }
        public string Allergies { get; set; } = string.Empty;
        /// <summary>Null : « À placer »</summary>
        public string? PlaceName { get; set; }
    }
}
