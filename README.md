# Markdown Viewer

<div align="center">

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-5.4.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green)
![Electron](https://img.shields.io/badge/electron-39.2.3-blueviolet)
![React](https://img.shields.io/badge/react-19.2.0-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)
![Tests](https://img.shields.io/badge/tests-548%20passing-brightgreen)
![Accessibility](https://img.shields.io/badge/a11y-WCAG%202.1-blue)

**The Markdown viewer that opens everything else too.**

</div>

mdviewer is a fast, offline-first Markdown viewer and editor for macOS. Drop in a PDF, a Word doc, a spreadsheet, a web page, an e-book, a voice memo, an MP4 recording — mdviewer reads it back to you as clean Markdown. No round trips to a browser, no copy/paste from a preview pane, no fumbling with format-specific apps just to grab a paragraph.

Built on Electron 39, React 19, and TypeScript 5 with a sandboxed renderer, Zod-validated IPC, and 548 automated tests.

---

## What's New in v5.4.0

> **First-class macOS citizenship.** mdviewer now ships under a stable bundle identifier (`ca.trustcyber.mdviewer`), so the permissions you grant it actually belong to *this* app — not to "every ad-hoc-signed Electron build on your system."

- **Images in protected folders just work** — Documents, Desktop, Downloads, removable, and network volumes all carry proper `NS*UsageDescription` strings. macOS prompts on first use and remembers your answer across rebuilds
- **Permission-aware error UX** — when macOS denies a sibling-image read, mdviewer shows a dedicated banner with a one-click deep-link to System Settings → Privacy & Security → Files & Folders. No more silent "Image not found" mystery
- **POSIX error codes plumbed through IPC** — the renderer can finally distinguish `EACCES` (permission denied) from `ENOENT` (genuinely missing) without parsing localized error strings
- **Hardened release pipeline** — reproducible builds via a Volta-pinned Node 20.19.5 toolchain, and a one-line `afterComplete` re-sign hook so TCC can actually attribute file access to mdviewer instead of silently denying

See [CHANGELOG.md](./CHANGELOG.md) for the full release notes.

---

## Why mdviewer

**One window for every document you open.** Drag a vendor RFP onto the app and read the PDF as Markdown. Paste a URL's downloaded HTML and get structured content without the ads. Dump a quarterly XLSX and walk through the tables in your own typography. Drop an MP3 voice memo or MP4 screen capture and get back a transcript.

**Five view modes, one file.** Rendered for reading, Raw for editing, Split for live preview, Text for grep-friendly plain text, and a dedicated Mermaid diagram window for architecture sketches.

**Markdown-first, everything else is gravy.** `.md` files open instantly and work entirely offline. Non-Markdown conversion runs through [microsoft/markitdown](https://github.com/microsoft/markitdown); if it's not installed, you get a helpful install dialog instead of a silent failure.

## Supported Formats

| Category | Extensions |
|----------|-----------|
| **Markdown** (native, zero dependencies) | `.md`, `.markdown` |
| **Documents** | `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.epub`, `.rtf` |
| **Web & Data** | `.html`, `.htm`, `.csv`, `.json`, `.xml` |
| **Plain Text** | `.txt`, `.rst` |
| **Images** (OCR + metadata) | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.tiff`, `.bmp` |
| **Audio & Video** (transcription) | `.wav`, `.mp3`, `.m4a`, `.mp4` |
| **Archives** | `.zip` |

## Drop-in Transcription for Audio and Video

Drag a WAV, MP3, M4A, or MP4 file onto the window and mdviewer returns a Markdown transcript. No separate tool, no web upload, no conversion pipeline — it's the same workflow as opening a PDF.

Use it to:

- Turn a voice memo into notes you can edit and save
- Pull quotes and action items out of a recorded meeting
- Capture audio diaries or podcast segments as searchable text
- Extract dialogue from an MP4 screen recording without ever leaving the app

Transcription uses Google's Web Speech API under the hood (the one browsers use for dictation). It is free, requires internet, and is the only outbound request mdviewer ever makes — everything else runs locally.

## Features

### Reading & Editing
- Multi-tab with drag-to-spawn new windows
- Four view modes: Rendered, Raw, Split (side-by-side), Text (plain)
- GitHub Flavored Markdown: tables, task lists, strikethrough
- Syntax highlighting across 180+ languages
- Mermaid diagrams with adaptive-contrast nodes and a zoomable window
- Synchronized selection highlighting in Split mode
- Find & Replace with case-sensitive search and bulk replace
- Formatting toolbar: headings, bold, italic, lists, code, quotes, links
- Read Aloud: native macOS narration that skips URLs, code blocks, and ASCII tables. Voice/rate picker, pause/resume, per-tab scoping, sentence and chapter navigation, synchronized paragraph highlighting in Rendered view
- Custom undo/redo history, unsaved-change indicators, word count goals, reading-time estimate, line/word/character/token counters in the status bar

### Themes
- System, Light, Dark, Solarized Light, Solarized Dark
- System mode follows macOS appearance in real time

### Files & Images
- Save as Markdown, PDF, or Text
- Drag-drop images to embed (auto-copied to `./images/` with relative paths)
- Recent files menu (last 50, full paths)
- macOS file associations across every supported extension
- Permission-aware image rendering with one-click deep-links into System Settings

### Privacy & Security
- No telemetry, no analytics, no background network calls
- Audio transcription is the only outbound request and only runs when you open an audio file
- Sandboxed renderer, context isolation, strict CSP, Zod-validated IPC
- Stable bundle identifier so macOS TCC grants persist across rebuilds
- See [docs/SECURITY-MODEL.md](./docs/SECURITY-MODEL.md) for the full threat model

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New document |
| `Cmd+O` | Open file dialog |
| `Cmd+S` | Save As |
| `Cmd+W` | Close tab |
| `Cmd+F` | Find & Replace |
| `Cmd+B` | Bold |
| `Cmd+I` | Italic |
| `Cmd+E` | Cycle view modes (Rendered → Raw → Split → Text) |
| `Cmd+T` | Cycle themes |
| `Cmd+Alt+W` | Toggle word wrap |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` / `Cmd+Y` | Redo |
| `Cmd+Shift+R` | Start / pause / resume reading |
| `Cmd+Shift+.` | Stop reading |
| `Cmd+Shift+→` / `Cmd+Shift+←` | Next / previous sentence while reading |
| `Cmd+Shift+]` / `Cmd+Shift+[` | Next / previous chapter while reading |
| `Cmd+Alt+Shift+R` | Read from cursor (Raw or Split view) |

## Installation

### From Source

```bash
git clone https://github.com/jwtor7/mdviewer.git
cd mdviewer
npm install
npm start
```

`npm install` runs `scripts/setup-venv.sh` via `postinstall` to create a Python venv at `.venv/` and install `markitdown[all]`. It uses `uv` if available, otherwise falls back to `python -m venv` + pip. Recreate with `npm run setup:venv` if the venv gets stale.

**Requirements**: macOS, Node 20+ (the repo is Volta-pinned to 20.19.5), and either [`uv`](https://docs.astral.sh/uv/) (recommended) or Python 3.10+.

### Build & Install the Production App

```bash
./scripts/Install\ mdviewer.command
```

This script builds a release, copies `mdviewer.app` into `/Applications`, and registers macOS file associations for every supported format. Markdown becomes the default handler; documents, images, and audio register as alternate viewers so they don't displace Preview, Word, or your existing tools.

**End-user runtime note**: the packaged `.app` does not bundle Python. For non-Markdown conversion to work outside your dev environment, end users need `markitdown` on their `PATH`:

```bash
uv tool install 'markitdown[all]'   # or: pipx install 'markitdown[all]'
```

For audio conversion specifically, `ffmpeg` must also be reachable (`brew install ffmpeg`). If anything is missing, mdviewer surfaces a targeted install dialog — Markdown files always work with zero runtime dependencies.

### Uninstalling

```bash
./scripts/Uninstall\ mdviewer.command
```

Removes `/Applications/mdviewer.app`, preferences, caches, saved state, and Application Support data.

## Development

```bash
npm start            # Dev server with hot reload
npm test             # Run the test suite (548 tests)
npm run test:watch   # Watch mode
npm run test:coverage
npm run typecheck    # tsc across all three processes
npm run lint
```

**Tech stack**: Electron 39, React 19, TypeScript 5, Vite, react-markdown, remark-gfm, rehype-highlight, mermaid.

**Test stack**: Vitest, React Testing Library, jsdom. Tests are co-located with source files (`Component.test.tsx`).

**Testing file opening in dev**: the dev server does not register macOS file associations. Use `Cmd+O` or drag-and-drop. For real Launch Services testing, build a production `.app` via `npm run make` and install it.

## Architecture

```
src/
├── main.ts           Main process entry
├── preload.ts        Context-isolated IPC bridge
├── renderer.tsx      React entry
├── App.tsx           Application shell
├── main/             Modular main-process code
│   ├── security/     IPC validation, rate limiting, path validation
│   ├── storage/      Preferences, recent files
│   ├── markitdown.ts Conversion module + PATH resolution
│   ├── windowManager.ts
│   ├── openFileRouter.ts
│   ├── fileWatcher.ts
│   └── tts.ts
├── components/       MarkdownPreview, CodeEditor, MermaidDiagram, FindReplace, ...
├── hooks/            16 custom hooks (useDocuments, useTheme, useFileHandler, ...)
├── types/            Type definitions + Zod IPC schemas
├── utils/            Text stats, PDF rendering, speech chunking, rehype plugins
└── constants/        Configuration values
```

**Security model**: sandboxed renderer with context isolation, all IPC handlers wrapped in Zod runtime validation, per-window rate limiting, path-traversal protection, URL allowlisting, strict Content Security Policy, and a stable code-signed bundle identifier so macOS TCC grants persist. Every inbound channel has a schema; every outbound URL runs through `validateExternalUrl`.

<details>
<summary>Architecture diagram</summary>

![Architecture diagram](./docs/architecture-diagram.png)

</details>

## Changelog

Recent releases below. Full history in [CHANGELOG.md](./CHANGELOG.md).

- **v5.4.0** — Fixed image loading in TCC-protected folders. Stable `ca.trustcyber.mdviewer` bundle ID so macOS grants survive rebuilds. Permission-aware error banner with a deep-link to System Settings → Privacy & Security → Files & Folders. Volta-pinned Node toolchain. Re-sign hook so packaged builds carry a valid signature
- **v5.3.0** — `Lines:` counter added to the status bar between `Tokens:` and the reading-time indicator. Standard `split('\n')` semantics; `TextStats` interface gains a `lineCount` field covered by 6 new unit tests
- **v5.2.4** — External `open file.md` commands no longer steal focus when mdviewer is not the active app. Existing-window route uses a soft de-activation (`app.hide()` + `app.show()`) chained via the window's `hide` event for race-free defocus

## Contributing

Issues and pull requests are welcome. Before opening a PR, read [docs/REPO-HYGIENE.md](docs/REPO-HYGIENE.md) for the rules on what doesn't belong in commits (absolute home paths, local agent state, secrets) and how the pre-commit hook and CI workflow enforce them.

## License

MIT — see [LICENSE](LICENSE).

## Author

**Junior Williams**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://ca.linkedin.com/in/juniorw)
[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/@jr.trustcyber)
[![Substack](https://img.shields.io/badge/Substack-FF6719?style=for-the-badge&logo=substack&logoColor=white)](https://substack.com/@trustcyber)
[![X (Twitter)](https://img.shields.io/badge/X-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/TrustCyberJR)

## Acknowledgments

- [Electron](https://www.electronjs.org/) for the runtime
- [React](https://react.dev/) for the UI
- [react-markdown](https://github.com/remarkjs/react-markdown) for rendering
- [react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter) for code blocks
- [microsoft/markitdown](https://github.com/microsoft/markitdown) for universal document conversion
- [mermaid](https://mermaid.js.org/) for diagrams
