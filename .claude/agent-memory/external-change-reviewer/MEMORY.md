# External Change Reviewer Memory

## Project: mdviewer

### IPC Response Pattern (Standardized)
All IPC handlers now use `IPCResult<T>` = `{ success: true; data: T } | { success: false; error: string }`.
Wrapped via `withValidatedIPCHandler`. Old pattern used ad-hoc `{ success: boolean; error?: string }` or
raw values. Any new IPC method must follow this pattern and update: preload.ts, electron.d.ts, test/setup.ts,
and call sites in React code.

### Document ID Pattern
`useDocuments.ts` uses `createDocumentId()` from `src/utils/id.ts` (crypto.randomUUID() with fallback).
Tests that previously asserted specific Date.now() values must be updated to duck-type check instead.

### IPC Security Utilities Extracted
`isPathSafe`, `sanitizeError`, `validateExternalUrl` moved to `src/main/security/pathValidation.ts`.
`isValidIPCOrigin`, `createRateLimiter` removed — replaced by `withValidatedIPCHandler` wrapper.

### Find/Replace Debounce
FindReplace.tsx debounces search at 150ms using `debouncedFindText` state. All effects depend on
`debouncedFindText`, not `findText`. This is intentional for performance.

### rehype Plugin Approach for Search Highlighting
MarkdownPreview.tsx replaced React-tree walk (`processChildren`) with a rehype plugin (`createRehypeSearchHighlight`).
The plugin mutates the hast tree directly. The `components` useMemo no longer includes search params in deps.

### CSP Fix
`src: null` in customSchema (allowed all src protocols) replaced with `src: ['http', 'https', 'data']`.

### Unsaved Docs IPC Race Fix
`windowManager.ts` now uses a `requestId` (crypto.randomUUID) to correlate unsaved-docs-response messages,
preventing cross-window contamination. Preload updated to pass requestId in payload.

### Known Stale Tests (as of 2026-02-27 session)
`useFileHandler.test.ts` has 2 tests asserting `.id` is passed to `addDocument`, but `useFileHandler`
was refactored to omit `id` and let `useDocuments.addDocument` generate it. Tests need updating.
