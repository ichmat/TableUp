using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Responses
{
    public class UserStaffResponse
    {
        public Guid Id { get; set; }

        public Guid RestaurantId { get; set; }

        public UserRole Role { get; set; }
    }
}
