using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Requests
{
    public class AddOrUpdateServiceRequest
    {
        public DayOfWeek Day { get; set; }
        public TimeOnly Opening { get; set; }
        public TimeOnly Closing { get; set; }
        public int SlotStep { get; set; }
        public OccupancyMode OccupancyMode { get; set; }
        public int? ExpectedDuration { get; set; }
        public int? MaxCadence { get; set; }
        public int? CoverCap { get; set; }
    }
}
