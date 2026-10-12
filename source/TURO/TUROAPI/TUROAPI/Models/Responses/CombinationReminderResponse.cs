using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Responses
{
    /// <summary>GET /api/service/reminders : un rappel par combinaison, jamais expiré (COMB-06)</summary>
    public class CombinationReminderResponse
    {
        public Guid CombinationId { get; set; }
        public string Name { get; set; } = string.Empty;
        public CombinationReminderKind Kind { get; set; }
        /// <summary>UTC : le rappel s'affiche à partir de cet instant</summary>
        public DateTime DueAt { get; set; }
        public List<Guid> TableIds { get; set; } = [];
        public List<string> TableNames { get; set; } = [];
        /// <summary>Celle qui attend le rapprochement, celle qui réclame une table, ou celle du no-show</summary>
        public ReminderReservationResponse? Reservation { get; set; }
        /// <summary>« Oui, c'est fait » sépare ces combinaisons collées, qui partagent une table (COMB-04)</summary>
        public List<string> Separates { get; set; } = [];
    }

    public class ReminderReservationResponse
    {
        public Guid Id { get; set; }
        public DateTime Start { get; set; }
        /// <summary>`null` : client de passage</summary>
        public string? GuestName { get; set; }
        public int Covers { get; set; }
    }
}
