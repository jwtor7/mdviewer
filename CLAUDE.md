# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

mdviewer is an offline-capable Markdown Viewer desktop application for macOS built with Electron. It provides a clean interface for viewing and editing Markdown files with GitHub Flavored Markdown support, syntax highlighting, and theme switching.

## Key Commands

### Development
```bash
npm start                    # Start the app in development mode with hot reload
npm run package              # Package the app for distribution (does not create installer)
npm run make                 # Create distributable installers for the platform
npm run lint                 # Currently no linting configured
```

### Building
- **Development**: `npm start` uses Electron Forge with Vite for hot module replacement
- **Production**: `npm run make` creates platform-specific distributables (DMG for macOS, etc.)

## Architecture

### Electron Multi-Process Architecture

The application follows Electron's standard three-process model:

1. **Main Process** (`src/main.js`):
   - Creates and manages the BrowserWindow
   - Handles macOS file associations and "Open With" functionality
   - Listens for `open-file` events (drag-and-drop onto app icon, file associations)
   - Reads file contents and sends to renderer via IPC (`file-open` event)
   - Security: Runs with full Node.js access

2. **Preload Script** (`src/preload.js`):
   - Uses `contextBridge` to safely expose `electronAPI` to renderer
   - Provides `onFileOpen` callback for receiving file contents
   - Security: Bridges isolated renderer with main process

3. **Renderer Process** (`src/renderer.jsx` → `src/App.jsx`):
   - React application with two main view modes: Preview and Code
   - Listens for file content via `window.electronAPI.onFileOpen`
   - Security: Runs in sandboxed environment with strict CSP

### Component Structure

- **App.jsx**: Main application container managing state (content, viewMode, theme), toolbar, and status bar
- **MarkdownPreview.jsx**: Renders Markdown using `react-markdown` with GitHub Flavored Markdown (`remark-gfm`) and syntax highlighting (`react-syntax-highlighter`)
- **CodeEditor.jsx**: Simple textarea wrapper with ref forwarding for text selection/formatting

### Build System

The project uses Electron Forge with Vite:
- `forge.config.js`: Electron Forge configuration with makers (Squirrel, ZIP, Deb, RPM) and macOS file association setup
- `vite.main.config.mjs`: Vite config for main process
- `vite.preload.config.mjs`: Vite config for preload script
- `vite.renderer.config.mjs`: Vite config for renderer process (React app)

### Inter-Process Communication

File opening flow:
1. User drags `.md` file onto app icon or uses "Open With"
2. Main process `open-file` event triggered
3. Main reads file via `fs.readFile`
4. Main sends content to renderer: `mainWindow.webContents.send('file-open', data)`
5. Renderer receives via preload bridge: `electronAPI.onFileOpen(callback)`

### Security Model

- **Sandbox enabled**: Renderer runs in sandboxed environment
- **Context isolation**: Renderer cannot directly access Node.js APIs
- **No node integration**: `nodeIntegration: false` in webPreferences
- **Content Security Policy**: Strict CSP via rehype-sanitize in Markdown rendering
- **Fuses**: Production builds use Electron Fuses for additional hardening

### macOS-Specific Features

File associations configured in `forge.config.js`:
- UTI: `net.daringfireball.markdown`
- Extensions: `.md`, `.markdown`
- Role: Editor (allows "Open With")
- Handler Rank: Owner (preferred app for .md files)

## Key Features Implementation

### Theme System
Three-mode theme toggle (system/light/dark) using CSS custom properties on `document.documentElement` with `data-theme` attribute. Listens to OS theme changes via `matchMedia('prefers-color-scheme: dark')`.

### Rich Text Copy
- **Code view**: Copies plain Markdown text
- **Preview view**: Uses Clipboard API to copy both HTML and plain text representations for rich paste support

### Status Bar
Real-time statistics calculated from content state:
- Word count: Split on whitespace
- Character count: String length
- Token count: Approximation (length / 4)

