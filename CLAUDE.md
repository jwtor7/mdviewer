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

### Testing
```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode (re-runs on file changes)
npm run test:coverage # Generate coverage report
npm run test:ui       # Launch interactive Vitest UI
```

## Testing Architecture

### Stack
- **Vitest**: Fast, Vite-native test runner
- **React Testing Library**: Component and hook testing
- **jsdom**: Browser environment simulation for Node.js
- **@vitest/coverage-v8**: Code coverage reporting

### Configuration Files
- `vitest.config.ts`: Main test configuration (environment, aliases, coverage thresholds)
- `tsconfig.test.json`: TypeScript config for test files
- `src/test/setup.ts`: Global setup (jest-dom matchers, mocks)
- `src/__mocks__/electron.ts`: Electron module mocks

### Test File Conventions
- Tests are co-located with source files: `Component.tsx` → `Component.test.tsx`
- Use `.test.ts` for utility tests, `.test.tsx` for React component/hook tests
- All tests run in jsdom environment (simulated browser)

### Mocking Strategy

**Electron APIs**: Since tests run in Node.js (not Electron), all `window.electronAPI` methods are mocked in `src/test/setup.ts`. The mock provides stub implementations for:
- File operations: `onFileOpen`, `saveFile`, `readFile`, `exportPDF`
- Window management: `createWindowForTab`, `closeWindow`
- IPC callbacks: All `on*` methods return cleanup functions

**Browser APIs**: `window.matchMedia` is mocked for theme testing.

### Writing Tests

**Unit tests** (utilities):
```typescript
import { calculateTextStats } from './textCalculations';

describe('calculateTextStats', () => {
  it('counts words correctly', () => {
    expect(calculateTextStats('hello world').words).toBe(2);
  });
});
```

**Hook tests**:
```typescript
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';

it('toggles theme', () => {
  const { result } = renderHook(() => useTheme());
  act(() => result.current.toggleTheme());
  expect(result.current.theme).toBe('light');
});
```

**Component tests**:
```typescript
import { render, screen } from '@testing-library/react';
import { ErrorNotification } from './ErrorNotification';

it('displays error message', () => {
  render(<ErrorNotification error={{ message: 'Test error', type: 'error' }} onDismiss={() => {}} />);
  expect(screen.getByText('Test error')).toBeInTheDocument();
});
```

### Coverage
Coverage reports are generated in `coverage/` directory. Current thresholds:
- Lines: 5%
- Functions: 45%
- Branches: 50%

### What's NOT Tested (Yet)
- **Main process** (`src/main.ts`): Requires Electron-specific test setup
- **Preload script** (`src/preload.ts`): Requires context isolation testing
- **E2E workflows**: Would need Playwright or Spectron

## Architecture

### Electron Multi-Process Architecture

The application follows Electron's standard three-process model:

1. **Main Process** (`src/main.ts`):
   - Creates and manages the BrowserWindow
   - Handles macOS file associations and "Open With" functionality
   - Listens for `open-file` events (drag-and-drop onto app icon, file associations)
   - Reads file contents and sends to renderer via IPC (`file-open` event)
   - Security: Runs with full Node.js access

2. **Preload Script** (`src/preload.ts`):
   - Uses `contextBridge` to safely expose `electronAPI` to renderer
   - Provides `onFileOpen` callback for receiving file contents
   - Security: Bridges isolated renderer with main process

3. **Renderer Process** (`src/renderer.tsx` → `src/App.tsx`):
   - React application with multiple view modes: Rendered, Raw, and Split
   - Listens for file content via `window.electronAPI.onFileOpen`
   - Security: Runs in sandboxed environment with strict CSP

### Component Structure

- **App.tsx**: Main application container managing state (documents, viewMode, theme), toolbar, tabs, and status bar
- **MarkdownPreview.tsx**: Renders Markdown using `react-markdown` with GitHub Flavored Markdown (`remark-gfm`) and syntax highlighting (`react-syntax-highlighter`)
- **CodeEditor.tsx**: Textarea wrapper with ref forwarding for text selection/formatting
- **ErrorNotification.tsx**: Toast notifications for errors and success messages
- **FindReplace.tsx**: Draggable search and replace panel with match navigation

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
- **Raw view**: Copies plain Markdown text
- **Rendered view**: Uses Clipboard API to copy both HTML and plain text representations for rich paste support

### Status Bar
Real-time statistics calculated from content state:
- Word count: Split on whitespace
- Character count: String length
- Token count: Approximation (length / 4)

### Text Formatting
Applies Markdown formatting (bold/italic/list) to selected text in Raw view by manipulating textarea selection ranges.

## Development Notes

