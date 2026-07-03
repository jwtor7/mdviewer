# Testing & Operations

## Testing

### Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | ^3.2.4 | Test runner |
| @vitest/coverage-v8 | ^3.2.4 | Code coverage |
| @vitest/ui | ^3.2.4 | Browser-based test UI |
| React Testing Library | ^16.3.0 | Component testing |
| @testing-library/jest-dom | ^6.9.1 | DOM matchers |
| @testing-library/user-event | ^14.6.1 | User interaction simulation |
| jsdom | ^25.0.1 | DOM environment |

### Configuration

**`vitest.config.ts`:**
- Environment: `jsdom`
- Globals enabled (`describe`, `it`, `expect` without imports)
- `@` alias → `src/`
- Setup file: `src/test/setup.ts`
- Coverage excludes: `node_modules/`, `out/`, `.vite/`, `src/test/`, `*.d.ts`, `*.config.*`, `src/main.ts`, `src/preload.ts`

**Coverage thresholds:** Lines 30%, Functions 50%, Branches 50%, Statements 30%.

### Test File Conventions

- **Co-located:** `Foo.ts` → `Foo.test.ts`, `Foo.tsx` → `Foo.test.tsx`
- ~25 test files across components, hooks, utils, and main-process modules
- Main-process extracted modules (`src/main/fileWatcher`, `openFileRouter`, `windowManager`, `tts/*`) **are** tested; `src/main.ts` and `src/preload.ts` are **not** (Electron-only, excluded from coverage)

### Mocking Strategy

**Electron APIs** — `src/test/setup.ts` exposes a fully stubbed `window.electronAPI` covering all current IPC surfaces:
- File ops: `onFileOpen`, `onFileNew`, `onFileSave`, `onSaveAllAndQuit`, `readFile`, `saveFile`, `exportPDF`, `revealInFinder`
- Window management: `createWindowForTab`, `closeWindow`, `openMermaidWindow`
- File watching: `watchFile`, `unwatchFile`, `onFileChanged`
- Images: `readImageFile`, `copyImageToDocument`, `saveImageFromData`
- TTS: `startSpeech`/`stopSpeech`/`pauseSpeech`/`resumeSpeech`/`listVoices`/`onSpeechEnd`/`getTTSEngineStatus`/`onTTSEngineChanged`
- Misc: `openExternalUrl`, `showUnsavedDialog`, `getPathForFile`, `logDebug`

> When adding a new IPC channel, extend this mock in `src/test/setup.ts`.

**Electron module** — `src/__mocks__/electron.ts` stubs `ipcRenderer`, `contextBridge`, `webUtils`, `app`, `BrowserWindow`, `dialog`, `Menu`, `shell`.

**Browser APIs** — `window.matchMedia`, `localStorage`, and `ResizeObserver` are mocked. `HTMLElement.prototype.scrollIntoView` is a `vi.fn()`.

### Commands

```bash
npm test               # vitest run (one-shot)
npm run test:watch     # vitest (watch mode)
npm run test:coverage  # vitest run --coverage
npm run test:ui        # vitest --ui (browser interface)
```

`premake` runs the full test suite before any distributable build (`npm run make`) — a failing test blocks the build.

### What's Not Tested

- **Renderer entry** (`src/renderer.tsx`) — trivial bootstrap
- **Preload script** (`src/preload.ts`) — excluded from coverage; would need context-isolation test setup
- **`src/main.ts`** — excluded from coverage (Electron-only, large file)
- **E2E** — no Playwright/Spectron harness

## Build & Code Signing

### Node Toolchain (Volta-Pinned)

**This repo is pinned to Node 20.19.5 / npm 10.8.2 via the `volta` field in `package.json`.** Do not unpin without verifying `npm run make` still completes.

`@electron/packager` hangs indefinitely under Node 26 / npm 11 while extracting the Electron runtime template ZIP. The hang surfaces as the listr task "Copying files" sitting forever with no error. Under Node 20 LTS the same source tree builds cleanly in ~30–60s.

If `node -v` reports a version other than 20.19.5, Volta is either not installed or not on PATH. Install Volta (`curl https://get.volta.sh | bash`) before debugging any build hang.

### Code Signing & TCC

**`forge.config.js` MUST run `codesign --force --deep --sign -` on the packaged bundle via an `afterComplete` hook.** Without it, every packaged build ships with a broken signature and macOS TCC silently denies all file-access requests with no prompt and no entry in System Settings → Privacy & Security.

