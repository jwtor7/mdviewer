# mdviewer — OpenWiki Quickstart

> **The Markdown viewer that opens everything else too.**

mdviewer is a fast, offline-first Markdown viewer and editor for macOS. Beyond `.md`/`.markdown`, it converts most common document formats — PDF, DOCX, PPTX, XLSX, HTML, EPUB, CSV/JSON/XML, RTF, images, audio/video — to Markdown via [microsoft/markitdown](https://github.com/microsoft/markitdown). Audio/video transcription goes through the Web Speech API. Everything else runs locally with no telemetry.

Built on **Electron 39**, **React 19**, and **TypeScript 5** with a sandboxed renderer, Zod-validated IPC, and ~600 automated tests.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Electron 39 (Forge + Vite) |
| UI | React 19 |
| Language | TypeScript 5.9 (strict mode, multi-tsconfig) |
| Markdown | react-markdown, remark-gfm, rehype-sanitize, rehype-highlight |
| Diagrams | Mermaid 11 |
| Validation | Zod 4 (IPC schemas) |
| Testing | Vitest 3 + React Testing Library + jsdom |
| Code signing | Ad-hoc via `codesign --force --deep` in Forge afterComplete |
| Python (markitdown) | Project-local venv at `.venv/` |

## Get Started

```bash
npm install          # triggers postinstall → scripts/setup-venv.sh (creates .venv with markitdown)
npm start            # Electron Forge + Vite dev server with HMR
npm test             # vitest run (one-shot)
npm run typecheck    # tsc --noEmit across all processes
npm run lint         # eslint src/**/*.{ts,tsx}
npm run make         # premake runs tests first, then builds distributables
```

**Prerequisites:** Node 20.19.5 / npm 10.8.2 (Volta-pinned in `package.json`), Python 3.10+ or `uv` for markitdown.

> ⚠️ Dev mode does **not** register macOS file associations. Use `Cmd+O` or drag-and-drop to open files in dev. For real Launch Services routing, build with `npm run make` and install the `.app`.

## Five View Modes

| Mode | Description |
|------|-------------|
| Rendered | GitHub Flavored Markdown with syntax highlighting, Mermaid, interactive task-list checkboxes |
| Raw | Plain-text editor for the Markdown source |
| Split | Side-by-side editor and live preview with synchronized selection |
| Text | Grep-friendly plain-text extraction |
| Mermaid window | Dedicated zoomable window for Mermaid diagrams |

Cycle modes with `Cmd+E`. See the full keyboard shortcut table in [README.md](../README.md).

## Key Features

- **Multi-tab** editing with drag-to-spawn new windows
- **Read Aloud**: neural TTS via local [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro) model with automatic macOS `say` fallback; sentence prefetch, rate control, chapter navigation, synchronized paragraph highlighting
- **Find & Replace** with case-sensitive search and bulk replace
- **File conversion** via markitdown (PDF, DOCX, PPTX, XLSX, HTML, EPUB, images, audio/video → Markdown)
- **File watching** keeps tabs in sync with on-disk changes
- **Image embedding** via drag-drop (auto-copied to `./images/` with relative paths)
- **Themes**: System, Light, Dark, Solarized Light, Solarized Dark
- **Save as** Markdown, PDF, or Text
- **Status bar** with word/character/token/line counters and reading-time estimate

## Documentation Sections

| Section | What it covers |
|---------|---------------|
| [Architecture](architecture.md) | Electron multi-process model, build system, TypeScript config, code organization |
| [Security](security.md) | Sandboxed renderer, Zod-validated IPC, rate limiting, path/URL validation, CSP, Fuses, content limits |
| [IPC & Preload](ipc-and-preload.md) | IPC channel catalog, Zod schemas, preload bridge pattern, how to add a new channel |
| [File Handling](file-handling.md) | markitdown conversion, open-file routing, file watching, drag-drop, image embedding, macOS file associations |
| [Read Aloud (TTS)](read-aloud.md) | Kokoro neural engine, say fallback, dispatcher logic, Python worker protocol, speech pipeline, renderer hook |
| [Testing & Operations](testing-and-operations.md) | Vitest setup, mocking strategy, build & code signing, repo hygiene, install/uninstall |

## Existing Documentation

The repo ships with several in-depth documents worth consulting:

- [README.md](../README.md) — user-facing feature list, keyboard shortcuts, changelog highlights
- [CLAUDE.md](../CLAUDE.md) — agent guidance: commands, architecture overview, build gotchas, testing architecture
- [docs/PRD.md](../docs/PRD.md) — full product requirements document (v3.0.0)
- [docs/SECURITY-MODEL.md](../docs/SECURITY-MODEL.md) — defense-in-depth threat model
- [docs/SECURITY.md](../docs/SECURITY.md) — security practices overview
- [docs/REPO-HYGIENE.md](../docs/REPO-HYGIENE.md) — public-repo hygiene rules and enforcement
- [CHANGELOG.md](../CHANGELOG.md) — full release history

## Source Layout

```
src/
├── main.ts                  # Main process entry (48K) — IPC handlers, app lifecycle
├── preload.ts               # Preload bridge — contextBridge.exposeInMainWorld
├── renderer.tsx             # Renderer entry (bootstrap → App.tsx)
├── App.tsx                  # Root React component (45K) — orchestrates all hooks
├── index.css                # All styles (34K)
├── components/              # React components (MarkdownPreview, CodeEditor, FindReplace, etc.)
├── hooks/                   # Custom hooks (useDocuments, useTextToSpeech, useDragDrop, etc.)
├── utils/                   | Pure utilities (markdownToSpeech, speechChunker, fileValidator, etc.)
├── constants/               # Config constants (THEME_MODES, VIEW_MODES, SECURITY_CONFIG, DEFAULT_DOCUMENT)
├── types/                   # TypeScript types (electron.d.ts, ipc-schemas.ts, document.d.ts)
├── main/                    # Main-process modules
│   ├── windowManager.ts     # BrowserWindow creation, menu, window-count tracking
│   ├── openFileRouter.ts    # open-file event routing logic (unit-testable)
│   ├── fileWatcher.ts       # fs.watch-based per-window file watcher
│   ├── markitdown.ts        # Non-.md format conversion via Python venv
│   ├── externalOpenDefocus.ts  # Focus-stealing suppression for external opens
│   ├── tts/                 # Text-to-speech engines (Kokoro + say + dispatcher)
│   ├── security/            # IPC validation, path validation, rate limiter
│   └── storage/             # JSON-backed persistence (preferences, recent files)
├── test/setup.ts            # Vitest setup: jest-dom, window.electronAPI mock, browser API mocks
└── __mocks__/electron.ts    # Electron module stub for tests
```

## Important Conventions

- **All source is `.ts`/`.tsx`** — no `.js`/`.jsx` files in `src/`.
- **ESM imports in main-process code use `.js` extension** at the import site (the build emits ESM). Do not strip these.
- **Every IPC channel is Zod-validated** in the main process. Schemas live in `src/types/ipc-schemas.ts`. When touching IPC, also check `src/types/electron.d.ts`.
- **`DEFAULT_DOCUMENT`** in `src/constants/defaultContent.ts` ships as the test/sample doc — update it when roadmap/changelog changes.
- **Node is Volta-pinned to 20.19.5.** Do not unpin without verifying `npm run make` still works. `@electron/packager` hangs under Node 26/npm 11.
- **Code signing** requires the `afterComplete` hook in `forge.config.js` that runs `codesign --force --deep --sign -`. Without it, macOS TCC silently denies file access.
