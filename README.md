# Markdown Viewer

<div align="center">

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-3.4.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green)
![Electron](https://img.shields.io/badge/electron-39.2.3-blueviolet)
![React](https://img.shields.io/badge/react-19.2.0-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)
![Accessibility](https://img.shields.io/badge/a11y-WCAG%202.1-blue)

**A feature-rich, accessible, and performant Markdown Viewer for macOS built with Electron, React, and TypeScript.**

![mdviewer Screenshot](https://github.com/jwtor7/mdviewer/raw/main/docs/screenshot.png)

</div>

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Development & Testing](#development--testing)
- [Architecture](#architecture)
- [Changelog](#changelog)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)
- [Acknowledgments](#acknowledgments)

## Features

### Core
- Multi-tab support with drag-to-spawn new windows
- Four view modes: Rendered, Raw, Split (side-by-side), Text (plain)
- GitHub Flavored Markdown (tables, task lists, strikethrough)
- Syntax highlighting for code blocks
- Synchronized selection highlighting in Split mode

### Editing
- Find & Replace with case-sensitive search, match navigation, bulk replace
- Formatting toolbar: headings, bold, italic, lists, code, quotes, links
- Custom undo/redo history (Cmd+Z, Cmd+Shift+Z)
- Unsaved changes indicators in tabs and window title
- Word wrap toggle for code-heavy content
- Rich text copy (HTML + plain text)

### Themes
- Five themes: System, Light, Dark, Solarized Light, Solarized Dark
- Respects OS preferences in System mode

### Files & Images
- Save as Markdown (.md), PDF (.pdf), or Text (.txt)
- Drag-drop images to embed (auto-copies to `./images/`)
- Relative image paths supported in preview
- Recent files menu (last 50 with full paths)
- Unsaved changes prompts on close/quit
- macOS file associations ("Open With", drag-drop)

### Stats & Accessibility
- Real-time word, character, and token counts
- WCAG 2.1 with full ARIA support and keyboard navigation

### Privacy & Security
- No telemetry; no external requests unless you open a link or use web search actions
- Sandboxed environment, CSP, input validation

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New document |
| `Cmd+O` | Open file dialog |
| `Cmd+S` | Save As |
| `Cmd+W` | Close tab |
| `Cmd+F` | Find & Replace |
| `Cmd+B` | Bold formatting |
| `Cmd+I` | Italic formatting |
| `Cmd+E` | Cycle view modes (Rendered → Raw → Split → Text) |
| `Cmd+T` | Cycle themes |
| `Cmd+Alt+W` | Toggle word wrap |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` / `Cmd+Y` | Redo |

## Installation

### From Source
1. Clone the repository:
   ```bash
   git clone https://github.com/jwtor7/mdviewer.git
   cd mdviewer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start in development mode:
   ```bash
   npm start
   ```

### Build for Production
```bash
# Package the app (creates app bundle)
npm run package

# Create distributable installer
npm run make
```

### Installing / Upgrading

To install (or upgrade to) the latest version:

**Option 1: Double-click** (easiest)
- Open `scripts/Install mdviewer.command` in Finder and double-click it

**Option 2: Terminal**
```bash
./scripts/Install\ mdviewer.command
```

This will:
1. Remove any existing installation and app data
2. Build the latest version from source
3. Install to `/Applications/mdviewer.app`

### Uninstalling

To completely remove mdviewer and all its data:

**Option 1: Double-click** (easiest)
- Open `scripts/Uninstall mdviewer.command` in Finder and double-click it

**Option 2: Terminal**
```bash
./scripts/Uninstall\ mdviewer.command
```

This removes:
- `/Applications/mdviewer.app`
- `~/Library/Application Support/mdviewer` (preferences, recent files)
- `~/Library/Preferences/com.electron.mdviewer.plist`
- `~/Library/Caches/com.electron.mdviewer`
- `~/Library/Saved Application State/com.electron.mdviewer.savedState`

## Usage

### Opening Files
- **Drag & Drop**: Drag `.md` files onto the app icon or window
- **File Association**: Right-click `.md` files → "Open With" → mdviewer
- **Within App**: Use tabs to manage multiple open documents

### Working with Content
- **View Modes**: Cycle between Rendered, Raw, Split, and Text modes using toolbar buttons or `Cmd+E` (see [Features](#features) for details)
- **Themes**: Cycle through 5 themes with toolbar button or `Cmd+T`
- **Formatting**: Select text in Raw mode, then use toolbar buttons or keyboard shortcuts
- **Find & Replace**: Press `Cmd+F` to open the search panel

## Development & Testing

### Quick Start
```bash
# Development server (hot reload enabled)
npm start

# Build production app
npm run make
```

### Running Tests
```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode (re-runs on file changes)
npm run test:coverage # Generate coverage report
npm run test:ui       # Launch interactive Vitest UI
```

**Test stack**: Vitest, React Testing Library, jsdom

**Test structure**: Tests are co-located with source files (`*.test.ts`, `*.test.tsx`)

### Testing File Opening
**Development mode**: Use File → Open (Cmd+O) or drag-and-drop onto app window
**Production mode**: Build with `npm run make`, then double-click .md files in Finder

### Cleanup
```bash
# Remove production builds
rm -rf out/

# Full clean
rm -rf out/ node_modules/ && npm install
```


## Architecture

**Tech Stack**: Electron 39.2.3, React 19.2.0, TypeScript 5.9.3, Vite, react-markdown, remark-gfm, rehype-highlight

**Project Structure**:
```
src/
├── main.ts, preload.ts, renderer.tsx, App.tsx
├── main/           # Modular main process (security/, storage/, windowManager)
├── components/     # MarkdownPreview, CodeEditor, ErrorNotification, FindReplace
├── hooks/          # useDocuments, useTheme, useTextFormatting, useFileHandler, etc.
├── types/          # TypeScript definitions + Zod IPC schemas
├── utils/          # Utility functions
└── constants/      # Configuration values
```

**Key Patterns**:
- Modular main process: security (IPC validation, rate limiting, path validation), storage (preferences, recent files), window management
- Custom React hooks for state management (12 hooks extracted from App.tsx)
- Zod-based runtime validation for all IPC handlers
- 395+ tests with Vitest and React Testing Library

**Security Model**: Sandboxed renderer with context isolation, Zod IPC validation, rate limiting, path traversal protection, URL allowlisting, strict CSP. See [docs/SECURITY-MODEL.md](./docs/SECURITY-MODEL.md) for details.

## Changelog

Full history: [CHANGELOG.md](./CHANGELOG.md)

### 3.4.2 - 2026-02-27
- IPC response standardization with `IPCResult<T>` pattern
- Document ID generation using `crypto.randomUUID()`
- Rehype-based search highlighting and race condition fixes

### 3.4.1 - 2026-02-12
- Added copyright notice to status bar

### 3.4.0 - 2026-02-04
- IPC validation and security hardening across all handlers
- Faster rendered search highlighting + debounced Find & Replace
- PDF export waits for font readiness for more reliable output

### 3.3.1 - 2026-01-10
- Install scripts auto-clean build artifacts (saves ~1.4GB disk space)

### 3.3.0 - 2026-01-09
- Intelligent PDF page breaking with section wrapping (headings stay with content)

### 3.1.0 - 2026-01-05
- Major refactoring: modular architecture, 395 tests, Zod IPC validation

### 3.0.7 - 2025-12-11
- Security fix: Prevent tab drag data leak

### 3.0.6 - 2025-12-10
- Fix tab tear-off (drag tabs out to create new windows)

### 3.0.5 - 2025-12-06
- Fix tab dragging race conditions
- Add Cmd+W to close tabs

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see [LICENSE](LICENSE) for details

## Author

**Junior**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://ca.linkedin.com/in/juniorw)
[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/@jr.trustcyber)
[![Substack](https://img.shields.io/badge/Substack-FF6719?style=for-the-badge&logo=substack&logoColor=white)](https://substack.com/@trustcyber)
[![X (Twitter)](https://img.shields.io/badge/X-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/TrustCyberJR)

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI powered by [React](https://react.dev/)
- Markdown rendering by [react-markdown](https://github.com/remarkjs/react-markdown)
- Syntax highlighting by [react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter)