### Text Formatting
Applies Markdown formatting (bold/italic/list) to selected text in Code view by manipulating textarea selection ranges.

## Development Notes

### JSX Files
The project uses `.jsx` extensions for files containing JSX syntax. `renderer.jsx` (not `.js`) is the entry point to support JSX transpilation.

### DevTools
DevTools are commented out in production. Uncomment `mainWindow.webContents.openDevTools()` in `src/main.js:35` for debugging.

### React Version
Uses React 19.2.0 with modern hooks (useState, useEffect, useRef, forwardRef).

## Testing & Development Workflow

### Development Server

**Starting the dev server:**
```bash
npm start
```

This launches Electron with Vite's HMR (hot module replacement):
- **Renderer changes** (React components, hooks, CSS) → Auto-reload instantly
- **Main/preload changes** (main.js, preload.js) → Requires manual restart

**Stopping the dev server:**
```bash
# Press Ctrl+C in the terminal
# If that doesn't work (process detached):
pkill -f Electron
```

### Testing File Opening

#### Development Mode (npm start)

The dev server does NOT register macOS file associations. To test file opening:

**Method 1: File → Open Menu**
1. Start: `npm start`
2. Click **File → Open** in menu bar (or `Cmd+O`)
3. Select `.md` file(s)
4. Test multiple files to verify no duplicate tabs

**Method 2: Drag and Drop**
1. Start: `npm start`
2. Drag `.md` files from Finder onto app window
3. Drop to open
4. Test with multiple files

**Why these methods?**
- Dev server isn't a registered .app bundle
- macOS doesn't route file-open events to non-registered apps
- File → Open and drag-and-drop work in all modes

#### Production Mode (npm run make)

To test actual macOS file associations (double-clicking .md files):

```bash
# Build production app
npm run make

# App location:
# /Users/true/dev/mdviewer/out/mdviewer-darwin-arm64/mdviewer.app

# Now test by double-clicking .md files in Finder
```

**⚠️ Important:**
- Production builds register with macOS via `LSHandlerRank: 'Owner'` in `forge.config.js`
- This makes mdviewer the default app for `.md` files
- To reset: Delete `out/` directory and set different default app via Finder

### Testing Checklist

**File Opening Fixes (Priority):**
- [ ] First file open: No "Untitled" default document shows
- [ ] Same file opened twice: No duplicate tabs
- [ ] Different files: Each opens once only
- [ ] Drag-and-drop multiple files: All open without duplicates
- [ ] File → Open: Works identically to drag-and-drop

**Regression Tests:**
- [ ] Theme switching (System/Light/Dark)
- [ ] View mode toggle (Preview/Code)
- [ ] Text formatting (Bold/Italic/List)
- [ ] Copy to clipboard (both modes)
- [ ] Tab closing and switching
- [ ] Status bar statistics
- [ ] Keyboard shortcuts (Cmd+O/B/I/E/T)

### Common Issues

**Issue: Dev server won't stop**
- Solution: `pkill -f Electron`

**Issue: .md files open in wrong app**
- Cause: Production build registered as default app
- Solution: Delete `out/` directory, then set default app via Finder

**Issue: Changes not reflecting**
- Renderer changes should auto-reload
- Main/preload changes need restart: Stop (`Ctrl+C`) and `npm start` again

**Issue: File associations not working**
- Dev mode: Use File → Open or drag-and-drop (expected behavior)
- Production mode: Build with `npm run make` first

### Cleaning Up

```bash
# Remove production builds
rm -rf /Users/true/dev/mdviewer/out/

# Full clean (also node_modules)
rm -rf out/ node_modules/
npm install
```

### Development Best Practices

1. **Use dev server for daily work**: `npm start` with File → Open or drag-and-drop
2. **Test file associations in production**: Only when needed, use `npm run make`
3. **Clean up production builds**: Delete `out/` after testing file associations
4. **Restart for main/preload changes**: HMR only works for renderer code
5. **Use keyboard shortcuts**: `Cmd+O` to open files quickly during testing
