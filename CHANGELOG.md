# Changelog

All notable changes to mdviewer are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.8.10] - 2025-11-29
- **Open Recent expanded to 50 files** - File → Open Recent now shows last 50 files instead of 10, with full file paths for better identification
- **Always on Top window preference** - New "Keep on Top" checkbox in Window menu, persists across sessions, applies to all windows
- **Right-click context menu** - Right-click selected text for Cut/Copy/Paste/Select All, Search with Perplexity, and Bold/Italic/List formatting (in Raw view)
- **Install/Upgrade script** - Added double-clickable `scripts/Install mdviewer.command` to build and install latest version
- **Uninstall script** - Added double-clickable `scripts/Uninstall mdviewer.command` to completely remove app and all data
- **Bug fix**: Recent files now saved for drag-and-drop and double-click opened files (not just File → Open)

## [2.8.9] - 2025-11-27
- **New Feature: Tab context menu** - Right-click any tab to reveal file in Finder
- Disabled state for unsaved documents (no file path)
- Full security validation (IPC origin, rate limiting, path safety checks)

## [2.8.8] - 2025-11-26
- **Bug Fix**: Tooltips no longer get cut off at window edges (right-aligned toolbar buttons)

## [2.8.7] - 2025-11-26
- **Documentation**: Updated feature roadmap with code signing phases

## [2.8.6] - 2025-11-26
- **New Feature: Unsaved changes prompts** when closing tabs or quitting with modified documents
- **Dialog options**: Save, Don't Save, Cancel for individual tabs; Save All for app quit

## [2.8.5] - 2025-11-26
- **New Feature: Recent Files menu** (File → Open Recent) with last 10 files and Clear Recent option
- **New files default to Raw view** for immediate editing
- **Bug Fix**: Tab name now updates after saving an untitled document

## [2.8.4] - 2025-11-26
- **New Feature: File → Save menu item** with Cmd+S accelerator
- **Improved Save Dialog**: New/untitled files now default to ~/Documents/ directory

## [2.8.3] - 2025-11-26
- **UI Improvements**:
  - Added horizontal rule button (―) to formatting toolbar
  - Removed "Markdown Viewer" title from toolbar for cleaner look
  - Right-aligned view mode buttons (Rendered/Raw/Split/Text) on toolbar

## [2.8.2] - 2025-11-26
- **New Feature: File → New (Cmd+N)**:
  - Added "New" menu item to create empty document tabs
  - Added "+" button next to tabs for quick new document creation
  - Smart naming: "Untitled", "Untitled 2", "Untitled 3", etc.
- **Bug Fixes**:
  - Fixed tab close buttons not working (stale closure in useDocuments)
  - Fixed tab reintegration for unsaved documents
  - Fixed editing in spawned windows (document ID mismatch)

## [2.8.1] - 2025-11-25
- **Removed**: DOCX export feature removed to simplify codebase
  - Save dialog now offers Markdown, PDF, and Text formats only
  - Removed `docx` dependency (~170 transitive dependencies)

## [2.8.0] - 2025-11-25
- **New Feature: Find in Any View**:
  - Search for text across all view modes: Rendered, Raw, Split, and Text
  - React-based highlighting in Rendered/Text views (no DOM manipulation)
  - Maintains match navigation and current match highlighting across all views
  - Seamless integration with existing Find & Replace panel
- **New Feature: Custom Undo/Redo History**:
  - Per-document undo/redo history with Cmd+Z and Cmd+Shift+Z (or Cmd+Y) shortcuts
  - Debounced history entries (300ms) to group rapid typing into single undo steps
  - Maximum 100 history entries per document
  - History cleaned up when tabs are closed
- **UI Improvements**:
  - Fixed code block background in light themes (now uses CSS variable)
  - Improved checkbox contrast across all themes with custom styling
  - Fixed split view divider dragging (was broken due to stale event reference)