### TypeScript Files
The project uses TypeScript with `.ts` extensions for non-React files and `.tsx` extensions for files containing JSX syntax. `renderer.tsx` (not `.js`) is the entry point to support JSX transpilation. All source code has strict type checking enabled.

### TypeScript Configuration
The project uses multiple tsconfig files for different build targets:
- `tsconfig.json`: Base configuration with strict mode enabled
- `tsconfig.main.json`: Main process configuration
- `tsconfig.preload.json`: Preload script configuration
- `tsconfig.renderer.json`: Renderer process configuration

Type checking scripts:
- `npm run typecheck`: Check all processes
- `npm run typecheck:main`: Check main process only
- `npm run typecheck:preload`: Check preload script only
- `npm run typecheck:renderer`: Check renderer process only

### Project Structure

```
src/
├── main.ts                      # Electron main process (TypeScript)
├── preload.ts                   # Secure IPC bridge (TypeScript)
├── renderer.tsx                 # React entry point (TSX)
├── App.tsx                      # Main application component (TSX)
├── index.css                    # Global styles
├── components/                  # React components
│   ├── MarkdownPreview.tsx      # Preview renderer
│   ├── CodeEditor.tsx           # Code editor
│   ├── ErrorNotification.tsx    # Error/success toasts
│   └── FindReplace.tsx          # Find & replace panel
├── hooks/                       # Custom React hooks
│   ├── index.ts                 # Hook exports
│   ├── useDocuments.ts          # Multi-tab document state
│   ├── useTheme.ts              # Theme system
│   ├── useTextFormatting.ts     # Text formatting logic
│   ├── useFileHandler.ts        # File opening via IPC
│   ├── useErrorHandler.ts       # Error notifications
│   └── useKeyboardShortcuts.ts  # Keyboard bindings
├── types/                       # TypeScript definitions
│   ├── document.d.ts            # Document types
│   ├── electron.d.ts            # IPC & Electron types
│   ├── error.d.ts               # Error types
│   └── electron-squirrel-startup.d.ts
├── utils/                       # Utility functions
│   ├── textCalculations.ts      # Text statistics
│   └── pdfRenderer.ts           # PDF export logic
└── constants/                   # App constants
    └── index.ts                 # Configuration values
```

### DevTools
DevTools are commented out in production. Uncomment `mainWindow.webContents.openDevTools()` in `src/main.ts` for debugging.

### React Version
Uses React 19.2.0 with modern hooks (useState, useEffect, useRef, forwardRef).

## Important Notes

### Language & Extensions
- **TypeScript Only**: All source files use `.ts` (TypeScript) or `.tsx` (TypeScript with JSX)
- **No JavaScript**: There are no `.js` or `.jsx` files in the src/ directory
- **Strict Mode**: TypeScript strict mode is enabled for maximum type safety

### Documentation
- **README.md**: Condensed overview (~215 lines) with 5 most recent changelog versions
- **CHANGELOG.md**: Full verbose version history
- **SECURITY.md**: Security details with CVEs (gitignored)
- See [Documentation Pattern](#documentation-pattern) section for full details

## Testing & Development Workflow

### Development Server

**Starting the dev server:**
```bash
npm start
```

This launches Electron with Vite's HMR (hot module replacement):
- **Renderer changes** (React components, hooks, CSS) → Auto-reload instantly
- **Main/preload changes** (main.ts, preload.ts) → Requires manual restart

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
# ./out/mdviewer-darwin-arm64/mdviewer.app

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
rm -rf out/

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
- remember to update the default content with the current roadmap and changelog
- whenever coding needs to be done in this project, @agent-mdviewer-lead-dev handles the coding task

## Documentation Pattern

mdviewer uses a structured approach to documentation that separates concise reference information from detailed history:

- **README.md**: Minimal changelog (5 most recent versions, feature names only, few words)
  - Target: ~309 lines or less
  - Changelog entries use generic descriptions like "Security enhancements" or "Bug fixes" for security items
  - Links to CHANGELOG.md for full history

- **CHANGELOG.md**: Verbose full history (tracked in version control)
  - Contains complete version history with detailed descriptions
  - All changelog entries from project start to present
  - Standard changelog format following Keep a Changelog conventions

- **SECURITY.md**: Security details with CVEs (gitignored, not committed)
  - Extracted security-related entries from changelog
  - Includes CVE references, vulnerability details, CVSS scores
  - Detailed fix descriptions and impact assessments
  - This file contains sensitive security information and is never committed

### Updating Documentation

When adding new features or fixes:

1. Add detailed entry to CHANGELOG.md
2. If it's one of the 5 most recent versions, update README.md with minimal description
3. If security-related, add detailed entry to SECURITY.md (not committed)
4. Default content in `src/constants/defaultContent.ts` imports from CHANGELOG.md for test document