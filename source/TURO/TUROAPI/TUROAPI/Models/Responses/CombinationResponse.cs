using System.ComponentModel.DataAnnotations.Schema;

namespace TUROAPI.Models.Responses
{
    public class CombinationResponse
    {
        public Guid Id { get; set; }

        public Guid ZoneId { get; set; }

        public string Name { get; set; } = string.Empty;

        public int Capacity { get; set; }

        public List<TableResponse> Tables { get; set; } = [];

        public bool IsActive { get; set; }

        public DateTime? ActivateAt { get; set; }

        public DateTime? DeactivateAt { get; set; }
    }
}
