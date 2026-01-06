# Changelog

All notable changes to mdviewer are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2026-01-05

### Added
- Modular architecture: main.ts split into security/, storage/, and windowManager modules
- 12 custom React hooks extracted from App.tsx (36% size reduction)
- Zod-based IPC validation with type-safe schemas
- Comprehensive test suite: 395 tests (up from 38)
- Security documentation at docs/SECURITY-MODEL.md

### Changed
- App.tsx refactored from 1076 to 690 lines
- main.ts refactored from 1676 to 1388 lines
- Coverage thresholds increased to 30% lines, 50% functions
- Updated dependencies to latest patch versions

### Security
- IPC handlers now use Zod schema validation
- Rate limiting and origin validation standardized via wrapper
- Path validation and URL allowlisting documented

## [3.0.16] - 2026-01-05

### Added
- App.tsx integration test suite (40 new tests)
- Tests for tab management, view modes, theme toggle, keyboard shortcuts
- Updated test setup with additional Electron API mocks

## [3.0.15] - 2026-01-05

### Added
- Zod runtime validation for IPC handlers
- Type-safe IPC schemas in `src/types/ipc-schemas.ts`
- `withValidatedIPCHandler` wrapper using Zod `.safeParse()`

### Changed
- Refactored export-pdf, save-file, read-file handlers to use Zod validation
- Reduced validation boilerplate with declarative schemas

## [3.0.14] - 2026-01-05

### Added
- Test suite for remaining hooks and utilities (128 new tests)
- useTextFormatting tests: 30 tests for markdown formatting
- useKeyboardShortcuts tests: 38 tests for keyboard bindings
- textEditing tests: 60 tests for format preservation

## [3.0.13] - 2026-01-05

### Added
- Security utility test suite (94 new tests)
- fileValidator tests: 44 tests for UTF-8 validation, BOM stripping, binary detection
- clipboardSanitizer tests: 50 tests for XSS prevention and HTML sanitization

## [3.0.12] - 2026-01-05

### Added
- Comprehensive test suite for critical hooks (95 new tests)
- useDocuments tests: 51 tests with 100% line coverage
- useErrorHandler tests: 14 tests for error notification lifecycle
- useFileHandler tests: 30 tests for file opening and IPC handling

## [3.0.11] - 2026-01-05

### Changed
- Extracted 6 custom hooks from App.tsx (1076 → 690 lines, 36% reduction)
- New hooks: useDragDrop, useClipboardCopy, useSaveFile, useIPCListeners, useSplitPaneDivider, useOutsideClickHandler
- Improved code maintainability with clear separation of concerns

## [3.0.10] - 2026-01-05

### Changed
- Refactored main.ts into modular architecture (1676 → 1388 lines)
- Extracted security utilities to `src/main/security/` (pathValidation, rateLimiter)
- Extracted storage modules to `src/main/storage/` (preferences, recentFiles)
- Extracted window management to `src/main/windowManager.ts`

## [3.0.9] - 2026-01-05

### Added
- IPC validation wrapper (`src/main/security/ipcValidation.ts`) for standardized security checks
- `withIPCHandler` and `withIPCHandlerNoInput` utilities to reduce boilerplate

### Changed
- Refactored `close-window` IPC handler to use new validation wrapper
- Removed feature roadmap from default test document

## [3.0.8] - 2026-01-05

### Changed
- Updated dependencies to latest patch versions (react 19.2.3, react-dom 19.2.3, @types/node 24.10.4)
- Added documentation for useDocuments.ts constants (MAX_HISTORY_SIZE, DEBOUNCE_MS)

## [3.0.7] - 2025-12-11

### Security
- Fixed tab drag data leak that created .textClipping files containing internal JSON data (document IDs, content, file paths) when dragging tabs onto desktop
- Changed tab drag MIME type from `text/plain` to custom `application/x-mdviewer-tab` - macOS Finder now ignores drag data, preventing unintended file creation

## [3.0.6] - 2025-12-10

### Fixed
- Tab tear-off functionality now works correctly - tabs can be dragged out of the window to create a new window

## [3.0.5] - 2025-12-06

