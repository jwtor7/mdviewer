# Markdown Viewer

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-1.3.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Electron](https://img.shields.io/badge/electron-39.2.3-blueviolet)
![React](https://img.shields.io/badge/react-19.2.0-61dafb)
![Accessibility](https://img.shields.io/badge/a11y-WCAG%202.1-blue)
![TypeSafe](https://img.shields.io/badge/types-PropTypes-blue)

A feature-rich, accessible, and performant Markdown Viewer for macOS built with Electron and React.

## ✨ Features

### 📑 Multi-Document Management
- **Multi-Tab Support**: Work with multiple Markdown documents simultaneously
- **Drag-to-Spawn Windows**: Drag tabs outside to open in new windows
- **Smart File Handling**: Automatic detection of already-open files
- **File Associations**: Open `.md` files directly with "Open With" or drag-and-drop

### 🎨 Viewing & Editing
- **Dual View Modes**: Toggle between rendered preview and raw Markdown source
- **GitHub Flavored Markdown**: Full GFM support with tables, task lists, and strikethrough
- **Syntax Highlighting**: Beautiful code blocks with VS Code Dark+ theme
- **Live Preview**: Instant rendering as you type

### 🎨 Themes & UI
- **Adaptive Themes**: System, Light, and Dark modes with smooth transitions
- **Modern Interface**: Clean, minimal design with intuitive controls
- **Real-Time Statistics**: Live word, character, and token counts in status bar
- **Responsive Layout**: Optimized toolbar, content area, and status bar

### ✏️ Text Formatting
- **Quick Formatting Buttons**: Bold, Italic, and List formatting
- **Rich Text Copy**: Copy rendered HTML or raw Markdown to clipboard
- **Keyboard Shortcuts**: Efficient text editing with familiar shortcuts
- **Selection Preservation**: Smart cursor positioning after formatting

### ♿ Accessibility (WCAG 2.1)
- **Full ARIA Support**: Comprehensive labels and semantic HTML
- **Keyboard Navigation**: Complete keyboard-only operation
- **Screen Reader Optimized**: Detailed aria-live regions and announcements
- **Enhanced Focus Indicators**: Clear visual focus states for all interactive elements

### ⌨️ Keyboard Shortcuts
- `Cmd+B` / `Ctrl+B` - Bold formatting
- `Cmd+I` / `Ctrl+I` - Italic formatting
- `Cmd+E` / `Ctrl+E` - Toggle Preview/Code view
- `Cmd+T` / `Ctrl+T` - Cycle themes (System → Light → Dark)

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

### 💻 Developer Experience
- **Type Safety**: PropTypes validation on all components
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
- Toggle between modes using the toolbar button or `Cmd+E`

### Formatting Text (Code Mode)
1. Select text in the editor
2. Click formatting buttons or use keyboard shortcuts
3. Text is automatically wrapped with Markdown syntax

### Theme Switching
- Click the theme button in toolbar or press `Cmd+T`
- Cycles through: System → Light → Dark → System
- Respects OS theme preferences in System mode

## 🏗️ Architecture

### Technology Stack
- **Electron 39.2.3**: Cross-platform desktop framework
- **React 19.2.0**: UI library with modern hooks
- **Vite**: Fast build tool and dev server
- **react-markdown**: Markdown parsing and rendering
- **remark-gfm**: GitHub Flavored Markdown plugin
- **react-syntax-highlighter**: Code block syntax highlighting
- **rehype-sanitize**: Security-focused HTML sanitization

### Project Structure
```
mdviewer/
├── src/
│   ├── main.js                 # Electron main process
│   ├── preload.js              # Secure IPC bridge
│   ├── renderer.jsx            # React entry point
│   ├── App.jsx                 # Main application component
│   ├── components/             # React components
│   │   ├── MarkdownPreview.jsx # Preview renderer
│   │   ├── CodeEditor.jsx      # Code editor
│   │   └── ErrorNotification.jsx # Error toasts
│   ├── hooks/                  # Custom React hooks
│   │   ├── useDocuments.js     # Document state management
│   │   ├── useTheme.js         # Theme system
│   │   ├── useTextFormatting.js # Text formatting logic
│   │   ├── useFileHandler.js   # File opening via IPC
│   │   ├── useErrorHandler.js  # Error notifications
│   │   ├── useKeyboardShortcuts.js # Keyboard bindings
│   │   └── useDebounce.js      # Debouncing utility
│   ├── utils/                  # Utility functions
│   │   └── textCalculations.js # Text statistics
│   ├── constants/              # App constants
│   │   └── index.js            # Configuration values
│   ├── types/                  # Type definitions
│   │   └── propTypes.js        # PropTypes schemas
│   └── index.css               # Global styles
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
- **Drag-to-Spawn**: Drag tabs outside to create new windows
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

- [ ] **Export to HTML/PDF**: Save rendered markdown as standalone files
- [ ] **Auto-Save**: Automatically persist changes to disk
- [ ] **Split View**: Side-by-side code and preview
- [ ] **Custom CSS**: User-provided stylesheets for preview
- [ ] **Vim Mode**: Vim keybindings in code editor
- [ ] **Find & Replace**: Text search and replacement
- [ ] **Markdown Lint**: Real-time linting and style suggestions
- [ ] **Table Editor**: Visual table editing interface

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 👤 Author

**Junior**
Email: jr@trustcyber.ca

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI powered by [React](https://react.dev/)
- Markdown rendering by [react-markdown](https://github.com/remarkjs/react-markdown)
- Syntax highlighting by [react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter)
