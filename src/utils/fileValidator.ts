/**
 * File Integrity Validation Utility
 *
 * Provides security validation for file content to prevent:
 * - Binary file masquerading as markdown
 * - Invalid UTF-8 encoding
 * - Corrupted file content
 *
 * MEDIUM-2 Security Fix
 */

import { FILE_INTEGRITY } from '../constants/index.js';

/**
 * Result of file content validation
 */
export interface FileValidationResult {
  /** Whether the content is valid UTF-8 text */
  valid: boolean;
  /** The sanitized content (BOM stripped, validated) - only present if valid */
  content?: string;
  /** Error message explaining why validation failed - only present if invalid */
  error?: string;
}

/**
 * UTF-8 Byte Order Mark (BOM) bytes
 * These are sometimes prepended to UTF-8 files by certain editors
 */
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/**
 * Checks if a byte represents a valid UTF-8 continuation byte
 * Continuation bytes have the pattern 10xxxxxx (0x80-0xBF)
 */
const isValidContinuationByte = (byte: number): boolean => {
  return (byte & 0xc0) === 0x80;
};

/**
 * Validates that a Buffer contains valid UTF-8 encoded text.
 * Performs manual byte-level validation to catch encoding issues
 * that Node.js TextDecoder might silently replace with U+FFFD.
 *
 * @param buffer - The buffer to validate
 * @returns true if the buffer is valid UTF-8
 */
const isValidUtf8 = (buffer: Buffer): boolean => {
  let i = 0;
  while (i < buffer.length) {
    const byte = buffer[i];

    // ASCII (0x00-0x7F) - single byte character
    if (byte <= 0x7f) {
      i++;
      continue;
    }

    // Invalid leading byte
    if (byte < 0xc2 || byte > 0xf4) {
      return false;
    }

    // 2-byte sequence (0xC2-0xDF)
    if (byte >= 0xc2 && byte <= 0xdf) {
      if (i + 1 >= buffer.length || !isValidContinuationByte(buffer[i + 1])) {
        return false;
      }
      i += 2;
      continue;
    }

    // 3-byte sequence (0xE0-0xEF)
    if (byte >= 0xe0 && byte <= 0xef) {
      if (i + 2 >= buffer.length) {
        return false;
      }
      // E0 requires continuation byte to be A0-BF (prevent overlong encoding)
      if (byte === 0xe0 && (buffer[i + 1] < 0xa0 || buffer[i + 1] > 0xbf)) {
        return false;
      }
      // ED requires continuation byte to be 80-9F (prevent UTF-16 surrogates)
      if (byte === 0xed && (buffer[i + 1] < 0x80 || buffer[i + 1] > 0x9f)) {
        return false;
      }
      if (!isValidContinuationByte(buffer[i + 1]) || !isValidContinuationByte(buffer[i + 2])) {
        return false;
      }
      i += 3;
      continue;
    }

    // 4-byte sequence (0xF0-0xF4)
    if (byte >= 0xf0 && byte <= 0xf4) {
      if (i + 3 >= buffer.length) {
        return false;
      }
      // F0 requires continuation byte to be 90-BF (prevent overlong encoding)
      if (byte === 0xf0 && (buffer[i + 1] < 0x90 || buffer[i + 1] > 0xbf)) {
        return false;
      }
      // F4 requires continuation byte to be 80-8F (prevent > U+10FFFF)
      if (byte === 0xf4 && (buffer[i + 1] < 0x80 || buffer[i + 1] > 0x8f)) {
        return false;
      }
      if (
        !isValidContinuationByte(buffer[i + 1]) ||
        !isValidContinuationByte(buffer[i + 2]) ||
        !isValidContinuationByte(buffer[i + 3])
      ) {
        return false;
      }
      i += 4;
      continue;
    }

    // Invalid byte
    return false;
  }

  return true;
};

/**
 * Detects if the content appears to be binary (not text).
 * Binary detection is based on:
 * 1. Presence of null bytes (0x00) - common in binary files, never in text
 * 2. High ratio of control characters - text files have few control chars
 *
 * @param content - The string content to check
 * @returns true if the content appears to be binary
 */
const isBinaryContent = (content: string): boolean => {
  // Null bytes are a definitive indicator of binary content
  if (content.includes('\0')) {
    return true;
  }

  // Count control characters (excluding allowed ones like newline, carriage return, tab)
  let controlCharCount = 0;
  const totalLength = content.length;

  // Short-circuit for empty files
  if (totalLength === 0) {
    return false;
  }

  // Cast allowed control chars to readonly string array for includes() check
  const allowedChars = FILE_INTEGRITY.ALLOWED_CONTROL_CHARS as readonly string[];

  for (let i = 0; i < totalLength; i++) {
    const charCode = content.charCodeAt(i);

    // Control characters are 0x00-0x1F and 0x7F
    if ((charCode <= 0x1f || charCode === 0x7f)) {
      // Skip allowed control characters
      const char = content[i];
      if (!allowedChars.includes(char)) {
        controlCharCount++;
      }
    }
  }

  // Calculate ratio of control characters to total content
  const controlCharRatio = controlCharCount / totalLength;

  // If control character ratio exceeds threshold, it's likely binary
  return controlCharRatio > FILE_INTEGRITY.MAX_CONTROL_CHAR_RATIO;
};

/**
 * Strips UTF-8 BOM from the beginning of a buffer if present.
 *
 * @param buffer - The buffer to process
 * @returns Buffer with BOM stripped (or original if no BOM)
 */
const stripBom = (buffer: Buffer): Buffer => {
  if (buffer.length >= 3 &&
      buffer[0] === UTF8_BOM[0] &&
      buffer[1] === UTF8_BOM[1] &&
      buffer[2] === UTF8_BOM[2]) {
    return buffer.subarray(3);
  }
  return buffer;
};

/**
 * Validates file content for integrity and security.
 *
 * This function performs the following checks:
 * 1. Strips UTF-8 BOM if present
 * 2. Validates content is valid UTF-8
 * 3. Detects binary content (null bytes, excessive control characters)
 *
 * @param buffer - The raw file buffer to validate
 * @returns Validation result with content string if valid, error message if invalid
 *
 * @example
 * ```typescript
 * const buffer = await fs.promises.readFile(filepath);
 * const result = validateFileContent(buffer);
 * if (result.valid) {
 *   // Use result.content
 * } else {
 *   // Show error: result.error
 * }
 * ```
 */
export const validateFileContent = (buffer: Buffer): FileValidationResult => {
  // Step 1: Strip UTF-8 BOM if present
  const contentBuffer = stripBom(buffer);

  // Step 2: Validate UTF-8 encoding
  if (!isValidUtf8(contentBuffer)) {
    return {
      valid: false,
      error: 'File contains invalid UTF-8 characters and cannot be opened.'
    };
  }

  // Step 3: Convert to string (now safe since we validated UTF-8)
  const content = contentBuffer.toString('utf-8');

  // Step 4: Detect binary content
  if (isBinaryContent(content)) {
    return {
      valid: false,
      error: 'File appears to be binary, not text. Only text-based Markdown files are supported.'
    };
  }

  // All checks passed
  return {
    valid: true,
    content
  };
};