### Fixed
- Fixed critical race condition in tab dragging by disabling cross-window tab reintegration to prevent data loss ("disappearing tabs").
- Fixed "Duplicate Tabs" issue where reordering tabs could sometimes create ghost duplicates.
- Fixed issue where closing the last tab would not close the window.

### Changed
- **Tab Re-integration Disabled**: Dragging a tab from one window to another is now explicitly blocked to ensure stability. You can still drag a tab *out* to create a new window, and reorder tabs *within* a window.
- Added `Cmd+W` / `Ctrl+W` shortcut to close the active tab.

## [3.0.4] - 2025-12-06

### Changed
- Image Naming: Pasted screenshots now use the document's filename with a sequential number (e.g., `MyDoc-1.png`) instead of a generic timestamp

## [3.0.3] - 2025-12-06

### Fixed
- Image Paste: Support for pasting screenshots and images directly into the rendered view (saves to `./images/` folder)
- Image Rendering: Proper handling of spaces in image filenames (fixed disappearing images)
- Image Paste: Added support for detection of images by MIME type in clipboard content

## [3.0.2] - 2025-12-05

### Fixed
- Horizontal scrolling for tab bar when tabs overflow the window width (tabs no longer shrink indefinitely)

## [3.0.1] - 2025-12-05

### Security
- Replaced `unsafe-inline` with cryptographic nonce in PDF export CSP to prevent data leakage (H-3)

## [3.0.0] - 2025-12-01

### Added
- Image Embedding - Drag and drop image files (.png, .jpg, .jpeg, .gif, .svg, .webp) onto saved documents to automatically copy them to `./images/` directory and insert markdown image syntax
- Relative image path support - Images referenced with relative paths (e.g., `./images/photo.png`) are loaded and displayed in preview modes
- Image validation - File size limits (10MB max), extension whitelist, and path traversal protection for secure image handling
- Document save requirement - Images can only be embedded in saved documents to ensure proper relative path resolution
- Inline Text Editing - Click on paragraphs, headings, lists, tables, or blockquotes in Rendered view to edit text directly. Changes sync to raw markdown on blur while preserving formatting markers

### Changed
- MAJOR VERSION BUMP - Image embedding feature represents significant new functionality

## [2.8.11] - 2025-11-29

### Added
- Word Wrap Toggle - Toggle line wrapping in Raw/Code view with toolbar button, keyboard shortcut (Cmd+Alt+W), or View menu item. Preference persists across sessions.

### Changed
- Reformatted CHANGELOG.md to strict Keep a Changelog format with categorized entries
- Updated mdviewer-lead-dev agent with changelog skill for consistent formatting

## [2.8.10] - 2025-11-29

### Added
- Open Recent expanded to 50 files with full file paths for better identification
- Always on Top window preference in Window menu, persists across sessions
- Right-click context menu for Cut/Copy/Paste/Select All, Search with Perplexity, and formatting
- Install/Upgrade script (`scripts/Install mdviewer.command`)
- Uninstall script (`scripts/Uninstall mdviewer.command`)

### Fixed
- Recent files now saved for drag-and-drop and double-click opened files

## [2.8.9] - 2025-11-27

### Added
- Tab context menu - Right-click any tab to reveal file in Finder
- Disabled state for unsaved documents (no file path)

### Security
- Full security validation (IPC origin, rate limiting, path safety checks)

## [2.8.8] - 2025-11-26

### Fixed
- Tooltips no longer get cut off at window edges (right-aligned toolbar buttons)

## [2.8.7] - 2025-11-26

### Changed
- Updated feature roadmap with code signing phases

## [2.8.6] - 2025-11-26

### Added
- Unsaved changes prompts when closing tabs or quitting with modified documents
- Dialog options: Save, Don't Save, Cancel for individual tabs; Save All for app quit

## [2.8.5] - 2025-11-26

### Added
- Recent Files menu (File -> Open Recent) with last 10 files and Clear Recent option
- New files default to Raw view for immediate editing

### Fixed
- Tab name now updates after saving an untitled document

## [2.8.4] - 2025-11-26

### Added
- File -> Save menu item with Cmd+S accelerator

