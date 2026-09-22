namespace TUROAPI.Models.Responses
{
    public class RestaurantReponses
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;

        public string TimeZone { get; set; } = string.Empty;

        public int DefaultRotation { get; set; }

        public int SeatTolerance { get; set; }

        public int LateGrace { get; set; }

        public bool ReminderEnabled { get; set; }
        public int ReminderDelayHours { get; set; }

        public bool AutoConfirmation { get; set; }

        public List<ZoneResponse> Zones { get; set; } = [];
        public List<ServiceResponse> Services { get; set; } = [];
        public List<CancellationConditionsResponse> CancellationConditions { get; set; } = [];
        public List<UserStaffResponse> Users { get; set; } = [];
    }
}
