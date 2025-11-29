# Markdown Viewer

<div align="center">

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-2.8.8-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green)
![Electron](https://img.shields.io/badge/electron-39.2.3-blueviolet)
![React](https://img.shields.io/badge/react-19.2.0-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)
![Accessibility](https://img.shields.io/badge/a11y-WCAG%202.1-blue)

**A feature-rich, accessible, and performant Markdown Viewer for macOS built with Electron, React, and TypeScript.**

![mdviewer Screenshot](https://github.com/jwtor7/mdviewer/raw/main/screenshot.png)

</div>

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Development & Testing](#development--testing)
- [Architecture](#architecture)
- [Feature Roadmap](#feature-roadmap)
- [Changelog](#changelog)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)
- [Acknowledgments](#acknowledgments)

## Features

- Multi-tab support for multiple Markdown documents
- Drag tabs outside to spawn new windows
- Four view modes: Rendered, Raw, Split (side-by-side), and Text (plain text)
- Synchronized text selection highlighting between Raw and Rendered views (Split mode)
- GitHub Flavored Markdown with tables, task lists, and strikethrough
- Syntax highlighting for code blocks
- Five themes: System, Light, Dark, Solarized Light, Solarized Dark
- Find & Replace with case-sensitive search, match navigation, and bulk replace
- Advanced formatting toolbar: headings, bold, italic, lists, code blocks, blockquotes, links
- Rich text copy to clipboard (HTML + plain text)
- Save as Markdown (.md), PDF (.pdf), or Text (.txt)
- Recent files menu with last 50 files (full paths)
- Unsaved changes prompts when closing tabs or quitting
- Real-time statistics: word, character, and token counts
- Custom undo/redo history (Cmd+Z, Cmd+Shift+Z)
- macOS file associations: open `.md` files with "Open With" or drag-and-drop
- WCAG 2.1 accessibility with full ARIA support and keyboard navigation
- 100% offline: no telemetry, no external requests
- Comprehensive security: sandboxed environment, CSP, input validation, rate limiting

### Keyboard Shortcuts
- `Cmd+N` - New document
- `Cmd+O` - Open file dialog
- `Cmd+S` - Save As
- `Cmd+F` - Find & Replace
- `Cmd+B` - Bold formatting
- `Cmd+I` - Italic formatting
- `Cmd+E` - Cycle view modes (Rendered → Raw → Split → Text)
- `Cmd+T` - Cycle themes
- `Cmd+Z` - Undo
- `Cmd+Shift+Z` / `Cmd+Y` - Redo

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

### View Modes
- **Rendered Mode**: Rendered Markdown with syntax highlighting
- **Raw Mode**: Raw Markdown source with monospace font
- **Split Mode**: Side-by-side code and preview with resizable divider
- Cycle through modes using the toolbar buttons or `Cmd+E`

### Formatting Text (Raw Mode)
1. Select text in the editor
2. Click formatting buttons or use keyboard shortcuts
3. Text is automatically wrapped with Markdown syntax

### Theme Switching
- Click the theme button in toolbar or press `Cmd+T`
- Cycles through: System → Light → Dark → System
- Respects OS theme preferences in System mode

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
├── components/     # MarkdownPreview, CodeEditor, ErrorNotification, FindReplace
├── hooks/          # useDocuments, useTheme, useTextFormatting, useFileHandler, etc.
├── types/          # TypeScript definitions
├── utils/          # Utility functions
└── constants/      # Configuration values
```

**Security Model**: Sandboxed renderer process with context isolation, secure IPC communication via preload script, strict CSP

## Feature Roadmap

### In Progress
- [ ] **Code Signing for GitHub**: Sign application for trusted distribution via GitHub releases
- [ ] **Code Signing for App Store**: Prepare for Apple App Store submission

### Planned
- [ ] **App Store Distribution**: Package and submit to Apple App Store
- [ ] **Outline/TOC Sidebar**: Collapsible sidebar showing document headings (H1-H6) with click-to-jump navigation, auto-highlights current section while scrolling, toggle via View menu or keyboard shortcut (Cmd+Shift+O)
- [ ] **Image Paste Support**: Paste images from clipboard directly into Raw view, auto-saves to `{document-folder}/images/`, inserts markdown image syntax, works with screenshots (Cmd+Shift+4 → Cmd+V)
- [ ] **Focus Mode**: Distraction-free writing mode that hides toolbar, tabs, and status bar, centers content with comfortable max-width, subtle fade on non-active paragraphs, toggle via View menu or Cmd+Shift+F
- [ ] **Word Wrap Toggle**: Toggle soft word wrap in Raw view, useful for viewing tables and code-heavy markdown, persisted preference, menu item in View menu with keyboard shortcut (Cmd+Alt+W)
- [ ] **Auto-Save Drafts**: Automatically save unsaved work to drafts folder, recover unsaved documents after crash/quit, configurable interval (default: 30 seconds), shows "Draft saved" indicator in status bar, drafts cleared when document explicitly saved

## Changelog

Full history: [CHANGELOG.md](./CHANGELOG.md)

### 2.8.10 - 2025-11-29
- Open Recent expanded to 50 files with full paths
- Always on Top window preference
- Right-click context menu

### 2.8.9 - 2025-11-27
- Tab context menu (Reveal in Finder)

### 2.8.8 - 2025-11-26
- Bug fixes

### 2.8.1 - 2025-11-25
- Removed DOCX export

### 2.8.0 - 2025-11-25
- Find in any view
- Custom undo/redo
- Bug fixes

### 2.7.13 - 2025-11-25
- Advanced formatting toolbar



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