### Changed
- Save dialog now defaults to ~/Documents/ directory for new files

## [2.8.3] - 2025-11-26

### Added
- Horizontal rule button to formatting toolbar

### Changed
- Removed "Markdown Viewer" title from toolbar for cleaner look
- Right-aligned view mode buttons (Rendered/Raw/Split/Text) on toolbar

## [2.8.2] - 2025-11-26

### Added
- File -> New (Cmd+N) menu item to create empty document tabs
- "+" button next to tabs for quick new document creation
- Smart naming: "Untitled", "Untitled 2", "Untitled 3", etc.

### Fixed
- Tab close buttons not working (stale closure in useDocuments)
- Tab reintegration for unsaved documents
- Editing in spawned windows (document ID mismatch)

## [2.8.1] - 2025-11-25

### Removed
- DOCX export feature removed to simplify codebase
- Removed `docx` dependency (~170 transitive dependencies)

### Changed
- Save dialog now offers Markdown, PDF, and Text formats only

## [2.8.0] - 2025-11-25

### Added
- Find in Any View - Search for text across all view modes
- React-based highlighting in Rendered/Text views
- Custom Undo/Redo History per-document with Cmd+Z and Cmd+Shift+Z
- Debounced history entries (300ms) grouping rapid typing
- Maximum 100 history entries per document

### Fixed
- Code block background in light themes (now uses CSS variable)
- Checkbox contrast across all themes with custom styling
- Split view divider dragging (stale event reference)

## [2.7.13] - 2025-11-25

### Added
- Advanced Formatting Toolbar with headings dropdown, code block, blockquote, and link buttons
- Headings Dropdown (H1-H6) with visual preview
- Code Block button wraps selection in triple backticks
- Blockquote button prefixes lines with `>`
- Link button creates markdown link format
- Dropdown menu with click-outside-to-close and fade-in animation

## [2.7.12] - 2025-11-25

### Added
- Synchronized Text Selection between Raw and Rendered views in Split mode
- Bidirectional text highlighting with blue pulsing effect
- Content-based matching that ignores markdown syntax

## [2.7.11] - 2025-11-25

### Security
- DevTools menu item now hidden in production builds
- Verified Electron Fuses properly configured (RunAsNode=false, EnableCookieEncryption=true, etc.)
- Phase 3 security audit complete

## [2.7.10] - 2025-11-25

### Security
- Fixed inverted error sanitization logic in main process
- Production now returns generic errors; development returns detailed errors with sanitized paths

## [2.7.9] - 2025-11-25

### Changed
- Tables in Text View now render as ASCII box-drawing format instead of TSV
- Proper column width calculation with content-aware padding

## [2.7.8] - 2025-11-25

### Security
- Implemented file integrity validation for markdown files
- UTF-8 validation with manual byte-level checking
- BOM handling for Windows editor compatibility
- Binary file detection (null bytes, control character ratio)
- User-friendly error dialogs and security logging

## [2.7.7] - 2025-11-25

### Security
- Implemented clipboard sanitization for secure copy operations
- HTML sanitization removes dangerous elements and event handlers
- URL protocol validation blocks javascript:, vbscript:, data:, etc.
- Text sanitization removes null bytes and control characters

## [2.7.6] - 2025-11-25

### Security
- Enhanced external URL security with allowlist/blocklist
- Blocked protocols: javascript:, vbscript:, file:, data:, blob:, about:, chrome:
- URL length limit (2048 chars) prevents DoS
- URL normalization prevents encoding bypass attacks

## [2.7.5] - 2025-11-25

### Security
- Added file size validation in renderer process (10MB limit)
- Defense-in-depth validation in handleFileDrop and useFileHandler
- User-friendly error messages for oversized files

## [2.7.4] - 2025-11-25

### Security
- Fixed esbuild CVE-2025-23081 vulnerability (GHSA-67mh-4wv8-2f99)
- Upgraded Vite from v5.4.21 to v6.4.1
- Updated esbuild from v0.24.x to v0.25.12

## [2.7.3] - 2025-11-25

