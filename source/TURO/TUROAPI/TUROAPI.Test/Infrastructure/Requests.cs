namespace TUROAPI.Test.Infrastructure
{
    /// <summary>Corps de requête valides par défaut, qu'un test abîme sur un seul point</summary>
    public static class Requests
    {
        public static AddOrUpdateServiceRequest Service(DayOfWeek day, int openingHour, int closingHour, int slotStep = 30) => new()
        {
            Day = day,
            Opening = new TimeOnly(openingHour, 0),
            Closing = new TimeOnly(closingHour, 0),
            SlotStep = slotStep,
            OccupancyMode = OccupancyMode.Rotation,
        };

        public static AddOrUpdateClosureRequest Closed(DateOnly from, DateOnly to, params Guid[] cancelledReservationIds) => new()
        {
            From = from,
            To = to,
            Type = ClosureType.Closed,
            Reason = ClosureReason.Private,
            CancelledReservationIds = [.. cancelledReservationIds],
        };

        public static AddOrUpdateClosureRequest ModifiedHours(DateOnly from, DateOnly to,
            (TimeOnly Opening, TimeOnly Closing)[] hours, params Guid[] cancelledReservationIds) => new()
        {
            From = from,
            To = to,
            Type = ClosureType.ModifiedHours,
            Reason = ClosureReason.Works,
            ReplacementHours = hours.Select(h => new ReplacementHoursRequest { Opening = h.Opening, Closing = h.Closing }).ToList(),
            CancelledReservationIds = [.. cancelledReservationIds],
        };
    }
}