## [2.7.13] - 2025-11-25
- **New Feature: Advanced Formatting Toolbar**:
  - Added comprehensive formatting toolbar with new buttons for headings, code blocks, blockquotes, and links
  - **Headings Dropdown**: H▾ button opens dropdown menu with all 6 heading levels (H1-H6)
    - Visual preview of each heading size in the dropdown menu
    - Applies heading to entire line, replacing existing heading markers if present
    - Smart line-based formatting that preserves text content
  - **Code Block Button**: &lt;/&gt; button wraps selected text in triple backticks
    - Inserts empty code block with cursor positioned inside if no selection
    - Perfect for adding code snippets to documentation
  - **Blockquote Button**: "" button prefixes selected lines with `>`
    - Supports multi-line selections, applying `>` to each line
    - Inserts `> ` with cursor ready for typing if no selection
  - **Link Button**: 🔗 button creates `[text](url)` markdown links
    - Wraps selected text and auto-selects "url" placeholder for easy editing
    - Creates template with "text" selected if no selection
  - All new buttons follow existing toolbar patterns:
    - Disabled in Rendered and Text view modes (only active in Raw and Split)
    - Consistent styling with existing Bold, Italic, List buttons
    - Proper ARIA labels and tooltips for accessibility
  - Dropdown menu features:
    - Click-outside-to-close functionality
    - Smooth fade-in animation
    - Theme-aware styling (dark/light/solarized)
    - Keyboard accessible with proper ARIA roles
  - Extended `useTextFormatting` hook to support all new format types
  - Smart cursor positioning after formatting for optimal UX

## [2.7.12] - 2025-11-25
- **New Feature: Synchronized Text Selection**:
  - Added bidirectional text highlighting between Raw and Rendered views in Split mode
  - When you select text in the Raw view (CodeEditor), the corresponding text is highlighted in the Rendered view (MarkdownPreview)
  - Visual feedback with distinct blue pulsing highlight (different from yellow search highlights)
  - Content-based matching that ignores markdown syntax (bold markers, italics, etc.)
  - Intelligent matching with minimum 3 characters or complete text match requirement
  - Only active in Split view mode to avoid interference with other view modes
  - Implemented with React state management (no DOM manipulation)
  - New CSS class `sync-highlight` with animated pulse effect
  - Selection tracking via `onSelectionChange` callback in CodeEditor component
  - Updates MarkdownPreview props to accept `syncSelection` range

## [2.7.11] - 2025-11-25
- **Security Improvements**:
  - **MEDIUM-6 FIXED**: DevTools menu item now hidden in production builds
    - Uses `app.isPackaged` to conditionally show DevTools only in development mode
    - Production users cannot access DevTools via View menu (prevents debugging/tampering)
  - **LOW-2 VERIFIED**: Electron Fuses already properly configured
    - All recommended security fuses enabled: RunAsNode=false, EnableCookieEncryption=true
    - EnableNodeOptionsEnvironmentVariable=false, EnableNodeCliInspectArguments=false
    - EnableEmbeddedAsarIntegrityValidation=true, OnlyLoadAppFromAsar=true
  - **Phase 3 COMPLETE**: All prioritized security issues addressed

## [2.7.10] - 2025-11-25
- **Security Improvements**:
  - **MEDIUM-3 FIXED**: Corrected inverted error sanitization logic in main process
    - Fixed condition in `sanitizeError()` function that was returning generic errors in both production AND development
    - Bug: `if (process.env.NODE_ENV === 'production' || !app.isPackaged)` was always true in development
    - Fix: Changed to `if (app.isPackaged)` which correctly distinguishes environments
    - Production (packaged app): Returns generic error message (secure, prevents information disclosure)
    - Development (npm start): Returns detailed error with sanitized paths (helpful for debugging)
    - The `app.isPackaged` check is the authoritative source for build environment detection

## [2.7.9] - 2025-11-25
- **Text View Enhancement**:
  - Tables now render as ASCII box-drawing format instead of TSV
  - Uses Unicode box-drawing characters for clean, readable table borders
  - Proper column width calculation with content-aware padding
  - Header row separated from data rows with distinct border line

