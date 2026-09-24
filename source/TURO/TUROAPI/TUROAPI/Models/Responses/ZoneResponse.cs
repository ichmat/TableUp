using System.ComponentModel.DataAnnotations.Schema;

namespace TUROAPI.Models.Responses
{
    public class ZoneResponse
    {
        public Guid Id { get; set; }

        public Guid RestaurantId { get; set; }

        public string Name { get; set; } = string.Empty;

        public int Order { get; set; }

        public double Width { get; set; }

        public double Height { get; set; }

        public List<TableResponse> Tables { get; set; } = [];
        public List<CombinationResponse> Combinations { get; set; } = [];
        public List<DecorResponse> Decors { get; set; } = [];
    }
}
