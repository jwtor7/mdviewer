# Architecture

## Electron Multi-Process Model

mdviewer follows the standard Electron three-process architecture with strict security boundaries.

### 1. Main Process

**Entry:** `src/main.ts` (~48K lines) — the application lifecycle, IPC handler registration, and orchestration of all main-process modules.

All `BrowserWindow` instances are created with:
```typescript
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
}
```

Supports an `inactive` option that calls `showInactive()` on `ready-to-show` to avoid stealing focus when opening files from external sources.

**Key modules under `src/main/`:**

| Module | Responsibility |
|--------|---------------|
| `windowManager.ts` | `createWindow()`, `createMenu()`, window-count tracking, context menu wiring. Tracks `mainWindow`, `openWindowCount`. |
| `openFileRouter.ts` | Pure routing logic for `app.on('open-file')` events — handles cold-launch, existing-window, already-watched, and focus-stealing branches. Unit-testable. |
| `fileWatcher.ts` | `fs.watch`-based file watcher with per-window registration, `isFileWatched()` short-circuit, disallowed-extension rejection. |
| `markitdown.ts` | Converts non-`.md` formats via the project's `.venv` markitdown CLI. Surfaces `MarkitdownNotInstalledError` for install-dialog UX. |
| `externalOpenDefocus.ts` | Focus-stealing suppression for external file opens. |
| `tts/index.ts` | TTS dispatcher — Kokoro (primary) with `say` fallback. |
| `tts/kokoroEngine.ts` | Neural TTS via persistent Python worker. |
| `tts/sayEngine.ts` | Native macOS `say` command engine. |
| `security/ipcValidation.ts` | `withIPCHandlerNoInput()` / `withValidatedIPCHandler()` wrappers enforcing Zod schemas on every channel. |
| `security/pathValidation.ts` | `isPathSafe()`, `validateExternalUrl()`, `sanitizeError()`. |
| `security/rateLimiter.ts` | Per-window IPC rate limiting (100 calls/sec per handler). |
| `storage/preferences.ts` | JSON-backed app preferences (`alwaysOnTop`) in `app.getPath('userData')`. |
| `storage/recentFiles.ts` | Recent files list (max 50) in `app.getPath('userData')`. |

### 2. Preload Script (`src/preload.ts`)

Uses `contextBridge.exposeInMainWorld('electronAPI', …)` to expose a typed, limited API to the renderer. Event subscribers return cleanup functions; invoke wrappers resolve to `IPCResult<T>`. The `webUtils.getPathForFile` bridge allows drag-drop to resolve `File` → absolute path under sandbox.

See [IPC & Preload](ipc-and-preload.md) for the full channel catalog.

### 3. Renderer Process (`src/renderer.tsx` → `src/App.tsx`)

React 19 single-page app. The root component `App.tsx` (~45K) orchestrates all custom hooks and renders the active view mode.

**Renderer code map:**

| Directory | Contents |
|-----------|---------|
| `src/components/` | `MarkdownPreview.tsx` (27K — the load-bearing component), `CodeEditor.tsx`, `FindReplace.tsx`, `ReadAloudMenu.tsx`, `MermaidDiagram.tsx`, `TextPreview.tsx`, `CodeBlock.tsx`, `ErrorNotification.tsx` |
| `src/hooks/` | 16 custom hooks, all exported via `index.ts` barrel |
| `src/utils/` | Pure utilities: `markdownToSpeech.ts`, `speechChunker.ts`, `textConverter.ts`, `fileValidator.ts`, `clipboardSanitizer.ts`, `textEditing.ts`, `pdfRenderer.ts`, `rehypeSectionWrap.ts`, `rehypeSpeakingHighlight.ts`, `chapterExtraction.ts`, `textCalculations.ts` |
| `src/constants/` | `index.ts` (config constants), `defaultContent.ts` (sample doc content) |
| `src/types/` | `electron.d.ts` (ElectronAPI interface, IPCMessage union), `ipc-schemas.ts` (Zod schemas), `document.d.ts`, `error.d.ts` |

All IPC goes through `window.electronAPI` — the renderer never imports `electron` directly.

### MarkdownPreview.tsx

The central rendering component uses `react-markdown` + `remark-gfm` + `rehype-sanitize` + `rehype-highlight`, plus three custom rehype plugins:
- **Search-match highlighting** — highlights Find & Replace matches in rendered output
- **Speaking-position highlighting** — highlights the active paragraph during Read Aloud (`rehypeSpeakingHighlight.ts`)
- **Section wrapping** — wraps sections for scroll synchronization in Split mode (`rehypeSectionWrap.ts`)

Interactive GFM task-list checkboxes (`- [ ]` ⇄ `- [x]`) write changes back to source and mark the document dirty.

## Build System

**Electron Forge + Vite** with separate configs for each process:

| Config | Purpose |
|--------|---------|
| `forge.config.js` | Packager config (asar, appBundleId, file associations, code signing, Fuses), makers (Squirrel, ZIP, Deb, RPM) |
| `vite.main.config.mjs` | Main process build |
| `vite.preload.config.mjs` | Preload script build |
| `vite.renderer.config.mjs` | Renderer build (React plugin) |

**Build entries** (from `forge.config.js`):
- `src/main.ts` → main process
- `src/preload.ts` → preload script
- `src/renderer.tsx` → renderer (via `index.html`)

**Electron Fuses** (production hardening via `FusesPlugin`):
- `RunAsNode: false`
- `EnableCookieEncryption: true`
- `EnableNodeOptionsEnvironmentVariable: false`
- `EnableNodeCliInspectArguments: false`
- `OnlyLoadAppFromAsar: true`
- `EnableEmbeddedAsarIntegrityValidation: true`

**Extra resources:** `./resources/tts` (Kokoro Python worker) is placed outside `app.asar` at `Contents/Resources/tts/` so `python3` can execute it.

## TypeScript Configuration

Strict mode in the base `tsconfig.json`. Each process has its own config:

| Config | Scope |
|--------|-------|
| `tsconfig.json` | Base / shared settings |
| `tsconfig.main.json` | Main process |
| `tsconfig.preload.json` | Preload script |
| `tsconfig.renderer.json` | Renderer (used by Vite) |
| `tsconfig.test.json` | Test files |

All source is `.ts`/`.tsx`. Main-process imports use `.js` extensions at the import site because the build emits ESM — do not strip these.

## Inbound File Flow

1. macOS delivers `open-file` (Finder double-click, Open With, drag-onto-icon, `open file.md`) **or** the user picks via `Cmd+O`
2. `src/main/openFileRouter.ts` decides: focus existing window, hide-and-show silently (avoid focus theft), or create a new (optionally inactive) window
3. `fs.readFile` → main sends `file-open` over IPC
4. Preload's `onFileOpen` subscription delivers `FileOpenData` payload to the renderer

For non-`.md` files, `src/main/markitdown.ts` converts via the Python venv before sending content to the renderer.

See [File Handling](file-handling.md) for the full conversion and routing pipeline.