## [2.7.8] - 2025-11-25
- **Security Improvements**:
  - **MEDIUM-2 FIXED**: Implemented file integrity validation for markdown files
    - Created `fileValidator.ts` utility with comprehensive content validation
    - **UTF-8 Validation**: Manual byte-level validation ensures files are valid UTF-8
      - Catches encoding issues that Node.js might silently replace with replacement characters
      - Prevents corrupted files from being processed
    - **BOM Handling**: Automatically strips UTF-8 Byte Order Mark (0xEF 0xBB 0xBF)
      - Files with BOM from Windows editors open correctly
    - **Binary Detection**: Prevents binary files masquerading as markdown
      - Detects null bytes (definitive binary indicator)
      - Checks control character ratio (binary files have excessive control chars)
      - Configurable via `FILE_INTEGRITY.MAX_CONTROL_CHAR_RATIO` (default: 10%)
      - Allowed control chars: `\n`, `\r`, `\t` (normal text formatting)
    - Applied to both entry points:
      - `openFile()` function (File menu, drag-drop on app icon)
      - `read-file` IPC handler (drag-drop in window)
    - User-friendly error dialogs for invalid files
    - Security logging with `[SECURITY]` prefix for audit trails
  - Added `FILE_INTEGRITY` security configuration to constants

## [2.7.7] - 2025-11-25
- **Security Improvements**:
  - **HIGH-4 FIXED**: Implemented clipboard sanitization for secure copy operations
    - Created `clipboardSanitizer.ts` utility with comprehensive HTML sanitization
    - **HTML Sanitization**:
      - Removes dangerous elements: `script`, `iframe`, `object`, `embed`, `form`, `style`, etc.
      - Strips event handlers: `onclick`, `onerror`, `onload`, and all `on*` attributes
      - Removes `style` attributes (prevents CSS-based attacks)
      - Removes `data-*` attributes (prevents malicious data payloads)
      - Validates URL protocols in `href`/`src` (blocks `javascript:`, `vbscript:`, `data:`, `file:`, etc.)
      - Adds `rel="noopener noreferrer"` to links for security
    - **Text Sanitization**:
      - Removes null bytes and control characters
      - Ensures safe plain text for clipboard operations
    - Applied to all clipboard operations:
      - Raw mode: Sanitizes markdown text
      - Text mode: Sanitizes converted plain text
      - Rendered/Split mode: Sanitizes HTML and text representations
    - Defense-in-depth: Even if DOM manipulation bypasses rendering sanitization, clipboard content is safe
    - Rich text copy still works: Formatting (bold, italic, links, tables) preserved in sanitized HTML

## [2.7.6] - 2025-11-25
- **Security Improvements**:
  - **HIGH-3 FIXED**: Enhanced external URL security
    - Added `URL_SECURITY` configuration in constants with allowlist and blocklist
    - Implemented `validateExternalUrl()` function with comprehensive validation
    - **Blocked protocols**: `javascript:`, `vbscript:`, `file:`, `data:`, `blob:`, `about:`, `chrome:`, `chrome-extension:`
    - **Allowed protocols**: Only `https:` and `http:` (explicit allowlist approach)
    - Added URL length limit (2048 chars) to prevent DoS via extremely long URLs
    - URL normalization via URL parser prevents encoding bypass attacks
    - Type validation ensures URL parameter is always a string
    - Enhanced security logging with `[SECURITY]` prefix for audit trail
    - Confirmation dialog shows sanitized URL (not raw input)

## [2.7.5] - 2025-11-25
- **Security Improvements**:
  - **HIGH-2 FIXED**: Added file size validation in renderer process
    - Added `RENDERER_SECURITY` constants for content size limits (10MB)
    - Validates content size in `handleFileDrop` for dropped tabs
    - Validates content size in `handleFileDrop` for dropped files
    - Validates content size in `useFileHandler` for IPC `file-open` events
    - Defense-in-depth: Renderer validates even though main process already does
    - Shows user-friendly error messages when files exceed size limit
    - Prevents memory exhaustion from malicious or very large content

