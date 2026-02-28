/**
 * IPC Schemas - Zod schemas for runtime validation of IPC data
 *
 * This module provides declarative schema definitions for all IPC messages
 * passed between the renderer and main processes. Using Zod enables:
 * - Runtime type validation with descriptive error messages
 * - Automatic TypeScript type inference
 * - Consistent validation patterns across all handlers
 *
 * Security: These schemas are the first line of defense against malformed
 * or malicious data from the renderer process.
 */

import { z } from 'zod';

// ============================================================================
// Primitive Schemas
// ============================================================================

/**
 * Schema for nullable string fields (e.g., filePath for unsaved files).
 */
export const NullableStringSchema = z.string().nullable();

/**
 * Schema for non-empty strings.
 */
export const NonEmptyStringSchema = z.string().min(1, 'String cannot be empty');

// ============================================================================
// File Operation Schemas
// ============================================================================

/**
 * Schema for save-file IPC handler.
 * Validates content, filename, and optional filePath for saving documents.
 */
export const SaveFileDataSchema = z.object({
  content: z.string(),
  filename: z.string().min(1, 'Filename cannot be empty'),
  filePath: z.string().nullable(),
});

export type SaveFileDataInput = z.infer<typeof SaveFileDataSchema>;

/**
 * Schema for read-file IPC handler.
 * Validates the file path string for reading markdown files.
 */
export const ReadFileDataSchema = z.object({
  filePath: z.string().min(1, 'File path cannot be empty'),
});

export type ReadFileDataInput = z.infer<typeof ReadFileDataSchema>;

/**
 * Schema for export-pdf IPC handler.
 * Validates content and filename for PDF export.
 */
export const ExportPdfDataSchema = z.object({
  content: z.string(),
  filename: z.string().min(1, 'Filename cannot be empty'),
});

export type ExportPdfDataInput = z.infer<typeof ExportPdfDataSchema>;

// ============================================================================
// Window Management Schemas
// ============================================================================

/**
 * Schema for create-window-for-tab IPC handler.
 * Validates filePath and content for creating new windows from dragged tabs.
 */
export const CreateWindowForTabDataSchema = z.object({
  filePath: z.string().nullable(),
  content: z.string(),
});

export type CreateWindowForTabDataInput = z.infer<typeof CreateWindowForTabDataSchema>;

// ============================================================================
// Dialog Schemas
// ============================================================================

/**
 * Schema for show-unsaved-dialog IPC handler.
 * Validates filename for the unsaved changes dialog.
 */
export const ShowUnsavedDialogDataSchema = z.object({
  filename: z.string().min(1, 'Filename cannot be empty'),
});

export type ShowUnsavedDialogDataInput = z.infer<typeof ShowUnsavedDialogDataSchema>;

// ============================================================================
// File System Operation Schemas
// ============================================================================

/**
 * Schema for reveal-in-finder IPC handler.
 * Validates file path for revealing in file manager.
 */
export const RevealInFinderDataSchema = z.object({
  filePath: z.string().min(1, 'File path cannot be empty'),
});

export type RevealInFinderDataInput = z.infer<typeof RevealInFinderDataSchema>;

// ============================================================================
// Image Operation Schemas
// ============================================================================

/**
 * Schema for read-image-file IPC handler.
 * Validates image path and markdown file path for reading local images.
 */
export const ReadImageFileDataSchema = z.object({
  imagePath: z.string().min(1, 'Image path cannot be empty'),
  markdownFilePath: z.string().min(1, 'Markdown file path cannot be empty'),
});

export type ReadImageFileDataInput = z.infer<typeof ReadImageFileDataSchema>;

/**
 * Schema for copy-image-to-document IPC handler.
 * Validates paths for copying images to the document's images directory.
 */
export const CopyImageToDocumentDataSchema = z.object({
  imagePath: z.string().min(1, 'Image path cannot be empty'),
  markdownFilePath: z.string().min(1, 'Markdown file path cannot be empty'),
});

export type CopyImageToDocumentDataInput = z.infer<typeof CopyImageToDocumentDataSchema>;

/**
 * Schema for save-image-from-data IPC handler.
 * Validates base64 image data and markdown file path for pasted images.
 */
export const SaveImageFromDataSchema = z.object({
  imageData: z.string().min(1, 'Image data cannot be empty'),
  markdownFilePath: z.string().min(1, 'Markdown file path cannot be empty'),
});

export type SaveImageFromDataInput = z.infer<typeof SaveImageFromDataSchema>;

// ============================================================================
// External URL Schema
// ============================================================================

/**
 * Schema for open-external-url IPC handler.
 * Note: URL validation is done separately with more comprehensive checks.
 */
export const OpenExternalUrlDataSchema = z.string().min(1, 'URL cannot be empty');

export type OpenExternalUrlDataInput = z.infer<typeof OpenExternalUrlDataSchema>;

// ============================================================================
// Schema Registry
// ============================================================================

/**
 * Registry mapping IPC channel names to their schemas.
 * Useful for dynamic schema lookup based on channel name.
 */
export const IPCSchemaRegistry = {
  'save-file': SaveFileDataSchema,
  'read-file': ReadFileDataSchema,
  'export-pdf': ExportPdfDataSchema,
  'create-window-for-tab': CreateWindowForTabDataSchema,
  'show-unsaved-dialog': ShowUnsavedDialogDataSchema,
  'reveal-in-finder': RevealInFinderDataSchema,
  'read-image-file': ReadImageFileDataSchema,
  'copy-image-to-document': CopyImageToDocumentDataSchema,
  'save-image-from-data': SaveImageFromDataSchema,
  'open-external-url': OpenExternalUrlDataSchema,
} as const;

export type IPCChannel = keyof typeof IPCSchemaRegistry;
