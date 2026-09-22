using Microsoft.AspNetCore.Http.HttpResults;
using System.ComponentModel.DataAnnotations.Schema;

namespace TUROAPI.Models.Responses
{
    public class CancellationConditionsResponse
    {
        public Guid Id { get; set; }

        public Guid RestaurantId { get; set; }

        public int Version { get; set; }

        public string Text { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }

        public Guid CreatedById { get; set; }
    }
}