## [2.7.4] - 2025-11-25
- **Security Improvements**:
  - **H-2 FIXED**: Fixed esbuild CVE-2025-23081 vulnerability (GHSA-67mh-4wv8-2f99)
    - Upgraded Vite from v5.4.21 to v6.4.1
    - Updated esbuild from v0.24.x to v0.25.12 (patched version >= 0.25.0)
    - Vulnerability allowed malicious websites to read source code from dev server via CORS bypass
    - Risk was moderate for development environments (build tooling, not runtime)

## [2.7.3] - 2025-11-25
- **New Features**:
  - **Text View Mode**: Added fourth view mode for plain text display
    - Strips markdown formatting for clean, readable text
    - Headings converted to UPPERCASE (H1) or title case (H2+)
    - Tables export as tab-separated values (paste into Excel/Sheets)
    - Horizontal rules rendered as line of box-drawing characters
  - **Save as .txt**: Export documents as plain text files with markdown stripped

## [2.7.2] - 2025-11-25
- **Security Improvements**:
  - **H-3 FIXED**: Fixed PDF Export Data Leakage vulnerability
    - Changed CSP from `img-src *` to `img-src 'self' data: blob:`
    - Changed CSP from `font-src *` to `font-src 'self' data:`
    - Blocks external tracking pixels and font requests during PDF export
    - Enforces offline-first design for PDF generation

## [2.7.1] - 2025-11-24
- **Security Improvements**:
  - **Strict CSP in Production**: Eliminated `unsafe-inline` from style-src directive
    - Replaced `react-syntax-highlighter` (inline styles) with `rehype-highlight` (CSS classes)
    - Converted all component inline styles to CSS custom properties
    - Production builds now enforce strict CSP: `style-src 'self'`
    - Added highlight.js CSS themes for all 4 color schemes
  - Note: Development mode retains `unsafe-inline` for Vite HMR compatibility

## [2.7.0] - 2025-11-24
- **New Features**:
  - **Copy to Clipboard**: Added a copy button to all code blocks
    - Appears on hover in the bottom-right corner
    - Semi-transparent design that works with all themes
    - Visual feedback (checkmark) upon successful copy
    - Secure implementation using standard Clipboard API

## [2.6.8] - 2025-11-24
- **Maintenance**:
  - Refactored default content loading to programmatically import from README.md
  - Updated documentation and removed completed roadmap items

## [2.6.7] - 2025-11-23
- **Security Improvements:**
  - **CRITICAL-4 FIXED**: Fixed rate limiter memory leak (CVSS 7.5 → 0.0)
    - Added periodic cleanup mechanism to prevent unbounded memory growth
    - Cleanup runs every 60 seconds, removes stale entries after 2× rate limit window
    - Tracks last access time for each identifier
    - Prevents memory exhaustion from unique sender IDs
  - **CRITICAL-5 FIXED**: Added IPC origin validation (CVSS 6.5 → 0.0)
    - Created `isValidIPCOrigin` function to validate all IPC event senders
    - Validates sender is from known BrowserWindow instance
    - Applied to all 8 IPC handlers (tab-dropped, check-tab-dropped, close-window, open-external-url, create-window-for-tab, export-pdf, save-file, read-file)
    - Prevents unauthorized IPC calls from external processes
  - Both vulnerabilities fully mitigated with 100% risk reduction
  - Changes: +109 insertions to main.ts
  - All tests passed: TypeScript compilation, linting, functional testing

## [2.6.6] - 2025-11-23
- **Bug Fixes:**
  - Fixed syntax highlighting rendering issues in code blocks
  - Restored theme-aware syntax highlighting for all 4 themes (dark, light, solarized-light, solarized-dark)
  - Fixed monospace font rendering across all code elements
  - Code blocks now use proper inline styles from react-syntax-highlighter

