/**
 * IPC Validation Wrapper
 *
 * Provides a generic wrapper for IPC handlers with standard security checks:
 * - IPC origin validation (verifies sender is from a known BrowserWindow)
 * - Rate limiting (prevents resource exhaustion attacks)
 * - Zod schema validation (runtime type checking with descriptive errors)
 * - Error handling (consistent error responses)
 *
 * This module consolidates repetitive security boilerplate from individual
 * IPC handlers into a reusable wrapper function.
 */

import { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { z, ZodSchema, ZodError } from 'zod';
import { SECURITY_CONFIG } from '../../constants/index.js';
import { createRateLimiter } from './rateLimiter.js';

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

/**
 * Configuration options for the Zod-validated IPC handler wrapper.
 */
export type IPCHandlerWithSchemaConfig<TSchema extends ZodSchema> = {
  /** Zod schema for validating the input data */
  schema: TSchema;
  /** Handler name for rate limiting and logging (e.g., 'save-file') */
  handlerName: string;
  /** Skip IPC origin validation (default: false) */
  skipOriginCheck?: boolean;
  /** Skip rate limiting (default: false) */
  skipRateLimit?: boolean;
};

/**
 * Formats Zod validation errors into a human-readable string.
 * @param error - The ZodError to format
 * @returns A string describing the validation failures
 */
const formatZodError = (error: ZodError): string => {
  const issues = error.issues.map(issue => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });
  return `Validation failed: ${issues.join('; ')}`;
};

// ============================================================================
// Security Utilities
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

// ============================================================================
// Zod-Validated IPC Handler Wrapper
// ============================================================================

/**
 * Wraps an IPC handler with Zod schema validation and standard security checks.
 *
 * This wrapper provides:
 * 1. Zod schema validation - ensures input data matches expected structure
 * 2. IPC origin validation - ensures the request comes from a known BrowserWindow
 * 3. Rate limiting - prevents DoS attacks via rapid repeated calls
 * 4. Consistent error handling - returns standardized error responses
 *
 * @param config - Configuration including the Zod schema and handler options
 * @param handler - The actual handler function to wrap (receives validated data)
 * @returns A wrapped handler function suitable for ipcMain.handle()
 *
 * @example
 * import { SaveFileDataSchema } from '../../types/ipc-schemas.js';
 *
 * ipcMain.handle('save-file',
 *   withValidatedIPCHandler(
 *     { schema: SaveFileDataSchema, handlerName: 'save-file' },
 *     async (data, event) => {
 *       // data is typed as z.infer<typeof SaveFileDataSchema>
 *       // { content: string, filename: string, filePath: string | null }
 *       return { filePath: savedPath };
 *     }
 *   )
 * );
 */
export function withValidatedIPCHandler<TSchema extends ZodSchema, TOutput>(
  config: IPCHandlerWithSchemaConfig<TSchema>,
  handler: (data: z.infer<TSchema>, event: IpcMainInvokeEvent) => Promise<TOutput> | TOutput
): (event: IpcMainInvokeEvent, data: unknown) => Promise<IPCResult<TOutput>> {
  const { schema, handlerName, skipOriginCheck = false, skipRateLimit = false } = config;

  return async (event: IpcMainInvokeEvent, data: unknown): Promise<IPCResult<TOutput>> => {
    // Security: Validate IPC origin (CRITICAL-5 fix)
    if (!skipOriginCheck && !isValidIPCOrigin(event)) {
      console.warn(`[SECURITY] Rejected ${handlerName} from invalid origin`);
      return { success: false, error: 'Invalid IPC origin' };
    }

    // Security: Apply rate limiting
    if (!skipRateLimit) {
      const senderId = event.sender.id.toString();
      if (!sharedRateLimiter(`${senderId}-${handlerName}`)) {
        console.warn(`[SECURITY] Rate limit exceeded for ${handlerName}`);
        return { success: false, error: 'Rate limit exceeded' };
      }
    }

    // Security: Validate input data with Zod schema
    const parseResult = schema.safeParse(data);
    if (!parseResult.success) {
      const errorMessage = formatZodError(parseResult.error);
      console.warn(`[SECURITY] Validation failed for ${handlerName}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }

    try {
      // Execute the actual handler with validated data
      const result = await handler(parseResult.data, event);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error in ${handlerName}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  };
}
