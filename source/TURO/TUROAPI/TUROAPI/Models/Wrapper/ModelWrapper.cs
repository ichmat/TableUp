using TUROAPI.Models.Responses;

namespace TUROAPI.Models.Wrapper
{
    public static class ModelWrapper
    {
        public static UserStaffResponse ToResponse(this UserStaff user)
        {
            return new UserStaffResponse
            {
                Id = user.Id,
                RestaurantId = user.RestaurantId,
                Role = user.Role
            };
        }

        public static CancellationConditionsResponse ToResponse(this CancellationConditions condition)
        {
            return new CancellationConditionsResponse
            {
                Id = condition.Id,
                RestaurantId = condition.RestaurantId,
                Version = condition.Version,
                Text = condition.Text,
                CreatedAt = condition.CreatedAt,
                CreatedById = condition.CreatedById
            };
        }

        public static ServiceResponse ToResponse(this Service service)
        {
            return new ServiceResponse
            {
                Id = service.Id,
                RestaurantId = service.RestaurantId,
                Day = service.Day,
                Opening = service.Opening,
                Closing = service.Closing,
                SlotStep = service.SlotStep,
                OccupancyMode = service.OccupancyMode,
                ExpectedDuration = service.ExpectedDuration,
                MaxCadence = service.MaxCadence,
                CoverCap = service.CoverCap
            };
        }

        public static ZoneResponse ToResponse(this Zone zone)
        {
            return new ZoneResponse
            {
                Id = zone.Id,
                RestaurantId = zone.RestaurantId,
                Name = zone.Name,
                Order = zone.Order,
                Width = zone.Width,
                Height = zone.Height,
                Tables = zone.Tables.Select(t => t.ToResponse()).ToList(),
                Combinations = zone.Combinations.Select(c => c.ToResponse()).ToList(),
                Decors = zone.Decors.Select(d => d.ToResponse()).ToList()
            };
        }

        public static TableResponse ToResponse(this Table table)
        {
            return new TableResponse
            {
                Id = table.Id,
                ZoneId = table.ZoneId,
                Name = table.Name,
                Capacity = table.Capacity,
                Shape = table.Shape,
                X = table.X,
                Y = table.Y,
                Width = table.Width,
                Height = table.Height,
                Rotation = table.Rotation,
                NeedsCleaningSince = table.NeedsCleaningSince,
                IsActive = table.IsActive
            };
        }

        public static CombinationResponse ToResponse(this Combination combination)
        {
            return new CombinationResponse
            {
                Id = combination.Id,
                ZoneId = combination.ZoneId,
                Name = combination.Name,
                Capacity = combination.Capacity,
                Tables = combination.Tables.Select(t => t.ToResponse()).ToList(),
                IsActive = combination.IsActive,
                ActivateAt = combination.ActivateAt,
                DeactivateAt = combination.DeactivateAt
            };
        }

        public static DecorResponse ToResponse(this Decor decor)
        {
            return new DecorResponse
            {
                Id = decor.Id,
                ZoneId = decor.ZoneId,
                Type = decor.Type,
                Label = decor.Label,
                X = decor.X,
                Y = decor.Y,
                Width = decor.Width,
                Height = decor.Height,
                Rotation = decor.Rotation
            };
        }

        public static RestaurantReponses ToResponse(this Restaurant restaurant)
        {
            return new RestaurantReponses
            {
                Id = restaurant.Id,
                Name = restaurant.Name,
                TimeZone = restaurant.TimeZone,
                DefaultRotation = restaurant.DefaultRotation,
                SeatTolerance = restaurant.SeatTolerance,
                LateGrace = restaurant.LateGrace,
                ReminderEnabled = restaurant.ReminderEnabled,
                ReminderDelayHours = restaurant.ReminderDelayHours,
                AutoConfirmation = restaurant.AutoConfirmation,
                Zones = restaurant.Zones.Select(z => z.ToResponse()).ToList(),
                Services = restaurant.Services.Select(s => s.ToResponse()).ToList(),
                CancellationConditions = restaurant.CancellationConditions.Select(c => c.ToResponse()).ToList(),
                Users = restaurant.Users.Select(u => u.ToResponse()).ToList()
            };
        }
    }

}