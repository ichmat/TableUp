using Microsoft.EntityFrameworkCore;

namespace TUROAPI.Extensions
{
    public static class DbSetExtensions
    {
        public static void AddRangeIfNotExists<T>(this DbSet<T> dbSet, Func<T, T, bool> comparison, IEnumerable<T> entities) where T : class
        {
            foreach (var entity in entities)
            {
                if (!dbSet.Any(x => comparison(x, entity)))
                {
                    dbSet.Add(entity);
                }
            }
        }

        public static void AddRangeIfNotExists<T>(this DbSet<T> dbSet, Func<T, T, bool> comparison, params T[] entities) where T : class
        {
            foreach (var entity in entities)
            {
                if (!dbSet.Any(x => comparison(x, entity)))
                {
                    dbSet.Add(entity);
                }
            }
        }
    }
}
