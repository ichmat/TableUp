using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Requests
{
    public class AddOrUpdateClosureRequest
    {
        public DateOnly From { get; set; }
        public DateOnly To { get; set; }
        public ClosureType Type { get; set; }

        // Required for ModifiedHours, ignored for Closed
        public List<ReplacementHoursRequest>? ReplacementHours { get; set; }

        public ClosureReason Reason { get; set; }
        public string? ReasonDetail { get; set; }
        public string? CustomerMessage { get; set; }

        // Impacted reservations the restaurant agreed to cancel (§9.5 « Fermer, je les appelle »)
        public List<Guid> CancelledReservationIds { get; set; } = [];
    }

    public class ReplacementHoursRequest
    {
        public TimeOnly Opening { get; set; }
        public TimeOnly Closing { get; set; }
    }
}