**The problem:** `@electron/packager` extracts a prebuilt Electron binary that is already ad-hoc-signed with `Identifier=com.github.Electron`. Setting `appBundleId: 'ca.trustcyber.mdviewer'` causes the packager to rewrite `Info.plist` **after the signature is sealed**, invalidating the seal. macOS TCC requires a valid code signature to attribute file-access requests; with an invalid signature it silently denies without prompting.

**The fix:** The `afterComplete` hook re-signs the whole bundle bottom-up as a single coherent unit, producing a valid ad-hoc signature with the correct Identifier and the Info.plist rebound.

> ⚠️ Do not try to use the packager-native `osxSign` option. It is broken for ad-hoc signing — see `CLAUDE.md` for the full diagnosis of both failure modes.

**Diagnostic commands:**
```bash
codesign -dv --verbose=4 /Applications/mdviewer.app 2>&1 | grep -E "Identifier|Signature|Info.plist"
codesign --verify --deep --strict /Applications/mdviewer.app
```

Healthy state: `Identifier=ca.trustcyber.mdviewer`, `Info.plist entries=N` (non-zero), `codesign --verify` exits clean. If you see `Identifier=com.github.Electron` or `Info.plist=not bound`, the `afterComplete` hook isn't running.

**One-shot repair:** `codesign --force --deep --sign - /Applications/mdviewer.app && tccutil reset All ca.trustcyber.mdviewer`

**CDHash note:** Ad-hoc signatures contain a content-derived CDHash that changes on every rebuild. The macOS Keychain ACL on Electron's Safe Storage entry is bound to a specific CDHash, so every rebuild re-prompts for Keychain access on first launch (click Always Allow). The TCC grant for Documents/Desktop/Downloads is bound to the bundle ID and survives rebuilds.

### Build Commands

```bash
npm run package        # Bundle (no installer)
npm run make           # Build distributables (runs npm test first via premake)
npm run publish        # Electron Forge publish
```

### Dev Server

```bash
npm start              # Electron Forge + Vite dev server with HMR
```

- Renderer changes (React, CSS) → auto-reload
- Main / preload changes → restart required (`Ctrl+C`, fall back to `pkill -f Electron`)
- DevTools: uncomment `openDevTools()` in `src/main.ts` or `windowManager.ts`

## Repo Hygiene

mdviewer is a public repo. Three layers enforce hygiene, all backed by `scripts/check-no-pii.sh`:

1. **Pre-commit hook** (`.husky/pre-commit`) — blocks commits that introduce absolute user paths, secrets, or local IDE state. Wired automatically by `npm install` via the `prepare` script.
2. **GitHub Actions** (`.github/workflows/repo-hygiene.yml`) — re-scans the full tree on every push and PR. Runs on `macos-latest` with Node 22, `npm ci --ignore-scripts`, then the PII scan and `npm test`.
3. **Manual scan** — `bash scripts/check-no-pii.sh` anytime. Exit 0 means clean.

**What's blocked:** absolute home paths (`/Users/yourname/...`), API keys/tokens/passwords/PEM keys, `.claude/` and `.idea/` state, `.env*` files.

**Allowlist:** `scripts/check-no-pii.sh` has a `case` block listing accepted placeholder paths (`/Users/john/`, `/Users/name/`, `/tmp/`). Add new entries there with a comment.

**Bypass:** `git commit --no-verify` (auditable via `git log --grep '\[skip-hygiene\]'`). CI still runs on push.

See [docs/REPO-HYGIENE.md](../docs/REPO-HYGIENE.md) for full rules.

## Install / Uninstall

| Script | Purpose |
|--------|---------|
| `scripts/Install mdviewer.command` | Copies built `.app` to `/Applications` and registers file associations |
| `scripts/Uninstall mdviewer.command` | Removes from `/Applications` and unregisters associations |
| `scripts/install.sh` | Alternative installer (derives paths at runtime) |
| `scripts/setup-venv.sh` | Creates `.venv/` with `markitdown[all]` (runs on `npm install`) |

## Linting & Type Checking

```bash
npm run lint           # ESLint over src/**/*.{ts,tsx}
npm run lint:fix       # ESLint with --fix
npm run typecheck      # tsc --noEmit (all processes)
npm run typecheck:main    # Main process only
npm run typecheck:preload # Preload only
npm run typecheck:renderer # Renderer only
```

ESLint uses `eslint-plugin-security` and `eslint-plugin-no-secrets` for static security analysis.
