/**
 * IPC Validation Wrapper
 *
 * Provides a generic wrapper for IPC handlers with standard security checks:
 * - IPC origin validation (verifies sender is from a known BrowserWindow)
 * - Rate limiting (prevents resource exhaustion attacks)
 * - Error handling (consistent error responses)
 *
 * This module consolidates repetitive security boilerplate from individual
 * IPC handlers into a reusable wrapper function.
 */

import { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { SECURITY_CONFIG } from '../../constants/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Standard IPC result type for handlers that return success/error responses.
 */
export type IPCResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Configuration options for the IPC handler wrapper.
 */
export type IPCHandlerConfig = {
  /** Handler name for rate limiting and logging (e.g., 'close-window') */
  handlerName: string;
  /** Skip IPC origin validation (default: false) */
  skipOriginCheck?: boolean;
  /** Skip rate limiting (default: false) */
  skipRateLimit?: boolean;
};

// ============================================================================
// Security Utilities (inline for now, will be extracted in Phase 3)
// ============================================================================

/**
 * Security utility: Validates that an IPC event originated from a known BrowserWindow.
 * Prevents unauthorized IPC calls from external processes or compromised contexts.
 *
 * @param event - The IPC event to validate
 * @returns true if the sender is from a known window, false otherwise
 */
export const isValidIPCOrigin = (event: IpcMainInvokeEvent): boolean => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);

    // Verify sender is associated with a valid BrowserWindow we created
    if (!senderWindow || senderWindow.isDestroyed()) {
      console.error('IPC call from invalid or destroyed window');
      return false;
    }

    // Verify the window is in our list of known windows
    const allWindows = BrowserWindow.getAllWindows();
    if (!allWindows.includes(senderWindow)) {
      console.error('IPC call from unknown window');
      return false;
    }

    return true;
  } catch (error) {
    console.error('IPC origin validation error:', error);
    return false;
  }
};

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

// Create a shared rate limiter instance using security config
const sharedRateLimiter = createRateLimiter(
  SECURITY_CONFIG.RATE_LIMIT.MAX_CALLS,
  SECURITY_CONFIG.RATE_LIMIT.WINDOW_MS
);

// ============================================================================
// IPC Handler Wrapper
// ============================================================================

/**
 * Wraps an IPC handler with standard security checks.
 *
 * This wrapper provides:
 * 1. IPC origin validation - ensures the request comes from a known BrowserWindow
 * 2. Rate limiting - prevents DoS attacks via rapid repeated calls
 * 3. Consistent error handling - returns standardized error responses
 *
 * @param config - Configuration for the handler (name, optional skip flags)
 * @param handler - The actual handler function to wrap
 * @returns A wrapped handler function suitable for ipcMain.handle()
 *
 * @example
 * // Handler that returns void
 * ipcMain.handle('close-window',
 *   withIPCHandler<void, void>(
 *     { handlerName: 'close-window' },
 *     async (_, event) => {
 *       const win = BrowserWindow.fromWebContents(event.sender);
 *       if (win) win.close();
 *     }
 *   )
 * );
 *
 * @example
 * // Handler that returns data
 * ipcMain.handle('get-data',
 *   withIPCHandler<{ id: string }, { name: string }>(
 *     { handlerName: 'get-data' },
 *     async (data) => {
 *       return { name: lookupName(data.id) };
 *     }
 *   )
 * );
 */
export function withIPCHandler<TInput, TOutput>(
  config: IPCHandlerConfig,
  handler: (data: TInput, event: IpcMainInvokeEvent) => Promise<TOutput> | TOutput
): (event: IpcMainInvokeEvent, data: unknown) => Promise<IPCResult<TOutput>> {
  const { handlerName, skipOriginCheck = false, skipRateLimit = false } = config;

  return async (event: IpcMainInvokeEvent, data: unknown): Promise<IPCResult<TOutput>> => {
    // Security: Validate IPC origin (CRITICAL-5 fix)
    if (!skipOriginCheck && !isValidIPCOrigin(event)) {
      console.warn(`Rejected ${handlerName} from invalid origin`);
      return { success: false, error: 'Invalid IPC origin' };
    }

    // Security: Apply rate limiting
    if (!skipRateLimit) {
      const senderId = event.sender.id.toString();
      if (!sharedRateLimiter(`${senderId}-${handlerName}`)) {
        console.warn(`Rate limit exceeded for ${handlerName}`);
        return { success: false, error: 'Rate limit exceeded' };
      }
    }

    try {
      // Execute the actual handler
      const result = await handler(data as TInput, event);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error in ${handlerName}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  };
}

/**
 * Simplified wrapper for handlers that don't need input data.
 * Useful for simple commands like close-window that only need the event.
 *
 * @param config - Configuration for the handler
 * @param handler - Handler function that only receives the event
 * @returns A wrapped handler function
 *
 * @example
 * ipcMain.handle('close-window',
 *   withIPCHandlerNoInput<void>(
 *     { handlerName: 'close-window' },
 *     async (event) => {
 *       const win = BrowserWindow.fromWebContents(event.sender);
 *       if (win) win.close();
 *     }
 *   )
 * );
 */
export function withIPCHandlerNoInput<TOutput>(
  config: IPCHandlerConfig,
  handler: (event: IpcMainInvokeEvent) => Promise<TOutput> | TOutput
): (event: IpcMainInvokeEvent) => Promise<IPCResult<TOutput>> {
  const { handlerName, skipOriginCheck = false, skipRateLimit = false } = config;

  return async (event: IpcMainInvokeEvent): Promise<IPCResult<TOutput>> => {
    // Security: Validate IPC origin (CRITICAL-5 fix)
    if (!skipOriginCheck && !isValidIPCOrigin(event)) {
      console.warn(`Rejected ${handlerName} from invalid origin`);
      return { success: false, error: 'Invalid IPC origin' };
    }

    // Security: Apply rate limiting
    if (!skipRateLimit) {
      const senderId = event.sender.id.toString();
      if (!sharedRateLimiter(`${senderId}-${handlerName}`)) {
        console.warn(`Rate limit exceeded for ${handlerName}`);
        return { success: false, error: 'Rate limit exceeded' };
      }
    }

    try {
      // Execute the actual handler
      const result = await handler(event);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error in ${handlerName}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  };
}

/**
 * Type guard to check if a result is successful.
 * Useful for narrowing the IPCResult type in calling code.
 */
export function isIPCSuccess<T>(result: IPCResult<T>): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Type guard to check if a result is an error.
 */
export function isIPCError<T>(result: IPCResult<T>): result is { success: false; error: string } {
  return result.success === false;
}
