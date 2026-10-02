# File Handling

mdviewer opens Markdown natively and converts everything else to Markdown via [microsoft/markitdown](https://github.com/microsoft/markitdown). This page covers the full file pipeline: conversion, routing, watching, drag-drop, image embedding, and macOS file associations.

## Supported Formats

| Category | Extensions | Handling |
|----------|-----------|----------|
| **Markdown** (native) | `.md`, `.markdown` | Direct read, zero dependencies |
| **Documents** | `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.epub`, `.rtf` | markitdown conversion |
| **Web & Data** | `.html`, `.htm`, `.csv`, `.json`, `.xml` | markitdown conversion |
| **Plain Text** | `.txt`, `.rst` | markitdown conversion |
| **Images** (OCR + metadata) | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.tiff`, `.bmp` | markitdown conversion |
| **Audio & Video** (transcription) | `.wav`, `.mp3`, `.m4a`, `.mp4` | markitdown conversion (uses Web Speech API for transcription) |
| **Archives** | `.zip` | markitdown conversion |

The extension lists are defined in both `src/main/markitdown.ts` (`CONVERTIBLE_EXTENSIONS`) and `src/constants/index.ts` (`SECURITY_CONFIG.CONVERTIBLE_EXTENSIONS`) — keep them in sync.

## markitdown Integration

**Source:** `src/main/markitdown.ts`

The converter runs the `markitdown` CLI from the project-local Python venv at `.venv/`. The venv is created during `npm install` via `scripts/setup-venv.sh`, which:

1. Checks if `.venv/bin/markitdown` already exists and works
2. Creates the venv using `uv` (if available) or falls back to `python3 -m venv` + pip
3. Installs `markitdown[all]`

Recreate manually with `npm run setup:venv`. Requires Python 3.10+ or `uv`.

**Key functions:**
- `isMarkdownFile(filePath)` — checks `.md`/`.markdown`
- `isConvertibleFile(filePath)` — checks against `CONVERTIBLE_EXTENSIONS`
- `isSupportedFile(filePath)` — union of the above
- `convertToMarkdown(filePath)` — shells out to markitdown, returns Markdown string
- `getFileDialogFilters()` — returns Electron dialog filters

**Error handling:** If markitdown is not installed, `MarkitdownNotInstalledError` is thrown, which the renderer surfaces as an install dialog rather than a silent failure.

The markitdown binary is resolved by checking `~/.local/bin`, `/opt/homebrew/bin`, `/usr/local/bin`, and then `which markitdown`.

## Open-File Routing

**Source:** `src/main/openFileRouter.ts`, `src/main/externalOpenDefocus.ts`

When macOS delivers an `open-file` event (Finder double-click, Open With, drag-onto-icon, terminal `open`), the router decides:

1. **Already watched?** — `isFileWatched()` short-circuits if the file is already open and watched in a window
2. **Existing window?** — focus an existing window rather than creating a new one
3. **Focus theft?** — if the app is not focused, use `showInactive()` to avoid stealing focus from whatever the user is doing (see `externalOpenDefocus.ts`)

The router is pure logic, extracted from `src/main.ts` specifically to be unit-testable without Electron.

## File Watching

**Sources:** `src/main/fileWatcher.ts` (main), `src/hooks/useFileWatcher.ts` (renderer)

Keeps open tabs in sync with on-disk changes using `fs.watch`:

- Per-window registration — each window watches its own set of files
- `isFileWatched()` — lets the open-file router skip re-routing for already-watched paths
- Disallowed-extension rejection — prevents watching files that aren't in the supported set
- `unwatchAllForWindow()` — cleanup on window close

**Renderer flow:** `useFileWatcher` calls `watchFile`/`unwatchFile` via IPC and subscribes to `onFileChanged` events. When a change arrives, it reloads the file content into the active document.

## Drag-Drop

**Source:** `src/hooks/useDragDrop.ts` (~16K)

Handles two drag-drop scenarios:

1. **File drop** — files dropped onto the window are opened via `openFilePath` IPC (which routes through markitdown conversion if needed)
2. **Tab drag** — tabs can be dragged out to spawn new windows via `createWindowForTab` IPC

The `getPathForFile` bridge (via `webUtils`) resolves HTML5 `File` objects to absolute paths under the sandboxed renderer.

## Image Embedding

When images are dragged onto the editor:
1. The image is copied to `./images/` relative to the current document's directory
2. A relative-path Markdown image reference is inserted into the source

**IPC channels:** `readImageFile`, `copyImageToDocument`, `saveImageFromData` (for pasted image data as base64)

**Config:** Allowed extensions and max size live in `IMAGE_CONFIG` (referenced from `src/constants/index.ts`).

**Permission-aware rendering:** On macOS, images in protected folders (Documents, Desktop, Downloads, removable/network volumes) require TCC grants. The app includes usage descriptions in `forge.config.js` (`NSDocumentsFolderUsageDescription`, etc.) and provides one-click deep-links into System Settings when permissions are missing. See [Testing & Operations](testing-and-operations.md#code-signing--tcc) for the signing requirement that makes TCC work.

## macOS File Associations

Configured in `forge.config.js` under `packagerConfig.extendInfo.CFBundleDocumentTypes`:

| Bundle Type | Role | Rank | Extensions |
|------------|------|------|-----------|
| Markdown File | Editor | **Owner** | `.md`, `.markdown` |
| Document | Viewer | Alternate | `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.html`, `.htm`, `.csv`, `.json`, `.xml`, `.epub`, `.txt`, `.rst`, `.rtf` |
| Image | Viewer | Alternate | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.tiff`, `.bmp` |
| Audio or Video | Viewer | Alternate | `.wav`, `.mp3`, `.m4a`, `.mp4` |

Markdown is **Owner** (`LSHandlerRank: Owner`) so mdviewer becomes the default `.md` handler. Everything else is **Alternate** so Preview, Word, QuickTime, etc. retain their default-app status.

The UTI `net.daringfireball.markdown` is used for Markdown file type registration.

> ⚠️ Dev mode does **not** register macOS file associations. For real Launch Services routing, build with `npm run make` and install the `.app`.