### Added
- Text View Mode for plain text display (fourth view mode)
- Headings converted to UPPERCASE (H1) or title case (H2+)
- Tables export as tab-separated values
- Save as .txt with markdown stripped

## [2.7.2] - 2025-11-25

### Security
- Fixed PDF Export Data Leakage vulnerability
- Changed CSP from `img-src *` to `img-src 'self' data: blob:`
- Changed CSP from `font-src *` to `font-src 'self' data:`

## [2.7.1] - 2025-11-24

### Security
- Strict CSP in Production - eliminated `unsafe-inline` from style-src
- Replaced react-syntax-highlighter with rehype-highlight (CSS classes)
- Converted inline styles to CSS custom properties
- Added highlight.js CSS themes for all 4 color schemes

## [2.7.0] - 2025-11-24

### Added
- Copy to Clipboard button on all code blocks
- Appears on hover with semi-transparent design
- Visual feedback (checkmark) on successful copy

## [2.6.8] - 2025-11-24

### Changed
- Refactored default content loading to import from README.md
- Updated documentation and removed completed roadmap items

## [2.6.7] - 2025-11-23

### Security
- Fixed rate limiter memory leak (CVSS 7.5 -> 0.0) with periodic cleanup
- Added IPC origin validation for all 8 IPC handlers (CVSS 6.5 -> 0.0)
- Validates sender is from known BrowserWindow instance

## [2.6.6] - 2025-11-23

### Fixed
- Syntax highlighting rendering issues in code blocks
- Theme-aware syntax highlighting for all 4 themes
- Monospace font rendering across all code elements

## [2.6.5] - 2025-11-23

### Security
- Added strict Content Security Policy to PDF export HTML
- CSP blocks all scripts, objects, and iframes in generated PDFs

### Added
- Feature Roadmap section to README

## [2.6.4] - 2025-11-23

### Security
- Fixed critical path traversal vulnerability in drag-and-drop
- Implemented secure IPC for file reading with strict path validation
- Enforced file extension checks and size limits

### Changed
- Renamed view modes: "Preview" -> "Rendered", "Code" -> "Raw"
- Updated all button labels, tooltips, and keyboard shortcut descriptions

## [2.6.3] - 2025-11-23

### Added
- Scroll position indicator in Raw view

### Fixed
- Increased right-side padding to prevent text cutoff by scrollbar
- Horizontal scrolling in Rendered view with overflow-x: hidden
- Long URLs now wrap properly in Rendered view

## [2.6.2] - 2025-11-23

### Added
- Real-time incremental search highlighting
- Highlights appear immediately when typing in find input

### Fixed
- Undo/redo functionality after "Replace All"
- Highlight alignment with background layer approach

## [2.6.1] - 2025-11-22

### Fixed
- Scroll bars appearing in code blocks in PDF exports
- Text wrapping for long code lines using white-space: pre-wrap
- Long URLs break at appropriate points
- Table cells wrap content properly

## [2.6.0] - 2025-11-22

### Changed
- Save As now offers both Markdown and PDF export in unified dialog
- File format detected based on chosen extension
- Removed separate Export PDF button

## [2.5.0] - 2025-11-22

### Added
- Save As functionality with Cmd+S keyboard shortcut
- Native file save dialog for location and filename selection
- Find & Replace in Code and Split views
- Case-sensitive/insensitive search toggle
- Match navigation with Previous/Next buttons
- Live match count display
- Split View Mode showing code editor and preview side-by-side
- Resizable divider between panes (20-80% range)

## [2.4.0] - 2025-11-22

### Added
- Solarized Light theme
- Solarized Dark theme
- Theme cycling through 5 themes
- PDF Export functionality with professional formatting
- Custom CSS tooltips for instant feedback
- Descriptive tooltips with keyboard shortcuts

## [2.3.0] - 2025-11-22

### Added
- External Link Handling - links open in external browser
- Confirmation dialog before opening external URLs
- URL preview in dialog to prevent phishing
- Protocol validation (http/https only)

## [2.2.0] - 2025-11-22

