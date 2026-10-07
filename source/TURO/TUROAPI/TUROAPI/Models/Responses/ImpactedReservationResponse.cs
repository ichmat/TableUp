namespace TUROAPI.Models.Responses
{
    // A reservation a closure would leave without service, with what is needed to call the client (§9.5)
    public class ImpactedReservationResponse
    {
        public Guid Id { get; set; }
        public DateOnly ServiceDay { get; set; }

        // Restaurant local time
        public TimeOnly LocalStart { get; set; }

        public int Covers { get; set; }

        // Null for a walk-in
        public string? ClientName { get; set; }
        public string? ClientPhone { get; set; }

        public List<string> Tables { get; set; } = [];
    }
}
