using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Responses
{
    public class ClosureResponse
    {
        public Guid Id { get; set; }
        public Guid RestaurantId { get; set; }
        public DateOnly From { get; set; }
        public DateOnly To { get; set; }
        public ClosureType Type { get; set; }
        public List<ReplacementHoursResponse>? ReplacementHours { get; set; }
        public ClosureReason Reason { get; set; }
        public string? ReasonDetail { get; set; }
        public string? CustomerMessage { get; set; }
    }

    public class ReplacementHoursResponse
    {
        public TimeOnly Opening { get; set; }
        public TimeOnly Closing { get; set; }
    }
}
