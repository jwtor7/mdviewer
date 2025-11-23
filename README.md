# Markdown Viewer

<div align="center">

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-2.6.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green)
![Electron](https://img.shields.io/badge/electron-39.2.3-blueviolet)
![React](https://img.shields.io/badge/react-19.2.0-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)
![Accessibility](https://img.shields.io/badge/a11y-WCAG%202.1-blue)

**A feature-rich, accessible, and performant Markdown Viewer for macOS built with Electron, React, and TypeScript.**

![mdviewer Screenshot](https://github.com/jwtor7/mdviewer/raw/main/screenshot.png)

</div>

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
- [Development & Testing](#-development--testing)
- [Architecture](#-architecture)
- [Changelog](#-changelog)
- [Upcoming Features](#-upcoming-features)
- [Contributing](#-contributing)
- [License](#-license)
- [Author](#-author)
- [Acknowledgments](#-acknowledgments)

## ✨ Features

### 📑 Multi-Document Management
- **Multi-Tab Support**: Work with multiple Markdown documents simultaneously
- **Drag-to-Spawn Windows**: Drag tabs outside to open in new windows
- **Smart File Handling**: Automatic detection of already-open files
- **File Associations**: Open `.md` files directly with "Open With" or drag-and-drop

### 🎨 Viewing & Editing
- **Triple View Modes**: Toggle between Preview, Code, and Split view (side-by-side)
- **Split View**: View rendered preview and raw source simultaneously with resizable divider
- **GitHub Flavored Markdown**: Full GFM support with tables, task lists, and strikethrough
- **Syntax Highlighting**: Beautiful code blocks with VS Code Dark+ theme
- **Live Preview**: Instant rendering as you type

### 🎨 Themes & UI
- **Adaptive Themes**: System, Light, and Dark modes with smooth transitions
- **Modern Interface**: Clean, minimal design with intuitive controls
- **Real-Time Statistics**: Live word, character, and token counts in status bar
- **Responsive Layout**: Optimized toolbar, content area, and status bar

### ✏️ Text Formatting & Editing
- **Quick Formatting Buttons**: Bold, Italic, and List formatting
- **Find & Replace**: Powerful search with case-sensitive option, match navigation, and bulk replace
- **Rich Text Copy**: Copy rendered HTML or raw Markdown to clipboard
- **Save As**: Save documents as Markdown (.md) or PDF (.pdf) with unified file picker dialog
- **Keyboard Shortcuts**: Efficient text editing with familiar shortcuts
- **Selection Preservation**: Smart cursor positioning after formatting

### ♿ Accessibility (WCAG 2.1)
- **Full ARIA Support**: Comprehensive labels and semantic HTML
- **Keyboard Navigation**: Complete keyboard-only operation
- **Screen Reader Optimized**: Detailed aria-live regions and announcements
- **Enhanced Focus Indicators**: Clear visual focus states for all interactive elements

### ⌨️ Keyboard Shortcuts
- `Cmd+O` / `Ctrl+O` - Open file dialog
- `Cmd+S` / `Ctrl+S` - Save As (Markdown or PDF)
- `Cmd+F` / `Ctrl+F` - Find & Replace
- `Cmd+B` / `Ctrl+B` - Bold formatting
- `Cmd+I` / `Ctrl+I` - Italic formatting
- `Cmd+E` / `Ctrl+E` - Cycle view modes (Preview → Code → Split)
- `Cmd+T` / `Ctrl+T` - Cycle themes (System → Light → Dark → Solarized Light → Solarized Dark)

### 🚀 Performance
- **Memoized Components**: Optimized rendering with React.memo
- **Smart Re-renders**: Only updates when content actually changes
- **Efficient Calculations**: Memoized text statistics
- **Fast Startup**: Minimal initial load time

### 🛡️ Security
- **Sandboxed Environment**: Renderer process runs in strict sandbox
- **Context Isolation**: Secure IPC communication between processes
- **Content Sanitization**: XSS protection via rehype-sanitize
- **Strict CSP**: Content Security Policy prevents unauthorized code execution
- **Electron Fuses**: Additional security hardening at build time
- **Path Traversal Protection**: File path validation prevents unauthorized file access
- **Input Validation**: All IPC messages validated for type and size
- **Rate Limiting**: 100 calls/second limit on IPC handlers prevents DoS attacks
- **File Size Limits**: 50MB max file size, 10MB max IPC content prevents memory exhaustion
- **Runtime Protection**: External URL navigation blocked, popup window creation prevented
- **Resource Limits**: Maximum 10 concurrent windows to prevent resource exhaustion
- **Error Sanitization**: Error messages sanitized to prevent information disclosure
- **Security Scanning**: ESLint security plugins detect vulnerabilities during development

### 💻 Developer Experience
- **Full TypeScript**: 100% type-safe codebase with strict mode enabled
- **Type-Safe IPC**: Discriminated unions for inter-process communication
- **Clean Architecture**: Custom hooks for separation of concerns
- **Error Handling**: User-friendly error notifications
- **Modular Code**: Well-organized hooks, components, and utilities

### 🔒 Privacy & Offline
- **100% Local**: No internet connection required
- **Zero Telemetry**: Your documents never leave your machine
- **No External Requests**: Completely self-contained application

## 📥 Installation

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

## 🎯 Usage

### Opening Files
- **Drag & Drop**: Drag `.md` files onto the app icon or window
- **File Association**: Right-click `.md` files → "Open With" → mdviewer
- **Within App**: Use tabs to manage multiple open documents

### View Modes
- **Preview Mode**: Rendered Markdown with syntax highlighting
- **Code Mode**: Raw Markdown source with monospace font
- **Split Mode**: Side-by-side code and preview with resizable divider
- Cycle through modes using the toolbar buttons or `Cmd+E`

### Formatting Text (Code Mode)
1. Select text in the editor
2. Click formatting buttons or use keyboard shortcuts
3. Text is automatically wrapped with Markdown syntax

### Theme Switching
- Click the theme button in toolbar or press `Cmd+T`
- Cycles through: System → Light → Dark → System
- Respects OS theme preferences in System mode

## 🧪 Development & Testing

### Quick Start Development
```bash
# Start the development server (hot reload enabled)
npm start
```

This launches the Electron app with Vite's hot module replacement:
- **Renderer changes** (React components, hooks, CSS) reload instantly
- **Main/preload changes** (main.js, preload.js) require restart

### Testing File Opening (Development Mode)

Since the dev server doesn't register macOS file associations, use these methods:

#### Option 1: File → Open Menu
1. Start dev server: `npm start`
2. Click **File → Open** in the menu bar (or press `Cmd+O`)
3. Select a `.md` file
4. Test opening multiple files to verify no duplicate tabs

#### Option 2: Drag and Drop
1. Start dev server: `npm start`
2. Drag `.md` files from Finder onto the app window
3. Drop to open them
4. Test with multiple files

### Testing File Associations (Production Build)

To test macOS file associations (double-clicking .md files):

```bash
# Build production app
npm run make

# App created at:
# ./out/mdviewer-darwin-arm64/mdviewer.app

# Test by double-clicking .md files in Finder
```

**⚠️ Note**: Production builds register with macOS and take over `.md` file associations.

### Stopping the Dev Server

```bash
# If Ctrl+C doesn't work, force kill:
pkill -f Electron
```

### Cleaning Build Artifacts

```bash
# Remove production builds
rm -rf out/

# Full clean (also removes node_modules)
rm -rf out/ node_modules/
npm install
```

### Development Workflow

```bash
# 1. Start dev server
npm start

# 2. Make changes to code
#    - Renderer changes auto-reload
#    - Main/preload changes need restart
```

### Prototyping Workflow
For rapid feature iteration without full builds:
1.  Create a standalone HTML file in `prototypes/` (e.g., `prototypes/new-feature.html`).
2.  Use React/Babel via CDN for zero-build testing.
3.  Verify logic and UI in the browser before porting to the Electron app.

### Agent-Driven Standalone Prototypes
We use a rapid prototyping workflow that allows us to test new features in isolation before integrating them into the main application.
- **Location**: `prototypes/` directory.
- **Format**: Standalone HTML files with embedded React/Babel.
- **Offline Capable**: Uses local libraries in `prototypes/lib/` (React, ReactDOM, Babel, Tailwind), requiring no internet connection.
- **Workflow**:
    1.  Agent creates a new HTML file in `prototypes/` (e.g., `feature-name.html`) using `prototypes/template.html`.
    2.  Agent implements the feature using the standalone React setup.
    3.  Agent verifies functionality using the browser tool.
    4.  Once verified, the code is ported to the main Electron app.


## 🏗️ Architecture

### Technology Stack
- **Electron 39.2.3**: Cross-platform desktop framework
- **React 19.2.0**: UI library with modern hooks
- **TypeScript 5.9.3**: Type-safe development with strict mode
- **Vite**: Fast build tool and dev server
- **react-markdown**: Markdown parsing and rendering
- **remark-gfm**: GitHub Flavored Markdown plugin
- **react-syntax-highlighter**: Code block syntax highlighting
- **rehype-sanitize**: Security-focused HTML sanitization

### Project Structure
```
mdviewer/
├── src/
│   ├── main.ts                 # Electron main process
│   ├── preload.ts              # Secure IPC bridge
│   ├── renderer.tsx            # React entry point
│   ├── App.tsx                 # Main application component
│   ├── components/             # React components
│   │   ├── MarkdownPreview.tsx # Preview renderer
│   │   ├── CodeEditor.tsx      # Code editor
│   │   └── ErrorNotification.tsx # Error toasts
│   ├── hooks/                  # Custom React hooks
│   │   ├── useDocuments.ts     # Document state management
│   │   ├── useTheme.ts         # Theme system
│   │   ├── useTextFormatting.ts # Text formatting logic
│   │   ├── useFileHandler.ts   # File opening via IPC
│   │   ├── useErrorHandler.ts  # Error notifications
│   │   └── useKeyboardShortcuts.ts # Keyboard bindings
│   ├── types/                  # TypeScript definitions
│   │   ├── document.d.ts       # Document types
│   │   ├── electron.d.ts       # IPC & Electron types
│   │   └── error.d.ts          # Error types
│   ├── utils/                  # Utility functions
│   │   └── textCalculations.ts # Text statistics
│   ├── constants/              # App constants
│   │   └── index.ts            # Configuration values
│   └── index.css               # Global styles
├── tsconfig.json               # Base TypeScript config
├── tsconfig.main.json          # Main process config
├── tsconfig.preload.json       # Preload config
├── tsconfig.renderer.json      # Renderer config
├── forge.config.js             # Electron Forge config
├── vite.*.config.mjs           # Vite configurations
└── package.json                # Dependencies & scripts
```

### Security Model
- **Main Process**: Full Node.js access, handles file I/O and system operations
- **Preload Script**: Minimal API bridge using contextBridge
- **Renderer Process**: Sandboxed React app with no direct Node.js access
- **IPC Communication**: Secure message passing for file operations

## 📝 Changelog

### [2.6.0] - 2025-11-22
- **Enhanced Save As Functionality**:
  - Save As (💾) now offers both Markdown and PDF export in a single unified dialog
  - File format automatically detected based on chosen file extension (.md, .markdown, or .pdf)
  - Format-specific success messages ("Markdown saved!" vs "PDF exported!")
  - Removed separate Export PDF button to simplify toolbar UI
  - Reuses existing PDF generation logic for consistent output
  - Security: Rate limiting, content size validation, and input sanitization

### [2.5.0] - 2025-11-22
- **Save As Functionality**:
  - Added Save button (💾) to toolbar with Cmd+S keyboard shortcut
  - Opens native file save dialog allowing user to choose location and filename
  - Supports both new files and overwriting existing files
  - Success/error notifications with existing error notification system
  - Security: Rate limiting, content size validation, and input sanitization

- **Find & Replace**:
  - Comprehensive search functionality in Code and Split views
  - Case-sensitive/insensitive search toggle
  - Navigate between matches with Previous/Next buttons (↑/↓)
  - Keyboard navigation: Enter for next match, Shift+Enter for previous
  - Replace current match or replace all matches at once
  - Live match count display (e.g., "1 of 5")
  - Floating panel with Esc to close
  - Auto-focus find input when opened with Cmd+F
  - Visual match highlighting in the editor

- **Split View Mode**:
  - New view mode showing code editor and preview side-by-side
  - Resizable divider between panes (drag to adjust, 20-80% range)
  - Smooth resizing with visual feedback on hover
  - All editing features work in split view (formatting, find/replace)
  - Synchronized content between code and preview panes
  - Cycle through views: Preview → Code → Split → Preview

- **Enhanced Keyboard Shortcuts**:
  - Cmd+S: Save As
  - Cmd+F: Find & Replace (Code/Split view only)
  - Cmd+E: Now cycles through all three view modes
  - Enter/Shift+Enter: Navigate matches in Find & Replace

- **UI Improvements**:
  - Find button (🔍) added to toolbar (disabled in Preview mode)
  - View mode toggle now has three buttons: Preview, Code, Split
  - Improved button tooltips showing keyboard shortcuts
  - Theme-aware styling for Find & Replace panel

### [2.4.0] - 2025-11-22
- **Solarized Theme Support**:
  - Added Solarized Light theme with warm beige background (#fdf6e3)
  - Added Solarized Dark theme with deep blue-black background (#002b36)
  - Theme cycling now includes 5 themes: System → Light → Dark → Solarized Light → Solarized Dark
  - Theme-aware syntax highlighting: code blocks automatically use Solarized syntax themes when active
  - Updated theme icons: 🌅 for Solarized Light, 🌃 for Solarized Dark
  - Unified Solarized blue (#268bd2) for links, focus indicators, and active tab borders

- **PDF Export Functionality**:
  - Export markdown documents as PDF files with professional formatting
  - PDF export button (📄) added to toolbar
  - Save dialog allows custom filename and location
  - Preserves all markdown formatting: headers, lists, tables, code blocks, images
  - Syntax-highlighted code blocks in PDF output
  - Security: Rate limiting, content size validation (10MB max), and input sanitization
  - Success/error notifications with blue info alerts

- **Enhanced User Experience**:
  - Added custom CSS tooltips for instant feedback (no delay)
  - All toolbar buttons now have descriptive tooltips with keyboard shortcuts
  - Tab close buttons show document name in tooltip
  - View mode toggles (Preview/Code) include keyboard shortcut hints
  - Smooth fade-in animations for tooltip display
  - Theme-aware tooltip backgrounds

- **Dependencies**:
  - Added unified, remark-parse, remark-rehype, rehype-sanitize, rehype-stringify, rehype-highlight for PDF rendering

### [2.3.0] - 2025-11-22
- **External Link Handling (Issue #1 Fix)**:
  - Links in Markdown preview now open in external browser instead of navigating in-app
  - Added confirmation dialog before opening external URLs for security
  - URL preview shown in dialog to prevent phishing
  - Protocol validation (http/https only) prevents malicious URLs
  - Rate limiting applied to external URL handler
  - Custom link component with hover tooltip shows destination URL
  - Implements IPC bridge for secure communication between renderer and main process

### [2.2.0] - 2025-11-22
- **Major Security Release**:
  - **Path Traversal Protection**: Added file path validation to prevent unauthorized file access (MODERATE severity fix)
  - **Input Validation**: Implemented comprehensive IPC message validation for type and size (MODERATE severity fix)
  - **Rate Limiting**: Added 100 calls/second limit on all IPC handlers to prevent DoS attacks (LOW severity fix)
  - **File Size Limits**: Enforced 50MB max file size and 10MB max IPC content to prevent memory exhaustion (LOW severity fix)
  - **Runtime Protection**: Blocked external URL navigation and popup window creation (LOW severity fix)
  - **Resource Limits**: Implemented maximum 10 concurrent windows to prevent resource exhaustion
  - **Memory Leak Fix**: Refactored droppedTabs from Set to Map with proper cleanup (LOW severity fix)
  - **Error Sanitization**: Added error message sanitization to prevent information disclosure (LOW severity fix)
  - **Security Scanning**: Installed ESLint security plugins (eslint-plugin-security, eslint-plugin-no-secrets)
  - **Dependency Updates**: Ran npm audit fix to address known vulnerabilities
  - **Security Constants**: Created centralized security configuration in src/constants/index.ts

- **Developer Experience**:
  - Added security-focused ESLint configuration with flat config format
  - New npm scripts: `npm run lint` and `npm run lint:fix`
  - Comprehensive security audit report generated (SecurityReport.md - not committed)

### [2.1.2] - 2025-11-22
- **Security Enhancements**:
  - Removed local system paths from documentation to prevent information disclosure
  - Sanitized README.md and CLAUDE.md to use relative paths only

### [2.1.1] - 2025-11-21
- **Critical Bug Fix**:
  - Fixed "Object has been destroyed" error when opening files after closing all windows on macOS
  - Added proper window lifecycle management with 'closed' event handler to clear destroyed window references
  - Improved window state validation in 'open-file' handler with `isDestroyed()` checks
  - App now gracefully creates new windows when opening files with no active windows

### [2.1.0] - 2025-11-21
- **TypeScript Migration**:
  - Migrated entire codebase from JavaScript to TypeScript (16 files converted)
  - Added strict type checking with zero compilation errors
  - Created comprehensive type definitions for Electron IPC, documents, and errors
  - Implemented discriminated unions for type-safe IPC communication
  - Configured separate tsconfig files for main, preload, and renderer processes
  - Added typecheck scripts to package.json for validation
  - Enhanced developer experience with full IDE autocomplete and type safety
  - Zero breaking changes - all functionality preserved

### [2.0.1] - 2025-11-21
- **UI Improvements**:
  - Right-aligned version number in status bar for better visibility.

### [2.0.0] - 2025-11-21
- **Major Release**:
  - Complete overhaul of tab and window management.
  - Robust drag-and-drop support for tabs between windows.
  - Smart window closing logic.
  - Enhanced stability and performance.

### [1.4.3] - 2025-11-21
- **New Features**:
  - Added tab reconnection: Drag tabs back into the main window to reconnect them.
  - Improved window management: Windows now close automatically when the last tab is dragged out.
  - Fixed "Untitled" window issue during drag-and-drop.

### [1.4.2] - 2025-11-21
- **New Features**:
  - Added version display in status bar.
  - Enabled offline-capable prototyping workflow.
  - Updated prototypes to display prototype version

### [1.4.1] - 2025-11-21
- **Bug Fixes**:
  - Fixed Markdown preview rendering issues (missing styles for headers, lists, blockquotes, etc.)
  - Improved CSS styling for preview elements to match dark theme

### [1.4.0] - 2025-11-21
- **Critical Bug Fixes**:
  - Fixed event listener accumulation causing duplicate tabs when opening files
  - Fixed default "Untitled" document persisting when opening real files
  - Fixed race condition in file opening on macOS launch
  - Fixed memory leak in error notification timeout handling
  - Fixed race condition in tab closing state updates

- **New Features**:
  - Added File → Open menu with Cmd+O keyboard shortcut
  - Added drag-and-drop support for opening Markdown files onto app window
  - Application menu with File, Edit, View, and Window menus

- **Code Quality**:
  - Removed unused constants (FORMATTING, DIVIDER_STYLES)
  - Removed unused useDebounce hook
  - Removed unused propTypes.js file
  - Improved error handling consistency in clipboard operations
  - Added IPC handler return values for better completion signaling

- **Developer Experience**:
  - Added comprehensive development and testing documentation
  - Documented dev server workflow with File → Open and drag-and-drop
  - Added testing checklist for bug fixes and regression tests
  - Explained macOS file association behavior in development vs production

### [1.3.0] - 2025-11-21
- **Architecture Improvements**:
  - Extracted custom hooks for state management (useDocuments, useTheme, useTextFormatting, useFileHandler)
  - Created constants file for magic numbers and configuration
  - Added PropTypes validation for type safety
  - Moved inline styles to CSS classes with theme variables

- **Accessibility Enhancements**:
  - Added comprehensive ARIA labels and roles
  - Implemented keyboard shortcuts (Cmd+B/I/E/T)
  - Enhanced focus indicators for keyboard navigation
  - Added screen reader support with aria-live regions

- **Performance Optimizations**:
  - Memoized MarkdownPreview and CodeEditor components
  - Optimized text statistics calculation with useMemo
  - Added useCallback for event handlers

- **Error Handling**:
  - User-friendly error notifications
  - Automatic error dismissal after 5 seconds
  - Error handling for clipboard operations

- **UI/UX Improvements**:
  - Moved toolbar divider to CSS class
  - Improved component organization and modularity
  - Better separation of concerns with custom hooks

### [1.2.0] - 2025-11-21
- **Multi-Tab Support**: Open multiple Markdown files in tabs
- **Drag-to-Spawn Windows**: Drag tabs outside to create new windows
- Improved file handling and state management

### [1.1.0] - 2025-11-21
- **Toolbar Features**: Copy, Theme Toggle, Formatting Buttons
- **Status Bar**: Real-time statistics (words, chars, tokens)
- **UI Improvements**: Enhanced layout and visibility

### [1.0.0] - 2025-11-21
- Initial release with basic Markdown rendering
- Preview/Code view toggle
- Syntax highlighting

## 🚧 Upcoming Features

- [ ] **Markdown Formatting Toolbar**: Add toolbar buttons for common markdown elements (Heading 1, Heading 2, Heading 3, Code Block, Quote, Link, Image, etc.) to complement the existing Bold, Italic, and List buttons
- [ ] **Markdown Lint**: Real-time linting and style suggestions
- [ ] **Table Editor**: Visual table editing interface
- [ ] **Custom Themes**: User-configurable color schemes
- [ ] **Auto-save**: Automatic saving with configurable intervals

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 👤 Author

**Junior**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://ca.linkedin.com/in/juniorw)
[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/@jr.trustcyber)
[![Substack](https://img.shields.io/badge/Substack-FF6719?style=for-the-badge&logo=substack&logoColor=white)](https://substack.com/@trustcyber)
[![X (Twitter)](https://img.shields.io/badge/X-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/TrustCyberJR)

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI powered by [React](https://react.dev/)
- Markdown rendering by [react-markdown](https://github.com/remarkjs/react-markdown)
- Syntax highlighting by [react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter)
