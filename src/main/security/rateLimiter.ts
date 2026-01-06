/**
 * Rate Limiter Security Module
 *
 * Provides a rate limiting factory function to prevent resource exhaustion attacks.
 * Includes automatic cleanup to prevent memory leaks from abandoned identifiers.
 */

/**
 * Security utility: Creates a rate limiter for IPC handlers.
 * Prevents resource exhaustion attacks by limiting the number of calls per time window.
 * Includes automatic cleanup to prevent memory leaks from abandoned identifiers.
 *
 * @param maxCalls - Maximum number of calls allowed in the time window
 * @param windowMs - Time window in milliseconds
 * @returns A function that returns true if the call is allowed, false if rate limited
 */
export const createRateLimiter = (maxCalls: number, windowMs: number) => {
  const calls = new Map<string, number[]>();
  const lastAccess = new Map<string, number>();
  const CLEANUP_INTERVAL = 60000; // 60 seconds

  // Security: Periodically remove stale entries to prevent memory leak (CRITICAL-4 fix)
  setInterval(() => {
    const now = Date.now();
    const staleIdentifiers: string[] = [];

    // Find identifiers that haven't been accessed for 2x the window time
    for (const [identifier, lastAccessTime] of lastAccess.entries()) {
      if (now - lastAccessTime > windowMs * 2) {
        staleIdentifiers.push(identifier);
      }
    }

    // Remove stale entries from both maps
    for (const identifier of staleIdentifiers) {
      calls.delete(identifier);
      lastAccess.delete(identifier);
    }

    if (staleIdentifiers.length > 0) {
      console.log(`Rate limiter cleanup: removed ${staleIdentifiers.length} stale entries`);
    }
  }, CLEANUP_INTERVAL);

  return (identifier: string): boolean => {
    const now = Date.now();
    const timestamps = calls.get(identifier) || [];

    // Security: Track last access time for cleanup (CRITICAL-4 fix)
    lastAccess.set(identifier, now);

    // Remove old timestamps outside the time window
    const recentCalls = timestamps.filter((t) => now - t < windowMs);

    if (recentCalls.length >= maxCalls) {
      return false; // Rate limit exceeded
    }

    recentCalls.push(now);
    calls.set(identifier, recentCalls);
    return true; // Allow
  };
};
