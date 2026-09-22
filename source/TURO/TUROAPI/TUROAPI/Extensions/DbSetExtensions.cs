using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

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
    }
}
