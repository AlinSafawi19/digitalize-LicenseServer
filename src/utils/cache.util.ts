import NodeCache from 'node-cache';
import { logger } from './logger';

/**
 * Cache utility for in-memory caching
 * Performance optimization: Reduces database load by caching frequently accessed data
 * 
 * Cache TTLs:
 * - License lookups: 5 minutes (license data changes infrequently)
 * - Dashboard stats: 5 minutes (stats change infrequently, cache invalidation on mutations)
 * - Search results: 5 minutes (search results can be cached for a short time)
 */
class CacheService {
  private cache: NodeCache;

  constructor() {
    // Create cache instance with default TTL of 5 minutes
    // stdTTL: Time to live in seconds for all generated keys
    // checkperiod: Interval in seconds to check for expired keys
    // maxKeys: Maximum number of keys in cache (prevents memory issues)
    this.cache = new NodeCache({
      stdTTL: 300, // 5 minutes default
      checkperiod: 60, // Check for expired keys every minute
      useClones: false, // Better performance, but be careful with object mutations
      maxKeys: 10000, // Limit cache size to prevent memory issues (performance optimization)
    });

    // Log cache statistics periodically in development
    if (process.env.NODE_ENV === 'development') {
      setInterval(() => {
        const stats = this.cache.getStats();
        if (stats.keys > 0) {
          logger.debug('Cache statistics', {
            keys: stats.keys,
            hits: stats.hits,
            misses: stats.misses,
            hitRate: stats.hits / (stats.hits + stats.misses) || 0,
          });
        }
      }, 60000); // Every minute
    }
  }

  /**
   * Get value from cache
   * @param key Cache key
   * @returns Cached value or undefined if not found
   */
  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);
    if (value !== undefined) {
      logger.debug('Cache hit', { key });
    }
    return value;
  }

  /**
   * Set value in cache with optional TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in seconds (optional, uses default if not provided)
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    // Only pass ttl if it's defined, otherwise use default TTL
    const success = ttl !== undefined 
      ? this.cache.set(key, value, ttl)
      : this.cache.set(key, value);
    if (success) {
      logger.debug('Cache set', { key, ttl: ttl ?? 'default' });
    }
    return success;
  }

  /**
   * Delete value from cache
   * @param key Cache key
   */
  del(key: string): number {
    const deleted = this.cache.del(key);
    if (deleted > 0) {
      logger.debug('Cache deleted', { key });
    }
    return deleted;
  }

  /**
   * Delete multiple keys matching a pattern
   * Performance optimization: Batch deletions and limit iteration to prevent O(n) performance issues
   * @param pattern Pattern to match (supports wildcards)
   */
  delPattern(pattern: string): number {
    const keys = this.cache.keys();
    
    // Performance optimization: For very large caches, warn and consider alternative approach
    if (keys.length > 10000) {
      logger.warn('Cache pattern deletion on large cache may be slow', {
        pattern,
        keyCount: keys.length,
        suggestion: 'Consider using Redis for production with high cache volumes',
      });
    }
    
    // Performance: Pre-compile regex and collect keys to delete first (avoids multiple regex tests)
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const keysToDelete: string[] = [];
    
    // First pass: collect matching keys (more efficient than deleting one by one)
    for (let i = 0; i < keys.length; i++) {
      if (regex.test(keys[i])) {
        keysToDelete.push(keys[i]);
      }
    }
    
    // Second pass: batch delete all matching keys
    // Performance: Batch deletion is more efficient than individual deletions
    let deleted = 0;
    for (let i = 0; i < keysToDelete.length; i++) {
      if (this.cache.del(keysToDelete[i])) {
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.debug('Cache pattern deleted', { pattern, deleted, totalKeys: keys.length });
    }

    return deleted;
  }

  /**
   * Clear all cache
   */
  flush(): void {
    this.cache.flushAll();
    logger.debug('Cache flushed');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }
}

// Export singleton instance
export const cacheService = new CacheService();

/**
 * Cache key generators for consistent key naming
 */
export const CacheKeys = {
  license: (licenseKey: string) => `license:${licenseKey.toLowerCase().trim()}`,
  licenseById: (id: number) => `license:id:${id}`,
  dashboardStats: () => 'stats:dashboard',
  searchResults: (query: string, filters: string) => `search:${query}:${filters}`,
} as const;

