using TUROAPI.Models.Enums;

namespace TUROAPI.Models.Requests
{
    /// <summary>La réponse et le rappel auquel elle répond : une réponse à un rappel qui a changé est refusée</summary>
    public class ReminderAnswerRequest
    {
        public CombinationReminderKind Kind { get; set; }
        public ReminderAnswer Answer { get; set; }
    }
}