### Security
- Path Traversal Protection for unauthorized file access (MODERATE)
- Input Validation for IPC messages (MODERATE)
- Rate Limiting at 100 calls/second on all IPC handlers (LOW)
- File Size Limits of 50MB max file, 10MB max IPC content (LOW)
- Runtime Protection blocking external URL navigation (LOW)
- Resource Limits with maximum 10 concurrent windows
- Memory Leak Fix in droppedTabs (LOW)
- Error Sanitization preventing information disclosure (LOW)

### Added
- Security-focused ESLint configuration
- npm scripts for linting

## [2.1.2] - 2025-11-22

### Security
- Removed local system paths from documentation

## [2.1.1] - 2025-11-21

### Fixed
- "Object has been destroyed" error when opening files after closing all windows on macOS
- Window lifecycle management with proper 'closed' event handler

## [2.1.0] - 2025-11-21

### Changed
- Migrated entire codebase from JavaScript to TypeScript (16 files)
- Added strict type checking with zero compilation errors
- Created comprehensive type definitions for Electron IPC
- Configured separate tsconfig files for main, preload, and renderer

## [2.0.1] - 2025-11-21

### Changed
- Right-aligned version number in status bar

## [2.0.0] - 2025-11-21

### Changed
- Complete overhaul of tab and window management
- Robust drag-and-drop support for tabs between windows
- Smart window closing logic
- Enhanced stability and performance

## [1.4.3] - 2025-11-21

### Added
- Tab reconnection: Drag tabs back into main window
- Windows close automatically when last tab is dragged out

### Fixed
- "Untitled" window issue during drag-and-drop

## [1.4.2] - 2025-11-21

### Added
- Version display in status bar
- Offline-capable prototyping workflow

## [1.4.1] - 2025-11-21

### Fixed
- Markdown preview rendering issues (missing styles)
- CSS styling for preview elements to match dark theme

## [1.4.0] - 2025-11-21

### Added
- File -> Open menu with Cmd+O keyboard shortcut
- Drag-and-drop support for opening Markdown files
- Application menu with File, Edit, View, and Window menus

### Fixed
- Event listener accumulation causing duplicate tabs
- Default "Untitled" document persisting when opening files
- Race condition in file opening on macOS launch
- Memory leak in error notification timeout handling
- Race condition in tab closing state updates

### Removed
- Unused constants (FORMATTING, DIVIDER_STYLES)
- Unused useDebounce hook
- Unused propTypes.js file

## [1.3.0] - 2025-11-21

### Added
- Comprehensive ARIA labels and roles
- Keyboard shortcuts (Cmd+B/I/E/T)
- Enhanced focus indicators
- Screen reader support with aria-live regions
- User-friendly error notifications
- Automatic error dismissal after 5 seconds

### Changed
- Extracted custom hooks for state management
- Created constants file for configuration
- Added PropTypes validation
- Moved inline styles to CSS classes
- Memoized MarkdownPreview and CodeEditor components
- Optimized text statistics with useMemo

## [1.2.0] - 2025-11-21

### Added
- Multi-Tab Support for multiple Markdown files
- Drag-to-Spawn Windows from tabs

## [1.1.0] - 2025-11-21

### Added
- Toolbar Features: Copy, Theme Toggle, Formatting Buttons
- Status Bar with real-time statistics (words, chars, tokens)

## [1.0.0] - 2025-11-21

### Added
- Initial release with basic Markdown rendering
- Rendered/Raw view toggle
- Syntax highlighting

