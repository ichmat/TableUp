namespace TUROAPI.Models.Responses
{
    public class ClientPageResponse
    {
        public List<ClientListItemResponse> Items { get; set; } = [];
        public int Total { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }
}
