using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using TUROAPI.Context;
using TUROAPI.Models;
using TUROAPI.Models.Requests;
using TUROAPI.Models.Wrapper;

namespace TUROAPI.Services
{
    /// <summary>
    /// Ce que le service change au plan publié (positions, tables collées, combinaison née d'un dépôt) passe aussi dans le
    /// brouillon de l'éditeur, s'il y en a un : sinon sa publication le déferait. L'appelant fait le `SaveChanges`
    /// </summary>
    public static class DraftSync
    {
        public static async Task ApplyAsync(TuroDBContext context, Guid restaurantId, Action<FloorPlanDraftContent> change)
        {
            FloorPlanDraft? draft = await context.FloorPlanDrafts.FirstOrDefaultAsync(d => d.RestaurantId == restaurantId);
            if (draft == null)
            {
                return;
            }
            FloorPlanDraftContent content = draft.ReadContent();
            change(content);
            draft.Content = JsonSerializer.Serialize(content, ModelWrapper.DraftJsonOptions);
        }
    }
}
