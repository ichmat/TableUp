using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;
using TUROAPI.Models.Enums;

namespace TUROAPI.Extensions
{
    public static class DbSetExtensions
    {
        public static void AddRangeIfNotExists<T>(this DbSet<T> dbSet, Expression<Func<T, bool>> comparison, IEnumerable<T> entities) where T : class
        {
            foreach (var entity in entities)
            {
                if (!dbSet.Any(comparison))
                {
                    dbSet.Add(entity);
                }
            }
        }

        public static void AddRangeIfNotExists<T>(this DbSet<T> dbSet, Expression<Func<T, bool>> comparison, params T[] entities) where T : class
        {
            foreach (var entity in entities)
            {
                if (!dbSet.Any(comparison))
                {
                    dbSet.Add(entity);
                }
            }
        }

        public static Task<T> GetOrThrowAsync<T>(this DbSet<T> dbSet, Expression<Func<T, bool>> predicate, string? errorMessage = null) where T : class
        {
            return dbSet.FirstOrDefaultAsync(predicate).ContinueWith(task =>
            {
                var result = task.Result;
                if (result == null)
                {
                    throw new ApiErrorException(ApiError.NotFound, errorMessage ?? $"{typeof(T).Name} not found.");
                }
                return result;
            });
        }
    }
}