## [2.6.5] - 2025-11-23
- **Security Improvements:**
  - **CRITICAL-3 FIXED**: Added strict Content Security Policy to PDF export HTML
  - CSP blocks all scripts, objects, and iframes in generated PDFs (`default-src 'none'`)
  - Defense-in-depth: CSP layer added on top of existing `rehype-sanitize` protection
  - Prevents code injection and XSS attacks in PDF generation
- **Documentation:**
  - Added Feature Roadmap section to README
  - Updated changelog with proper version tracking

## [2.6.4] - 2025-11-23
-   **Security Improvements:**
    *   Fixed critical path traversal vulnerability in drag-and-drop functionality.
    *   Implemented secure IPC for file reading with strict path validation.
    *   Enforced file extension checks (.md/.markdown) and size limits for dropped files.
- **UI/UX Refactoring**:
  - Renamed view modes for improved clarity: "Preview" → "Rendered", "Code" → "Raw"
  - Updated all button labels, tooltips, and keyboard shortcut descriptions
  - Updated error messages and accessibility labels
  - "Rendered" now clearly indicates processed markdown output
  - "Raw" now clearly indicates unprocessed markdown source
  - View mode cycle: Rendered → Raw → Split → Rendered

## [2.6.3] - 2025-11-23
- **UI/UX Improvements**:
  - Added scroll position indicator to Raw view - visual bar shows current position in document
  - Indicator height represents visible content ratio, position shows scroll location
  - Increased right-side padding from 20px to 80px in Raw view to prevent text cutoff by scrollbar
  - Increased right-side padding from 20px to 60px in Rendered view
  - Added proper box-sizing to ensure padding is calculated correctly
  - Fixed horizontal scrolling in Rendered view with `overflow-x: hidden`
  - Long URLs now wrap properly in Rendered view instead of being cut off
  - Added `word-break` and `overflow-wrap` to links for better text wrapping

## [2.6.2] - 2025-11-23
- **Find & Replace Enhancements**:
  - Added real-time incremental search highlighting - highlights update as you type
  - Highlights appear immediately when typing in find input (e.g., "T" → all Ts highlighted)
  - Match counter updates in real-time showing "X of Y"
  - Current match highlighted in orange, other matches in yellow
  - Perfect scroll synchronization using mirrored content layer approach
  - Case-sensitive toggle respected in real-time highlighting

- **Bug Fixes**:
  - Fixed undo/redo functionality after using "Replace All" - now uses `document.execCommand('insertText')` to preserve undo stack
  - Fixed highlight alignment issues with complete redesign using background layer approach

- **Developer Experience**:
  - Added comprehensive default test content on startup (240-line test document)
  - Default content includes feature roadmap, recent changelog, and test elements
  - 50+ instances of "test" for Find & Replace validation
  - Wide code blocks and long lines for scroll testing
  - Updated CLAUDE.md with complete TypeScript references and project structure
  - Updated mdviewer-lead-dev agent with correct file extensions and project context

## [2.6.1] - 2025-11-22
- **PDF Export Improvements**:
  - Fixed scroll bars appearing in code blocks in PDF exports
  - Implemented proper text wrapping for long code lines using `white-space: pre-wrap`
  - Added `word-wrap: break-word` for code blocks, tables, and URLs
  - Long URLs now break at appropriate points instead of causing overflow
  - Table cells wrap content properly without scroll bars
  - Added `page-break-inside: avoid` for code blocks and tables to keep them together when possible
  - All PDF content is now fully readable without horizontal or vertical scroll bars

## [2.6.0] - 2025-11-22
- **Enhanced Save As Functionality**:
  - Save As (💾) now offers both Markdown and PDF export in a single unified dialog
  - File format automatically detected based on chosen file extension (.md, .markdown, or .pdf)
  - Format-specific success messages ("Markdown saved!" vs "PDF exported!")
  - Removed separate Export PDF button to simplify toolbar UI
  - Reuses existing PDF generation logic for consistent output
  - Security: Rate limiting, content size validation, and input sanitization

## [2.5.0] - 2025-11-22
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
  - Cycle through views: Rendered → Raw → Split → Rendered

