# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow

After completing any feature or fix:
1. Summarize what changed and why
2. Suggest 2-4 related next steps (specific, feasible, contextual)
3. If approved, update CHANGELOG.md (and the README.md Changelog block if it falls into the 3 most recent versions)

Additional reminders:
- Update default content (`src/constants/defaultContent.ts`) when roadmap/changelog changes — `DEFAULT_DOCUMENT` ships as the test/sample doc
- Always check `src/types/` (especially `ipc-schemas.ts` and `electron.d.ts`) when touching IPC — every channel is Zod-validated in the main process and typed on the preload bridge
- Component patterns: changes that touch the toolbar/notification surface should also be checked against `ErrorNotification.tsx`, `FindReplace.tsx`, and `ReadAloudMenu.tsx`

## Project Overview

mdviewer is a fast, offline-first Markdown viewer and editor for macOS, built on Electron, React 19, and TypeScript 5. Beyond `.md`/`.markdown`, it converts most common document formats (PDF, DOCX, PPTX, XLSX, HTML, EPUB, CSV/JSON/XML, RTF, images, audio/video) to Markdown via [microsoft/markitdown](https://github.com/microsoft/markitdown) running through a project-local Python venv. Audio/video transcription goes through the Web Speech API in the renderer. Everything else is local.

## Key Commands

### Development
```bash
npm start              # Electron Forge + Vite dev server with HMR
npm run package        # Bundle (no installer)
npm run make           # Build distributables (runs `npm test` first via `premake`)
npm run publish        # Electron Forge publish
npm run lint           # ESLint over src/**/*.{ts,tsx}
npm run lint:fix       # ESLint with --fix
```

### Type checking
```bash
npm run typecheck             # All processes
npm run typecheck:main        # Main only
npm run typecheck:preload     # Preload only
npm run typecheck:renderer    # Renderer only
```

### Testing
```bash
npm test               # vitest run (one-shot)
npm run test:watch     # vitest (watch)
npm run test:coverage  # vitest run --coverage
npm run test:ui        # vitest --ui
```

`premake` runs the test suite before any distributable build — a failing test blocks `npm run make`.

### Python venv (markitdown)
`npm install` triggers `postinstall` → `scripts/setup-venv.sh`, which creates `.venv/` and installs `markitdown[all]`. Uses `uv` if available, else falls back to `python -m venv` + pip. Recreate manually with `npm run setup:venv`. Requires Python 3.10+ (or `uv`).

### Node toolchain (Volta-pinned)
**This repo is pinned to Node 20.19.5 / npm 10.8.2 via the `volta` field in `package.json`. Do not unpin it without verifying `npm run make` still completes.**

`@electron/packager` (the engine behind `npm run make`) hangs indefinitely under Node 26 / npm 11 while extracting the Electron runtime template ZIP into `/private/var/folders/.../T/electron-packager/darwin-arm64-template-*/Electron.app/`. The hang surfaces as the listr task "Copying files" sitting forever with no error output. Under Node 20 LTS the same source tree builds cleanly in ~30–60s. This was diagnosed in v5.3.1 after three failed bisection attempts on `forge.config.js` — the config is innocent, the runtime is the cause.

If `node -v` reports a version other than 20.19.5 when `cd`'d into this repo, Volta is either not installed or not on PATH. Install Volta (`curl https://get.volta.sh | bash`) before debugging any `npm run make` hang. Do not "fix" the hang by editing `forge.config.js`, removing `appBundleId`, clearing the Electron cache, or rebuilding the temp dir — those were all ruled out.

### Code signing (TCC requirement)
**`forge.config.js` MUST run `codesign --force --deep --sign -` on the packaged bundle via an `afterComplete` hook in `packagerConfig`. Without it, every packaged build ships with a broken signature and macOS TCC silently denies all file-access requests with no prompt and no entry in System Settings → Privacy & Security.**

The mechanism: `@electron/packager` extracts the prebuilt Electron binary, which is already ad-hoc-signed with `Identifier=com.github.Electron`. Setting `appBundleId: 'ca.trustcyber.mdviewer'` (or any value) causes the packager to **rewrite `Info.plist` after the signature is sealed**, which invalidates the seal — `Info.plist=not bound`, `codesign --verify` fails with `invalid Info.plist (plist or signature have been modified)`, and the signature identifier still says `com.github.Electron`. macOS TCC requires a valid code signature to attribute file-access requests; with an invalid signature it silently denies without prompting and never registers the app in Privacy & Security. The `afterComplete` hook re-signs the whole bundle bottom-up as a single coherent unit, producing a valid ad-hoc signature with the correct Identifier and the Info.plist rebound.

**Do not try to use the packager-native `osxSign` option.** It looks like the obvious fix but is broken two ways for ad-hoc signing:

- With `osxSign: { identity: '-' }` alone, `@electron/osx-sign` runs `security find-identity` looking for a keychain certificate matching `-`, finds none, throws `No identity found for signing`, and Forge swallows the error (its `continueOnError: true` default plus the packager's `quiet: true` option suppress both throw and warning). The build looks successful with **no signing step actually executed**.
- Adding `identityValidation: false` skips the keychain lookup and does engage codesign, but `@electron/osx-sign` signs files individually with per-file entitlements (Hardened Runtime + library-validation entitlements pulled from `entitlements/default.darwin.plist`). On Apple Silicon that leaves the framework binary and the main binary with mismatched Team IDs; dyld then refuses to load the framework with `mapping process and mapped file (non-platform) have different Team IDs`, producing the "mdviewer cannot be opened because of a problem" launch-time crash dialog. Crash report ends up in `~/Library/Logs/DiagnosticReports/mdviewer-*.ips`.

The bare `codesign --force --deep --sign -` from an `afterComplete` hook sidesteps both: it walks the bundle bottom-up and signs everything coherently, no entitlements applied, no Hardened Runtime, no Team-ID mismatch.

Diagnostic when TCC prompts don't appear or images in protected folders won't load:

```bash
codesign -dv --verbose=4 /Applications/mdviewer.app 2>&1 | grep -E "Identifier|Signature|Info.plist"
codesign --verify --deep --strict /Applications/mdviewer.app
```

The healthy state shows `Identifier=ca.trustcyber.mdviewer`, `Info.plist entries=N` (some non-zero count, meaning bound), and `codesign --verify` exits clean with no message. If you see `Identifier=com.github.Electron` or `Info.plist=not bound`, the `afterComplete` hook isn't running or has been removed.

One-shot repair on an already-installed bundle (no rebuild needed): `codesign --force --deep --sign - /Applications/mdviewer.app && tccutil reset All ca.trustcyber.mdviewer`. The proper durable fix is the `afterComplete` hook in `forge.config.js`.

Note: ad-hoc signatures contain a content-derived CDHash that changes on every rebuild. The macOS Keychain ACL on Electron's `<AppName> Safe Storage` entry (used for cookie/localStorage encryption when `EnableCookieEncryption` is on) is bound to a specific CDHash, so every rebuild re-prompts for Keychain access on first launch. Click Always Allow when this dialog appears — it does not survive future rebuilds but is correct behavior for ad-hoc dev distribution. The TCC grant for Documents/Desktop/Downloads is bound to the bundle ID (not the CDHash) and survives rebuilds.

This was diagnosed in v5.3.1 after the TCC prompt failed to appear despite `NSDocumentsFolderUsageDescription` being present and `appBundleId` being correct in Info.plist. The usage strings only take effect if TCC can identify the app, which requires a valid signature.

## Testing Architecture

### Stack
- **Vitest** (^3.2.4) with `@vitest/coverage-v8` and `@vitest/ui`
- **React Testing Library** + `@testing-library/jest-dom` + `@testing-library/user-event`
- **jsdom** environment

### Configuration Files
- `vitest.config.ts`: jsdom env, globals enabled, `@` alias → `src/`, coverage excludes `src/main.ts` and `src/preload.ts`
- `tsconfig.test.json`: TS config for test files
- `src/test/setup.ts`: jest-dom matchers, `window.matchMedia`, `localStorage`, `ResizeObserver`, and a full `window.electronAPI` mock
- `src/__mocks__/electron.ts`: stub of the `electron` module (`ipcRenderer`, `contextBridge`, `webUtils`, `app`, `BrowserWindow`, `dialog`, `Menu`, `shell`)

### Coverage thresholds (vitest.config.ts)
- Lines: 30
- Functions: 50
- Branches: 50
- Statements: 30

### Test File Conventions
- Co-located: `Foo.ts` → `Foo.test.ts`, `Foo.tsx` → `Foo.test.tsx`
- ~25 test files across components, hooks, utils, and main-process modules

### Mocking Strategy

**Electron APIs**: `src/test/setup.ts` exposes a fully stubbed `window.electronAPI` covering all current IPC surfaces — file ops (`onFileOpen`, `onFileNew`, `onFileSave`, `onSaveAllAndQuit`, `readFile`, `saveFile`, `exportPDF`, `revealInFinder`), window management (`createWindowForTab`, `closeWindow`, `openMermaidWindow`), file watching (`watchFile`, `unwatchFile`, `onFileChanged`), images (`readImageFile`, `copyImageToDocument`, `saveImageFromData`), TTS (`startSpeech`/`stopSpeech`/`pauseSpeech`/`resumeSpeech`/`listVoices`/`onSpeechEnd`), and misc (`openExternalUrl`, `showUnsavedDialog`, `getPathForFile`, `logDebug`). When adding a new IPC channel, extend this mock.

**Browser APIs**: `window.matchMedia`, `localStorage`, and `ResizeObserver` are mocked. `HTMLElement.prototype.scrollIntoView` is a `vi.fn()`.

### What's NOT Tested
- **Renderer entry** (`src/renderer.tsx`): trivial bootstrap
- **Preload script** (`src/preload.ts`): excluded from coverage; would need context-isolation test setup
- **`src/main.ts`**: excluded from coverage (Electron-only). Extracted modules under `src/main/` (`fileWatcher`, `openFileRouter`, `windowManager`, `tts`) **are** covered.
- **E2E**: no Playwright/Spectron harness

## Architecture

### Electron Multi-Process Model

1. **Main Process** — entry `src/main.ts`, supporting modules in `src/main/`
   - `src/main/windowManager.ts` — `createWindow()`, `createMenu()`, window-count tracking, context menu wiring. **All BrowserWindows are created with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.** Supports an `inactive` option that uses `showInactive()` on `ready-to-show` to avoid stealing focus.
   - `src/main/openFileRouter.ts` — pure routing logic for `app.on('open-file')` events; unit-testable, handles cold-launch / existing-window / already-watched / focus-stealing branches
   - `src/main/fileWatcher.ts` — `fs.watch`-based file watcher with per-window registration, `isFileWatched()` short-circuit, and disallowed-extension rejection
   - `src/main/markitdown.ts` — converts non-`.md` formats via the project's `.venv` markitdown CLI; surfaces `MarkitdownNotInstalledError` for install-dialog UX
   - `src/main/tts.ts` — native macOS TTS (`say`) controller (start/stop/pause/resume, voice listing)
   - `src/main/storage/preferences.ts`, `src/main/storage/recentFiles.ts` — JSON-backed persistence under `app.getPath('userData')`
   - `src/main/security/ipcValidation.ts` — `withIPCHandlerNoInput()` / `withValidatedIPCHandler()` wrappers that enforce Zod schemas on every channel
   - `src/main/security/pathValidation.ts` — `isPathSafe()`, `validateExternalUrl()`, `sanitizeError()`
   - `src/main/security/rateLimiter.ts` — per-window IPC rate limiting (defaults in `SECURITY_CONFIG.RATE_LIMIT`)

2. **Preload Script** (`src/preload.ts`)
   - `contextBridge.exposeInMainWorld('electronAPI', …)`
   - Exposes typed event subscribers (return cleanup functions) and invoke wrappers that resolve to `IPCResult<T>`
   - `webUtils.getPathForFile` is bridged so drag-drop can resolve `File` → absolute path under sandbox

3. **Renderer Process** (`src/renderer.tsx` → `src/App.tsx`)
   - React 19 app with four view modes: Rendered, Raw, Split, Text (plus a dedicated Mermaid diagram window)
   - All IPC goes through `window.electronAPI`; never imports `electron` directly

### Component Structure

`src/components/`:
- **MarkdownPreview.tsx** — `react-markdown` + `remark-gfm` + `rehype-sanitize` + `rehype-highlight`; injects custom rehype plugins for search-match highlighting, speaking-position highlighting, and section wrapping
- **CodeEditor.tsx** — textarea wrapper with ref forwarding for selection-based formatting
- **CodeBlock.tsx** — code-block renderer used inside MarkdownPreview
- **MermaidDiagram.tsx** — mermaid (`mermaid@^11`) renderer with adaptive contrast; openable in a dedicated window
- **TextPreview.tsx** — plain-text view mode renderer
- **FindReplace.tsx** — draggable find/replace panel with case-sensitive search and bulk replace
- **ErrorNotification.tsx** — toast notifications (error / success)
- **ReadAloudMenu.tsx** — voice picker / rate / chapter controls for the Read-Aloud feature

### Hooks (`src/hooks/`, exported via `index.ts`)
`useDocuments`, `useTheme`, `useTextFormatting`, `useFileHandler`, `useErrorHandler`, `useKeyboardShortcuts`, `useWordWrap`, `useDragDrop`, `useClipboardCopy`, `useSaveFile`, `useIPCListeners`, `useSplitPaneDivider`, `useOutsideClickHandler`, `useFileWatcher`, `useTextToSpeech`, `useTTSPreferences`.

### Utilities (`src/utils/`)
Text stats (`textCalculations`), text editing (`textEditing`), PDF rendering (`pdfRenderer`), file validation (`fileValidator`), clipboard sanitization (`clipboardSanitizer`), Markdown-to-speech (`markdownToSpeech`, `speechChunker`, `chapterExtraction`), rehype plugins (`rehypeSectionWrap`, `rehypeSpeakingHighlight`), text/format conversion (`textConverter`), and `id` (id generator).

### Types (`src/types/`)
- `electron.d.ts` — `ElectronAPI`, `FileOpenData`, `IPCResult<T>`, `IPCMessage` discriminated union
- `ipc-schemas.ts` — **Zod schemas for every IPC channel**. Add new channels here first; main-process handlers consume the inferred `*Input` types
- `document.d.ts`, `error.d.ts`, `electron-squirrel-startup.d.ts`

### Build System

Electron Forge + Vite:
- `forge.config.js` — packager config (asar on, `extendInfo.CFBundleDocumentTypes` for `.md`/`.markdown` as Owner plus alternate viewers for documents, images, audio/video), makers (Squirrel, ZIP for darwin, Deb, RPM), and `FusesPlugin` enabling `EnableCookieEncryption`, `EnableEmbeddedAsarIntegrityValidation`, `OnlyLoadAppFromAsar` while disabling `RunAsNode`, `EnableNodeOptionsEnvironmentVariable`, `EnableNodeCliInspectArguments`
- `vite.main.config.mjs`, `vite.preload.config.mjs`, `vite.renderer.config.mjs`

### Inter-Process Communication

Inbound file flow:
1. macOS delivers `open-file` (Finder double-click, Open With, drag-onto-icon, terminal `open file.md`) **or** the user picks via `Cmd+O`
2. `src/main/openFileRouter.ts` decides whether to focus an existing window, hide-and-show silently to avoid focus theft, or create a new (optionally inactive) window
3. `fs.readFile` → main sends `file-open` over IPC
4. Preload's `onFileOpen` subscription delivers the `FileOpenData` payload to the renderer

Every other IPC channel uses `ipcMain.handle` wrapped in `withValidatedIPCHandler` (Zod validation, rate limiting, sanitized error responses). Schemas live in `src/types/ipc-schemas.ts`.

### Security Model

- Sandboxed renderer (`sandbox: true`), context isolation, no node integration — enforced in `createWindow()`
- Zod-validated IPC on every channel
- Per-window IPC rate limiting (`SECURITY_CONFIG.RATE_LIMIT`)
- Path-traversal protection via `isPathSafe`; external URLs run through `validateExternalUrl` with an allowlist of `https:`/`http:` and an explicit blocklist (`javascript:`, `vbscript:`, `file:`, `data:`, `blob:`, …)
- `rehype-sanitize` on rendered Markdown
- CSP in `index.html` allows `'unsafe-inline'` for script/style (required for Vite HMR in dev — production builds tolerate strict CSP)
- Electron Fuses enabled in `forge.config.js` for production hardening
- See `docs/SECURITY-MODEL.md` for the full threat model

### macOS File Associations

`forge.config.js > packagerConfig.extendInfo.CFBundleDocumentTypes` registers four bundle types:
- **Markdown File** (Owner, `net.daringfireball.markdown`, `.md`/`.markdown`)
- **Document** (Alternate, PDF/DOCX/PPTX/XLSX/HTML/HTM/CSV/JSON/XML/EPUB/TXT/RST/RTF)
- **Image** (Alternate, JPG/JPEG/PNG/GIF/WEBP/TIFF/BMP)
- **Audio or Video** (Alternate, WAV/MP3/M4A/MP4)

Markdown is Owner so mdviewer becomes the default `.md` handler; everything else is Alternate so Preview/Word/QuickTime keep their default-app status.

## Key Feature Notes

### Theme System
Five modes (System, Light, Dark, Solarized Light, Solarized Dark) — see `THEME_MODES` in `src/constants/index.ts`. Theme is applied via `data-theme` on `document.documentElement`. System mode listens to `matchMedia('prefers-color-scheme: dark')`.

### View Modes
`VIEW_MODES`: `rendered`, `raw`, `split`, `text`. `Cmd+E` cycles through them.

### Read Aloud (TTS)
Renderer hook `useTextToSpeech` drives the experience; main-process `src/main/tts.ts` shells out to macOS `say`. `markdownToSpeech` + `speechChunker` strip URLs, code blocks, and ASCII tables before chunking. `rehypeSpeakingHighlight` highlights the active paragraph in Rendered view. Preferences persist via `useTTSPreferences` (rate + voice). Shortcuts: `Cmd+Shift+R` toggle, `Cmd+Shift+.` stop, `Cmd+Shift+→/←` sentence nav, `Cmd+Shift+]/[` chapter nav, `Cmd+Alt+Shift+R` read from cursor.

### File Watching
`useFileWatcher` (renderer) ↔ `src/main/fileWatcher.ts` (main) keeps open tabs in sync with on-disk changes. `isFileWatched()` lets the open-file router skip re-routing for already-watched paths.

### Image Embedding
Drag-drop images are copied into `./images/` relative to the current document and inserted as relative-path Markdown. Allowed extensions and max size live in `IMAGE_CONFIG`.

### Status Bar
`calculateTextStats` returns `{ words, characters, tokens, lineCount }`. `lineCount` uses standard `split('\n')` semantics (empty → 0, trailing newline counts).

## TypeScript Configuration

Strict mode is enabled in the base `tsconfig.json`. Each process has its own config:
- `tsconfig.json` — base / shared
- `tsconfig.main.json` — main process
- `tsconfig.preload.json` — preload
- `tsconfig.renderer.json` — renderer (used by Vite)
- `tsconfig.test.json` — test files

All source is `.ts`/`.tsx` — there are no `.js`/`.jsx` files in `src/`. Imports inside main-process code use the `.js` extension at the import site (ESM-style) because the build emits ESM; do not "fix" these by stripping the extension.

## Development Workflow

### Dev Server
- `npm start` launches Electron with Vite HMR
- Renderer changes (React, CSS) → auto-reload
- Main / preload changes → restart required
- Stop: `Ctrl+C`, fall back to `pkill -f Electron` if detached
- DevTools: commented out by default; uncomment `openDevTools()` in `src/main.ts` (or the relevant `windowManager.ts` window creation site)

### Testing File Opening
- **Dev mode does not register macOS file associations.** Use `Cmd+O` (File → Open) or drag-and-drop onto the window
- For real Launch Services routing (double-click `.md` in Finder), use `npm run make` then install/run `out/mdviewer-darwin-arm64/mdviewer.app`
- Production install: `./scripts/Install\ mdviewer.command` copies to `/Applications` and registers associations; uninstall via `./scripts/Uninstall\ mdviewer.command`

### Common Issues
- **Dev server won't stop**: `pkill -f Electron`
- **`.md` opens in wrong app**: a prior production install registered as default — set the default app via Finder Get Info, or delete `out/`
- **Main/preload changes not reflected**: restart `npm start`; HMR is renderer-only
- **markitdown errors at runtime in dev**: re-run `npm run setup:venv`. In the packaged app, end users need `markitdown` on PATH (and `ffmpeg` for audio); mdviewer shows a targeted install dialog if either is missing

### Cleaning Up
```bash
rm -rf out/                       # Remove production builds
rm -rf out/ node_modules/ .venv/  # Full clean
npm install
```

## Documentation Pattern

- **README.md** (~225 lines) — feature overview + 3 most recent changelog entries with a pointer to CHANGELOG.md (enforced by the `posttooluse-readme-recent-changes.sh` hook)
- **CHANGELOG.md** — full Keep-a-Changelog history (current version: see `package.json`)
- **docs/SECURITY-MODEL.md** — threat model (committed)
- **docs/REPO-HYGIENE.md** — contributor rules and CI enforcement (committed)
- **SECURITY.md** in repo root — historical CVE-style entries; gitignored

When adding features or fixes:
1. Add a detailed dated entry to `CHANGELOG.md`
2. If it is one of the 3 most recent versions, mirror a one-line summary into the README Changelog block
3. Bump `version` in `package.json` and the README version badge
4. Update `src/constants/defaultContent.ts` if the change is something the sample document should advertise