[Unreleased]: https://github.com/jwtor7/mdviewer/compare/v3.0.2...HEAD
[3.0.2]: https://github.com/jwtor7/mdviewer/compare/v3.0.1...v3.0.2
[3.0.1]: https://github.com/jwtor7/mdviewer/compare/v3.0.0...v3.0.1
[2.8.11]: https://github.com/jwtor7/mdviewer/compare/v2.8.10...v2.8.11
[2.8.10]: https://github.com/jwtor7/mdviewer/compare/v2.8.9...v2.8.10
[2.8.9]: https://github.com/jwtor7/mdviewer/compare/v2.8.8...v2.8.9
[2.8.8]: https://github.com/jwtor7/mdviewer/compare/v2.8.7...v2.8.8
[2.8.7]: https://github.com/jwtor7/mdviewer/compare/v2.8.6...v2.8.7
[2.8.6]: https://github.com/jwtor7/mdviewer/compare/v2.8.5...v2.8.6
[2.8.5]: https://github.com/jwtor7/mdviewer/compare/v2.8.4...v2.8.5
[2.8.4]: https://github.com/jwtor7/mdviewer/compare/v2.8.3...v2.8.4
[2.8.3]: https://github.com/jwtor7/mdviewer/compare/v2.8.2...v2.8.3
[2.8.2]: https://github.com/jwtor7/mdviewer/compare/v2.8.1...v2.8.2
[2.8.1]: https://github.com/jwtor7/mdviewer/compare/v2.8.0...v2.8.1
[2.8.0]: https://github.com/jwtor7/mdviewer/compare/v2.7.13...v2.8.0
[2.7.13]: https://github.com/jwtor7/mdviewer/compare/v2.7.12...v2.7.13
[2.7.12]: https://github.com/jwtor7/mdviewer/compare/v2.7.11...v2.7.12
[2.7.11]: https://github.com/jwtor7/mdviewer/compare/v2.7.10...v2.7.11
[2.7.10]: https://github.com/jwtor7/mdviewer/compare/v2.7.9...v2.7.10
[2.7.9]: https://github.com/jwtor7/mdviewer/compare/v2.7.8...v2.7.9
[2.7.8]: https://github.com/jwtor7/mdviewer/compare/v2.7.7...v2.7.8
[2.7.7]: https://github.com/jwtor7/mdviewer/compare/v2.7.6...v2.7.7
[2.7.6]: https://github.com/jwtor7/mdviewer/compare/v2.7.5...v2.7.6
[2.7.5]: https://github.com/jwtor7/mdviewer/compare/v2.7.4...v2.7.5
[2.7.4]: https://github.com/jwtor7/mdviewer/compare/v2.7.3...v2.7.4
[2.7.3]: https://github.com/jwtor7/mdviewer/compare/v2.7.2...v2.7.3
[2.7.2]: https://github.com/jwtor7/mdviewer/compare/v2.7.1...v2.7.2
[2.7.1]: https://github.com/jwtor7/mdviewer/compare/v2.7.0...v2.7.1
[2.7.0]: https://github.com/jwtor7/mdviewer/compare/v2.6.8...v2.7.0
[2.6.8]: https://github.com/jwtor7/mdviewer/compare/v2.6.7...v2.6.8
[2.6.7]: https://github.com/jwtor7/mdviewer/compare/v2.6.6...v2.6.7
[2.6.6]: https://github.com/jwtor7/mdviewer/compare/v2.6.5...v2.6.6
[2.6.5]: https://github.com/jwtor7/mdviewer/compare/v2.6.4...v2.6.5
[2.6.4]: https://github.com/jwtor7/mdviewer/compare/v2.6.3...v2.6.4
[2.6.3]: https://github.com/jwtor7/mdviewer/compare/v2.6.2...v2.6.3
[2.6.2]: https://github.com/jwtor7/mdviewer/compare/v2.6.1...v2.6.2
[2.6.1]: https://github.com/jwtor7/mdviewer/compare/v2.6.0...v2.6.1
[2.6.0]: https://github.com/jwtor7/mdviewer/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/jwtor7/mdviewer/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/jwtor7/mdviewer/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/jwtor7/mdviewer/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/jwtor7/mdviewer/compare/v2.1.2...v2.2.0
[2.1.2]: https://github.com/jwtor7/mdviewer/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/jwtor7/mdviewer/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/jwtor7/mdviewer/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/jwtor7/mdviewer/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/jwtor7/mdviewer/compare/v1.4.3...v2.0.0
[1.4.3]: https://github.com/jwtor7/mdviewer/compare/v1.4.2...v1.4.3
[1.4.2]: https://github.com/jwtor7/mdviewer/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/jwtor7/mdviewer/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/jwtor7/mdviewer/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/jwtor7/mdviewer/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/jwtor7/mdviewer/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/jwtor7/mdviewer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/jwtor7/mdviewer/releases/tag/v1.0.0