- **Enhanced Keyboard Shortcuts**:
  - Cmd+S: Save As
  - Cmd+F: Find & Replace (Raw/Split view only)
  - Cmd+E: Now cycles through all three view modes
  - Enter/Shift+Enter: Navigate matches in Find & Replace

- **UI Improvements**:
  - Find button (🔍) added to toolbar (disabled in Rendered mode)
  - View mode toggle now has three buttons: Rendered, Raw, Split
  - Improved button tooltips showing keyboard shortcuts
  - Theme-aware styling for Find & Replace panel

## [2.4.0] - 2025-11-22
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

## [2.3.0] - 2025-11-22
- **External Link Handling (Issue #1 Fix)**:
  - Links in Markdown preview now open in external browser instead of navigating in-app
  - Added confirmation dialog before opening external URLs for security
  - URL preview shown in dialog to prevent phishing
  - Protocol validation (http/https only) prevents malicious URLs
  - Rate limiting applied to external URL handler
  - Custom link component with hover tooltip shows destination URL
  - Implements IPC bridge for secure communication between renderer and main process

## [2.2.0] - 2025-11-22
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

## [2.1.2] - 2025-11-22
- **Security Enhancements**:
  - Removed local system paths from documentation to prevent information disclosure
  - Sanitized README.md and CLAUDE.md to use relative paths only

## [2.1.1] - 2025-11-21
- **Critical Bug Fix**:
  - Fixed "Object has been destroyed" error when opening files after closing all windows on macOS
  - Added proper window lifecycle management with 'closed' event handler to clear destroyed window references
  - Improved window state validation in 'open-file' handler with `isDestroyed()` checks
  - App now gracefully creates new windows when opening files with no active windows

## [2.1.0] - 2025-11-21
- **TypeScript Migration**:
  - Migrated entire codebase from JavaScript to TypeScript (16 files converted)
  - Added strict type checking with zero compilation errors
  - Created comprehensive type definitions for Electron IPC, documents, and errors
  - Implemented discriminated unions for type-safe IPC communication
  - Configured separate tsconfig files for main, preload, and renderer processes
  - Added typecheck scripts to package.json for validation
  - Enhanced developer experience with full IDE autocomplete and type safety
  - Zero breaking changes - all functionality preserved

## [2.0.1] - 2025-11-21
- **UI Improvements**:
  - Right-aligned version number in status bar for better visibility.

## [2.0.0] - 2025-11-21
- **Major Release**:
  - Complete overhaul of tab and window management.
  - Robust drag-and-drop support for tabs between windows.
  - Smart window closing logic.
  - Enhanced stability and performance.

## [1.4.3] - 2025-11-21
- **New Features**:
  - Added tab reconnection: Drag tabs back into the main window to reconnect them.
  - Improved window management: Windows now close automatically when the last tab is dragged out.
  - Fixed "Untitled" window issue during drag-and-drop.

## [1.4.2] - 2025-11-21
- **New Features**:
  - Added version display in status bar.
  - Enabled offline-capable prototyping workflow.
  - Updated prototypes to display prototype version

## [1.4.1] - 2025-11-21
- **Bug Fixes**:
  - Fixed Markdown preview rendering issues (missing styles for headers, lists, blockquotes, etc.)
  - Improved CSS styling for preview elements to match dark theme

## [1.4.0] - 2025-11-21
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

## [1.3.0] - 2025-11-21
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

## [1.2.0] - 2025-11-21
- **Multi-Tab Support**: Open multiple Markdown files in tabs
- **Drag-to-Spawn Windows**: Drag tabs outside to create new windows
- Improved file handling and state management

## [1.1.0] - 2025-11-21
- **Toolbar Features**: Copy, Theme Toggle, Formatting Buttons
- **Status Bar**: Real-time statistics (words, chars, tokens)
- **UI Improvements**: Enhanced layout and visibility

## [1.0.0] - 2025-11-21
- Initial release with basic Markdown rendering
- Rendered/Raw view toggle
- Syntax highlighting
