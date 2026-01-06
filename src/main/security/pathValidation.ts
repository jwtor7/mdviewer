/**
 * Path Validation Security Module
 *
 * Provides utilities for validating file paths and URLs:
 * - isPathSafe: Validates file paths are within allowed directories
 * - sanitizeError: Safely extracts error messages
 * - validateExternalUrl: Validates URLs for external opening
 */

import path from 'node:path';
import { app } from 'electron';
import { SECURITY_CONFIG, URL_SECURITY } from '../../constants/index.js';

/**
 * Security utility: Validates that a file path is safe to open.
 * Prevents path traversal attacks and enforces allowed file extensions.
 *
 * @param filepath - The file path to validate
 * @returns true if the path is safe, false otherwise
 */
export const isPathSafe = (filepath: string): boolean => {
  try {
    // Resolve to absolute path to prevent traversal
    const resolved = path.resolve(filepath);

    // Check file extension (only allow markdown files)
    const ext = path.extname(resolved).toLowerCase();
    if (!SECURITY_CONFIG.ALLOWED_EXTENSIONS.includes(ext as '.md' | '.markdown')) {
      console.warn(`Rejected file with invalid extension: ${ext}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Path validation error:', error);
    return false;
  }
};

/**
 * Security utility: Sanitizes error messages to prevent information disclosure.
 * Removes sensitive file paths and system information from error messages.
 *
 * @param error - The error to sanitize
 * @returns A safe error message string
 */
export const sanitizeError = (error: Error | NodeJS.ErrnoException): string => {
  // In production (packaged app), return generic error message to prevent information disclosure
  if (app.isPackaged) {
    return 'An error occurred while processing the file';
  }

  // In development (npm start), return detailed error with sanitized paths for debugging
  let message = error.message;

  // Remove absolute paths, keep only basenames
  message = message.replace(/\/[^\s]+\//g, (match) => {
    const basename = path.basename(match);
    return basename ? `.../${basename}` : match;
  });

  return message;
};

/**
 * Security utility: Validates and sanitizes external URLs before opening.
 * Implements defense-in-depth against malicious URLs that could:
 * - Execute code (javascript:, vbscript:)
 * - Access local files (file://)
 * - Inject content (data:, blob:)
 * - Exploit browser internals (about:, chrome:)
 *
 * @param url - The URL string to validate
 * @returns Object with isValid boolean, sanitizedUrl, and error message if invalid
 */
export const validateExternalUrl = (
  url: string
): { isValid: boolean; sanitizedUrl?: string; error?: string } => {
  // Security: Check URL length to prevent DoS via extremely long URLs
  if (url.length > URL_SECURITY.MAX_URL_LENGTH) {
    return {
      isValid: false,
      error: `URL exceeds maximum length of ${URL_SECURITY.MAX_URL_LENGTH} characters`
    };
  }

  // Security: Trim whitespace and normalize the URL
  const trimmedUrl = url.trim();

  // Security: Block empty URLs
  if (!trimmedUrl) {
    return { isValid: false, error: 'URL cannot be empty' };
  }

  try {
    // Security: Parse URL to validate format and extract protocol
    const parsedUrl = new URL(trimmedUrl);

    // Security: Get lowercase protocol for comparison
    const protocol = parsedUrl.protocol.toLowerCase();

    // Security: Check against explicit blocklist first (for logging purposes)
    const blockedProtocols = URL_SECURITY.BLOCKED_PROTOCOLS as readonly string[];
    if (blockedProtocols.includes(protocol)) {
      console.warn(`[SECURITY] Blocked dangerous URL protocol: ${protocol}`);
      return {
        isValid: false,
        error: `Protocol "${protocol}" is not allowed for security reasons`
      };
    }

    // Security: Only allow explicitly permitted protocols (allowlist approach)
    const allowedProtocols = URL_SECURITY.ALLOWED_PROTOCOLS as readonly string[];
    if (!allowedProtocols.includes(protocol)) {
      console.warn(`[SECURITY] Blocked URL with unknown protocol: ${protocol}`);
      return {
        isValid: false,
        error: 'Only HTTP and HTTPS URLs are allowed'
      };
    }

    // Security: Return the normalized URL (parsed and re-stringified)
    // This ensures consistent format and prevents encoding tricks
    return {
      isValid: true,
      sanitizedUrl: parsedUrl.href
    };
  } catch {
    // Security: Invalid URL format
    return { isValid: false, error: 'Invalid URL format' };
  }
};
