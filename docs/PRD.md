# mdviewer - Product Requirements Document (PRD)

**Version:** 3.0.0
**Last Updated:** December 3, 2025
**Document Type:** Complete Product Specification
**Purpose:** This PRD provides comprehensive specifications to rebuild mdviewer from scratch

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [Technical Architecture](#technical-architecture)
3. [User Interface Specification](#user-interface-specification)
4. [Feature Specifications](#feature-specifications)
5. [Security Architecture](#security-architecture)
6. [Build System](#build-system)
7. [Testing Requirements](#testing-requirements)
8. [Dependencies](#dependencies)
9. [File Structure](#file-structure)
10. [Behavioral Specifications](#behavioral-specifications)
11. [Styling System](#styling-system)

---

## 1. Product Overview

### 1.1 Product Description

mdviewer is an offline-capable, feature-rich Markdown Viewer desktop application for macOS built with Electron. It provides a clean interface for viewing and editing Markdown files with GitHub Flavored Markdown support, syntax highlighting, and theme switching.

### 1.2 Core Value Proposition

- **100% Offline**: No telemetry, no external requests, all processing local
- **Security-First**: Sandboxed renderer, context isolation, strict CSP, comprehensive input validation
- **Accessibility**: WCAG 2.1 compliant with full ARIA support and keyboard navigation
- **Performance**: React 19.2.0 with modern hooks, memoization, efficient rendering
- **macOS Native**: Deep integration with macOS file associations, menu bar, UTI handling

### 1.3 Target Platform

- **Primary:** macOS (arm64, x64)
- **Secondary:** Windows, Linux (via Electron Forge makers)

---

## 2. Technical Architecture

### 2.1 Electron Multi-Process Architecture

#### 2.1.1 Main Process (`src/main.ts`)

**Purpose:** Creates and manages browser windows, handles macOS file associations, performs file I/O

**Responsibilities:**
- Create and manage BrowserWindow instances
- Handle `open-file` events (drag-and-drop onto app icon, file associations)
- Read/write file contents securely
- Manage application menu
- Handle IPC messages from renderer
- Enforce security policies (rate limiting, file size limits, path validation)
- Manage recent files list (max 50 files)
- Manage application preferences (always-on-top, etc.)

**Key Configuration:**
```typescript
const win = new BrowserWindow({
  width: 800,
  height: 600,
  alwaysOnTop: appPreferences.alwaysOnTop,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  },
});
```

**Security Utilities:**
- `isPathSafe()`: Validates file paths to prevent traversal attacks
- `sanitizeError()`: Removes sensitive information from error messages
- `createRateLimiter()`: Prevents resource exhaustion from excessive IPC calls
- `validateExternalUrl()`: Validates URLs before opening in browser
- `isValidIPCOrigin()`: Ensures IPC messages come from known windows

**File Association Handling:**
```typescript
app.on('open-file', (event: Electron.Event, filePath: string) => {
  event.preventDefault();

  if (mainWindow && !mainWindow.isDestroyed()) {
    openFile(filePath);
  } else if (app.isReady()) {
    mainWindow = createWindow(filePath);
  } else {
    pendingFileToOpen = filePath;
  }
});
```

#### 2.1.2 Preload Script (`src/preload.ts`)

**Purpose:** Secure bridge between main and renderer processes

**Exposed API via contextBridge:**
```typescript
interface ElectronAPI {
  // File event listeners
  onFileOpen: (callback: (data: FileOpenData) => void) => () => void;
  onFileNew: (callback: () => void) => () => void;
  onFileSave: (callback: () => void) => () => void;
  onSaveAllAndQuit: (callback: () => void) => () => void;
  onFormatText: (callback: (format: string) => void) => () => void;
  onToggleWordWrap: (callback: () => void) => () => void;
  onRequestUnsavedDocs: (callback: () => string[]) => () => void;

  // Window operations
  createWindowForTab: (data: { filePath: string | null; content: string }) => Promise<{ success: boolean }>;
  closeWindow: () => Promise<void>;

  // Tab drag-and-drop
  notifyTabDropped: (dragId: string) => Promise<boolean>;
  checkTabDropped: (dragId: string) => Promise<boolean>;

  // File operations
  saveFile: (data: SaveFileData) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  readFile: (filePath: string) => Promise<{ content: string; error?: string }>;
  exportPDF: (data: PDFExportData) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  getPathForFile: (file: File) => string;

  // Image operations
  readImageFile: (imagePath: string, markdownFilePath: string) => Promise<{ dataUri?: string; error?: string }>;
  copyImageToDocument: (imagePath: string, markdownFilePath: string) => Promise<{ relativePath?: string; error?: string }>;

  // UI operations
  openExternalUrl: (url: string) => Promise<void>;
  showUnsavedDialog: (filename: string) => Promise<{ response: 'save' | 'dont-save' | 'cancel' }>;
  revealInFinder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
}
```

**Security Features:**
- All listeners return cleanup functions to prevent memory leaks
- No direct Node.js API access from renderer
- Type-safe IPC communication via discriminated union types

#### 2.1.3 Renderer Process (`src/renderer.tsx` → `src/App.tsx`)

**Purpose:** React application with UI, user interactions, markdown rendering

**Entry Point (`renderer.tsx`):**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Main App Component:** See Section 3.2

### 2.2 State Management

**Approach:** React hooks, no external state library

**Custom Hooks:**
- `useDocuments()`: Multi-tab document state with undo/redo
- `useTheme()`: Theme management with OS preference detection
- `useTextFormatting()`: Markdown formatting logic
- `useFileHandler()`: File opening via IPC
- `useErrorHandler()`: Toast notification system
- `useKeyboardShortcuts()`: Global keyboard shortcut handling
- `useWordWrap()`: Word wrap state management

### 2.3 IPC Communication Patterns

**Discriminated Union Type System:**
```typescript
export type IPCMessage =
  | { channel: 'file-open'; data: FileOpenData }
  | { channel: 'create-window-for-tab'; data: { filePath: string | null; content: string } }
  | { channel: 'save-file'; data: SaveFileData }
  // ... 10 more message types
```

**Benefits:**
- Compile-time type safety for all IPC communication
- Autocomplete for channel names and data shapes
- Impossible to send wrong data type for a given channel

**Example Handler with Type Safety:**
```typescript
type IPCHandler<T extends IPCMessage['channel']> = (
  event: IpcMainInvokeEvent,
  data: Extract<IPCMessage, { channel: T }>['data']
) => any;

const handler: IPCHandler<'file-open'> = (event, data) => {
  // data is correctly typed as FileOpenData
};
```

### 2.4 Security Model

**Multi-Layer Defense:**

1. **Sandbox:** Renderer process runs in sandbox (no Node.js access)
2. **Context Isolation:** Renderer cannot access preload scope
3. **CSP:** Strict Content Security Policy via `rehype-sanitize`
4. **Input Validation:** All IPC data validated for type, size, and safety
5. **Rate Limiting:** 100 calls per second per window per IPC channel
6. **Path Validation:** Prevents directory traversal attacks
7. **URL Validation:** Only HTTP/HTTPS allowed, explicit protocol blocklist
8. **File Size Limits:** 50MB for markdown, 10MB for images, 10MB for IPC messages
9. **Origin Validation:** All IPC calls verify sender is from known BrowserWindow

**Security Constants:**
```typescript
export const SECURITY_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_CONTENT_SIZE: 10 * 1024 * 1024, // 10MB for IPC
  MAX_WINDOWS: 10,
  MAX_DROPPED_TABS: 1000,
  ALLOWED_EXTENSIONS: ['.md', '.markdown'] as const,
  RATE_LIMIT: {
    MAX_CALLS: 100,
    WINDOW_MS: 1000,
  },
} as const;

export const URL_SECURITY = {
  ALLOWED_PROTOCOLS: ['https:', 'http:'] as const,
  BLOCKED_PROTOCOLS: [
    'javascript:', 'vbscript:', 'file:', 'data:',
    'blob:', 'about:', 'chrome:', 'chrome-extension:'
  ] as const,
  MAX_URL_LENGTH: 2048,
} as const;
```

### 2.5 Data Flow

**File Opening Flow:**
1. User drags `.md` file onto app icon → `open-file` event in main
2. Main process reads file via `fs.readFile` → validates content
3. Main sends to renderer: `mainWindow.webContents.send('file-open', data)`
4. Renderer receives via preload bridge: `electronAPI.onFileOpen(callback)`
5. Renderer updates state via `addDocument()` or `updateExistingDocument()`
6. UI re-renders with new document in active tab

**Save Flow:**
1. User clicks save button → renderer calls `electronAPI.saveFile()`
2. Preload forwards to main via `ipcRenderer.invoke('save-file', data)`
3. Main validates data → shows save dialog → writes file
4. Main returns `{ success: true, filePath: '/path/to/file.md' }`
5. Renderer updates document state with new filepath, marks as saved

---

## 3. User Interface Specification

### 3.1 Window Configuration

**Default Size:** 800x600 pixels
**Minimum Size:** None specified
**Resizable:** Yes
**Titlebar:** macOS native titlebar
**Draggable Region:** Toolbar (via `-webkit-app-region: drag`)

### 3.2 Layout Structure

```
┌─────────────────────────────────────────────────┐
│ Tab Bar (35px height)                           │
├─────────────────────────────────────────────────┤
│ Toolbar (50px height)                           │
├─────────────────────────────────────────────────┤
│                                                 │
│                                                 │
│         Content Area (flex: 1)                  │
│                                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│ Status Bar (25px height)                        │
└─────────────────────────────────────────────────┘
```

### 3.3 Tab Bar

**Position:** Top of window
**Height:** 35px
**Background:** `var(--toolbar-bg)`
**Border:** 1px solid `var(--toolbar-border)` (bottom)

**Tab Element:**
```typescript
<div className="tab ${activeTabId === doc.id ? 'active' : ''}">
  <span>{doc.name}</span>
  <button className="tab-close">×</button>
</div>
```

**Tab Styling:**
- **Inactive:** Background `var(--toolbar-border)`, opacity 0.7
- **Active:** Background `var(--bg-color)`, opacity 1, font-weight bold, 2px blue top border
- **Hover:** Background `var(--btn-hover)`, opacity 1

**Tab Features:**
- Draggable (drag to reorder or create new window)
- Right-click context menu (Reveal in Finder)
- Close button (×) visible on hover
- New tab button (+) at end

**Tab Drag-and-Drop:**
- Drag tab outside window bounds → spawns new window with tab content
- Drag tab into another window → moves tab to that window
- Uses `dragId` tracking via main process to coordinate between windows

### 3.4 Toolbar

**Position:** Below tab bar
**Height:** 50px
**Layout:** Two groups (left, right) with space-between

**Left Group (Formatting & Actions):**
1. Bold button (B)
2. Italic button (I)
3. List button (•)
4. Divider
5. Headings dropdown (H▾)
6. Code block button (</>)
7. Blockquote button ("")
8. Horizontal rule button (―)
9. Divider
10. Copy button (📋)
11. Save button (💾)
12. Find button (🔍)
13. Word wrap button (⤸ or →)
14. Theme button (☀️🌙⚙️🌅🌃)

**Right Group (View Modes):**
- Toggle button group: [Rendered] [Raw] [Split] [Text]

**Button Specifications:**
- **Size:** 24px × 24px (icon buttons)
- **Padding:** 6px
- **Border-radius:** 4px
- **Hover:** Background `var(--btn-hover)`, opacity 1
- **Active:** Background `var(--btn-active)`
- **Disabled:** Opacity 0.3, cursor not-allowed
- **Tooltip:** Shows on hover (via CSS `::after` pseudo-element)

**Headings Dropdown:**
- Click H▾ → shows menu below button
- Menu items: Heading 1 through Heading 6
- Preview text scaled by heading level (H1: 20px, H6: 12px)
- Click item → inserts heading markers at cursor position
- Click outside → closes menu

### 3.5 Content Area

**Four View Modes:**

#### 3.5.1 Rendered Mode

**Component:** `<MarkdownPreview />`
**Padding:** 20px (left), 60px (right), 20px (top/bottom)
**Overflow:** Vertical scroll, horizontal hidden
**Background:** `var(--bg-color)`

**Markdown Rendering:**
- Uses `react-markdown` with `remark-gfm` plugin
- Syntax highlighting via `rehype-highlight`
- Sanitization via `rehype-sanitize`
- Custom components for links (open in browser via IPC), images (load relative paths), code blocks (copy button)

**Inline Text Editing:**
- Paragraphs, headings, list items, table cells, blockquotes are `contentEditable`
- On blur → extracts new text → maps back to original markdown using AST positions
- Preserves markdown formatting (bold, italic, links remain intact)

**Image Rendering:**
- Relative paths (e.g., `./images/photo.png`) → loaded via IPC `readImageFile`
- Images cached in `useRef<Map<string, string>>()` to avoid reloading
- Data URIs and absolute URLs rendered directly

**Link Behavior:**
- All links open via IPC `openExternalUrl()`
- Shows confirmation dialog with URL before opening
- Only HTTP/HTTPS allowed (validated in main process)

#### 3.5.2 Raw Mode

**Component:** `<CodeEditor />`
**Wrapper:** `.code-editor-wrapper` with highlight layer

**Dual-Layer Architecture:**
1. **Highlight Layer:** Positioned absolutely, mirrors textarea typography, shows search highlights
2. **Textarea:** Transparent background, positioned above highlight layer, user types here

**Styling:**
- Font: monospace, 14px, line-height 1.5
- Padding: 20px (left), 80px (right), 20px (top/bottom)
- Background: transparent (textarea), `var(--editor-bg)` (layer)
- Color: `var(--editor-text)`

**Word Wrap:**
- Toggle state managed by `useWordWrap()` hook
- Synced between toolbar button, menu item, and keyboard shortcut
- Classes: `.word-wrap` (white-space: pre-wrap) or `.no-wrap` (white-space: pre)

**Scroll Indicator:**
- Positioned absolutely at right edge (5px from right)
- Thumb height calculated as: `Math.max(30, clientHeight * visibleRatio)`
- Thumb position tracks scroll percentage
- Updated via ResizeObserver and scroll event listener

#### 3.5.3 Split Mode

**Layout:**
```css
.split-view {
  --split-position: 50%; /* CSS custom property */
  display: flex;
}

.split-pane-left {
  width: var(--split-position);
}

.split-divider {
  width: 4px;
  background: var(--toolbar-border);
  cursor: col-resize;
}

.split-pane-right {
  width: calc(100% - var(--split-position) - 4px);
}
```

**Left Pane:** CodeEditor (Raw view)
**Right Pane:** MarkdownPreview (Rendered view)
**Divider:** Draggable, constrained to 20%-80% of width

**Divider Drag Logic:**
```typescript
onMouseDown={(e) => {
  const startX = e.clientX;
  const startWidth = splitDividerPosition;
  const containerWidth = parentElement.clientWidth;

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - startX;
    const deltaPercent = (deltaX / containerWidth) * 100;
    const newWidth = Math.min(Math.max(20, startWidth + deltaPercent), 80);
    setSplitDividerPosition(newWidth);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', () => {
    document.removeEventListener('mousemove', handleMouseMove);
  });
}}
```

#### 3.5.4 Text Mode

**Component:** `<TextPreview />`
**Purpose:** Displays markdown as plain, readable text with formatting stripped

**Conversion Process:**
1. Parse markdown to AST using `unified`, `remark-parse`, `remark-gfm`
2. Convert each node type to plain text:
   - H1 → UPPERCASE
   - H2-H6 → Title case
   - Lists → Bullet (-) or numbered
   - Links → `text (url)`
   - Images → `[Image: alt]`
   - Tables → ASCII box-drawing format
   - Code blocks → Indented 4 spaces
   - Blockquotes → Prefixed with `>`

**Styling:**
- Font: monospace, 14px, line-height 1.6
- White-space: pre-wrap
- Padding: 20px (left), 60px (right), 20px (top/bottom)

### 3.6 Status Bar

**Position:** Bottom of window
**Height:** 25px
**Background:** `var(--toolbar-bg)`
**Border:** 1px solid `var(--toolbar-border)` (top)

**Content (left to right):**
```
Words: 123  |  Chars: 456  |  Tokens: 115  |  v3.0.0
```

**Calculations:**
- **Words:** `content.trim().split(/\s+/).filter(Boolean).length`
- **Characters:** `content.length`
- **Tokens:** `Math.ceil(content.length / 4)` (approximation for LLM context)

**Version:** Displayed at far right with reduced opacity

### 3.7 Find & Replace Panel

**Component:** `<FindReplace />`
**Type:** Floating, draggable modal
**Default Position:** 10px from top, 420px from right edge

**Layout:**
```
┌─────────────────────────────────┐
│ Find & Replace             [×]  │
├─────────────────────────────────┤
│ [Find input    ] [↑][↓] 1 of 5  │
│ [Replace input ] [Replace] [All]│
│ ☑ Case sensitive                │
└─────────────────────────────────┘
```

**Features:**
- **Draggable:** Drag by header, constrained to viewport
- **Find:** Real-time search with highlight overlay
- **Navigation:** Previous (↑ / Shift+Enter), Next (↓ / Enter)
- **Replace:** Current match or all matches
- **Case Sensitivity:** Toggle via checkbox

**View Mode Behavior:**
- **Raw/Split:** Highlights in code editor, replace enabled
- **Rendered/Text:** Highlights in preview, replace disabled (read-only)

**Highlight Rendering:**
- **Raw/Split:** Injects `<mark>` elements into highlight layer, syncs scroll
- **Rendered:** Recursively processes React children to wrap matches in `<mark>`
- **Text:** Similar to Rendered mode

**Match Styling:**
- Normal match: `background-color: rgba(255, 255, 0, 0.3)`
- Current match: `background-color: rgba(255, 165, 0, 0.5)` with border

**Keyboard Shortcuts:**
- `Esc` → Close panel
- `Enter` → Next match
- `Shift+Enter` → Previous match

### 3.8 Error Notification System

**Component:** `<ErrorNotification />`
**Position:** Fixed, top-right corner (20px from edges)
**Type:** Toast stack

**Notification Types:**
- **Error:** Red background (#ff4444)
- **Warning:** Orange background (#ff9800)
- **Info:** Blue background (#2196f3)

**Auto-Dismiss:** 5 seconds (configurable via `ERROR_DISPLAY_DURATION`)

**Structure:**
```typescript
interface ErrorItem {
  id: number;
  message: string;
  type: 'error' | 'warning' | 'info';
}
```

**Animation:** Slide-in from right (CSS keyframes)

**Dismiss:** Click × button or wait for auto-dismiss

### 3.9 Context Menus

#### 3.9.1 Tab Context Menu

**Trigger:** Right-click on tab
**Position:** At cursor position
**Items:**
- "Reveal in Finder" (disabled if no filePath)

**Behavior:**
- Click outside → closes menu
- Calls IPC `revealInFinder()` → uses `shell.showItemInFolder()`

#### 3.9.2 Text Context Menu

**Trigger:** Right-click in CodeEditor or MarkdownPreview
**Position:** At cursor position
**Items (conditional):**
- Cut (if editable and has selection)
- Copy (if has selection)
- Paste (if editable)
- Select All
- **Separator**
- Search with Perplexity (if has selection)
- **Separator** (if editable and has selection)
- Bold (if editable)
- Italic (if editable)
- List (if editable)

**Implementation:** Main process listens to `context-menu` event on webContents

---

## 4. Feature Specifications

### 4.1 Multi-Tab Document Management

**State Management:** `useDocuments()` hook

**Document Type:**
```typescript
interface Document {
  id: string;
  name: string;
  content: string;
  filePath: string | null;
  dirty?: boolean;
  lastSavedContent?: string;
}
```

**Tab Operations:**
- **Add:** `addDocument()` → generates unique ID, appends to array, switches active tab
- **Close:** `closeTab()` → removes from array, switches to last tab if closing active
- **Switch:** `setActiveTabId()` → updates active tab ID
- **Update:** `updateExistingDocument()` → updates specific document by ID

**Dirty State Tracking:**
- On content change: `dirty = (newContent !== lastSavedContent)`
- On save: `dirty = false`, `lastSavedContent = content`
- Show visual indicator (not implemented: could add dot to tab name)

**Close Confirmation:**
- If tab is dirty → show dialog with 3 buttons: "Save", "Don't Save", "Cancel"
- If "Save" → save document → close tab
- If "Don't Save" → close tab immediately
- If "Cancel" → abort close operation

**Window Close Behavior:**
- On window close → collect all dirty documents
- If any dirty → show dialog listing documents
- Options: "Save All" (saves all then quits), "Don't Save" (quits), "Cancel" (aborts)

### 4.2 Undo/Redo System

**Implementation:** Per-document history stack in `useDocuments()` hook

**History State:**
```typescript
interface HistoryState {
  past: string[];  // Previous states
  future: string[]; // Undone states
}
```

**Constants:**
- `MAX_HISTORY_SIZE = 100` (limits past array length)
- `DEBOUNCE_MS = 300` (groups rapid changes into single history entry)

**Debounce Logic:**
```typescript
const now = Date.now();
const lastUpdate = lastUpdateRef.current.get(activeTabId) || 0;

if (now - lastUpdate > DEBOUNCE_MS) {
  history.past = [...history.past, currentContent].slice(-MAX_HISTORY_SIZE);
}
history.future = []; // Clear future on new change
```

**Undo Flow:**
1. Pop from `past` → becomes new current content
2. Push previous current content to `future`
3. Update document state
4. Force re-render to update canUndo/canRedo

**Redo Flow:**
1. Pop from `future` → becomes new current content
2. Push previous current content to `past`
3. Update document state
4. Force re-render to update canUndo/canRedo

**Keyboard Shortcuts:**
- `Cmd+Z` → Undo
- `Cmd+Shift+Z` or `Cmd+Y` → Redo

### 4.3 Theme System

**Themes:**
1. System (respects OS preference)
2. Light
3. Dark
4. Solarized Light
5. Solarized Dark

**Implementation:** `useTheme()` hook

**Theme Cycle:** System → Light → Dark → Solarized Light → Solarized Dark → System

**Application:**
```typescript
const applyTheme = (newTheme: ThemeMode) => {
  const root = document.documentElement;

  if (newTheme === 'solarized-light') {
    root.setAttribute('data-theme', 'solarized-light');
  } else if (newTheme === 'solarized-dark') {
    root.setAttribute('data-theme', 'solarized-dark');
  } else {
    const isDark = newTheme === 'dark' ||
      (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }
};
```

**OS Preference Detection:**
```typescript
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
mediaQuery.addEventListener('change', () => {
  if (theme === 'system') applyTheme('system');
});
```

**Theme Icons:**
- System: ⚙️
- Light: ☀️
- Dark: 🌙
- Solarized Light: 🌅
- Solarized Dark: 🌃

### 4.4 Text Formatting

**Implementation:** `useTextFormatting()` hook

**Supported Formats:**
- `bold`: Wraps selection with `**text**`
- `italic`: Wraps selection with `*text*`
- `list`: Prefixes each line with `- `
- `h1` through `h6`: Prefixes selection with `#` to `######`
- `code`: Wraps selection with triple backticks
- `quote`: Prefixes each line with `> `
- `hr`: Inserts `\n---\n`

**Logic (bold example):**
```typescript
const handleFormat = (format: 'bold') => {
  const textarea = textareaRef.current;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = content.substring(start, end);

  const newText = `**${selectedText}**`;
  const newContent = content.substring(0, start) + newText + content.substring(end);

  updateContent(newContent);

  // Restore selection after state update
  setTimeout(() => {
    textarea.setSelectionRange(start + 2, end + 2);
    textarea.focus();
  }, CALCULATIONS.FOCUS_RESTORE_DELAY);
};
```

**Keyboard Shortcuts:**
- `Cmd+B` → Bold
- `Cmd+I` → Italic

**UI Triggers:**
- Toolbar buttons
- Context menu (right-click)
- Headings dropdown

### 4.5 Find & Replace

**Implementation:** `<FindReplace />` component

**State:**
```typescript
const [findText, setFindText] = useState('');
const [replaceText, setReplaceText] = useState('');
const [caseSensitive, setCaseSensitive] = useState(false);
const [matches, setMatches] = useState<Match[]>([]);
const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
```

**Match Finding:**
```typescript
const searchText = caseSensitive ? findText : findText.toLowerCase();
const searchContent = caseSensitive ? content : content.toLowerCase();

let index = 0;
while (index < searchContent.length) {
  const foundIndex = searchContent.indexOf(searchText, index);
  if (foundIndex === -1) break;

  matches.push({ start: foundIndex, end: foundIndex + findText.length });
  index = foundIndex + 1;
}
```

**Navigation:**
- Next: `setCurrentMatchIndex((prev) => (prev + 1) % matches.length)`
- Previous: `setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length)`

**Replace Current:**
```typescript
const match = matches[currentMatchIndex];
textarea.setSelectionRange(match.start, match.end);
document.execCommand('insertText', false, replaceText);
```

**Replace All:**
```typescript
let newContent = content;
for (let i = matches.length - 1; i >= 0; i--) {
  const match = matches[i];
  newContent = newContent.substring(0, match.start) +
               replaceText +
               newContent.substring(match.end);
}
onReplace(newContent);
```

**Scrolling to Match:**
```typescript
const textBeforeMatch = content.substring(0, match.start);
const lines = textBeforeMatch.split('\n');
const lineNumber = lines.length - 1;
const lineHeight = parseFloat(computedStyle.lineHeight);
const matchScrollTop = lineNumber * lineHeight;
const centeredScrollTop = matchScrollTop - (viewportHeight / 2);
textarea.scrollTop = Math.max(0, centeredScrollTop);
```

### 4.6 Save Functionality

**Save Formats:**
1. Markdown (.md, .markdown)
2. PDF (.pdf)
3. Plain Text (.txt)

**Implementation:** IPC handler `save-file` in main process

**Save Dialog:**
```typescript
const result = await dialog.showSaveDialog(parentWindow, {
  title: 'Save As',
  defaultPath: filePath || path.join(getDefaultSaveDirectory(), filename),
  filters: [
    { name: 'Markdown Files', extensions: ['md', 'markdown'] },
    { name: 'PDF Files', extensions: ['pdf'] },
    { name: 'Text Files', extensions: ['txt'] },
    { name: 'All Files', extensions: ['*'] }
  ]
});
```

**PDF Generation:**
1. Convert markdown to HTML via `unified`, `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-sanitize`, `rehype-highlight`, `rehype-stringify`
2. Inject inline CSS for print-friendly styling
3. Create temporary hidden BrowserWindow
4. Load HTML into window via data URI
5. Call `webContents.printToPDF()` with 0.5in margins
6. Write buffer to file
7. Destroy temporary window

**Plain Text Conversion:**
- Uses `convertMarkdownToText()` utility
- Strips formatting, converts tables to ASCII box-drawing, preserves structure

**Default Save Location:**
- New files: `~/Documents/` (or `~` if Documents doesn't exist)
- Existing files: Current file path

### 4.7 Recent Files Menu

**Storage:** JSON file at `app.getPath('userData')/recent-files.json`

**Max Files:** 50

**Data Structure:**
```typescript
let recentFiles: string[] = [
  '/Users/name/Documents/file1.md',
  '/Users/name/Documents/file2.md',
  // ... up to 50 files
];
```

**Add to Recent:**
```typescript
const addRecentFile = (filePath: string) => {
  recentFiles = recentFiles.filter(f => f !== filePath); // Remove duplicates
  recentFiles.unshift(filePath); // Add to front
  if (recentFiles.length > MAX_RECENT_FILES) {
    recentFiles = recentFiles.slice(0, MAX_RECENT_FILES);
  }
  saveRecentFiles();
  createMenu(); // Rebuild menu to reflect changes
};
```

**Menu Building:**
```typescript
const recentFilesSubmenu: MenuItemConstructorOptions[] = [];

const existingRecentFiles = recentFiles.filter(filePath => fs.existsSync(filePath));

existingRecentFiles.forEach((filePath) => {
  recentFilesSubmenu.push({
    label: filePath, // Full path shown
    click: () => openFile(filePath)
  });
});

recentFilesSubmenu.push({ type: 'separator' });
recentFilesSubmenu.push({
  label: 'Clear Recent',
  enabled: existingRecentFiles.length > 0,
  click: () => clearRecentFiles()
});
```

**Persistence:**
- Debounced writes (500ms) to avoid excessive disk I/O
- Async file operations (`fsPromises.writeFile()`)

### 4.8 Image Embedding

**Two Methods:**

#### 4.8.1 Drag-and-Drop Image Files

**Trigger:** Drag image file onto app window

**Requirements:**
- Document must be saved (needs `filePath`)
- Image extension must be in `ALLOWED_IMAGE_EXTENSIONS`: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`
- Image size must be ≤ 10MB

**Flow:**
1. User drags image file onto app window
2. Renderer detects drop, extracts file path via `electronAPI.getPathForFile(file)`
3. Renderer calls `electronAPI.copyImageToDocument(imagePath, markdownFilePath)`
4. Main process:
   - Validates image extension and size
   - Creates `images/` directory next to markdown file
   - Copies image to `images/` with collision handling (appends `-1`, `-2`, etc.)
   - Returns relative path: `./images/photo.png`
5. Renderer inserts markdown syntax: `![filename](./images/photo.png)`
6. Shows success toast: "Image embedded: filename.png"

#### 4.8.2 Relative Image Path Rendering

**Implementation:** Custom `img` component in MarkdownPreview

**Flow:**
1. Markdown contains relative path: `![Photo](./images/photo.png)`
2. MarkdownPreview detects relative path (not `data:` or `http://`)
3. Calls `electronAPI.readImageFile('./images/photo.png', markdownFilePath)`
4. Main process:
   - Resolves path relative to markdown file directory
   - Validates path is within markdown directory tree (prevents traversal)
   - Validates image extension
   - Reads file as buffer
   - Converts to base64 data URI: `data:image/png;base64,...`
   - Caches in `imageCache` Map to avoid reloading
5. Component renders with data URI: `<img src={dataUri} alt={alt} />`

**Security:**
- Images must be in subdirectory of markdown file (prevents `../../etc/passwd`)
- Extension validation
- Size limits (10MB)
- Cache cleared when `filePath` changes

### 4.9 Inline Text Editing

**Feature:** Click text in Rendered view to edit directly

**Editable Elements:**
- Paragraphs (`<p>`)
- Headings (`<h1>` through `<h6>`)
- List items (`<li>`)
- Table cells (`<td>`, `<th>`)
- Blockquotes (`<blockquote>`)

**Implementation:**
```typescript
// In MarkdownPreview component
if (onContentChange && node?.position) {
  return (
    <p
      contentEditable={true}
      suppressContentEditableWarning={true}
      data-source-start={node.position.start.offset}
      data-source-end={node.position.end.offset}
      onBlur={handleTextEdit}
    >
      {processedChildren}
    </p>
  );
}
```

**Edit Flow:**
1. User clicks paragraph → becomes editable (cursor appears)
2. User types new text
3. User clicks outside → `onBlur` event fires
4. Handler extracts:
   - `start` and `end` offsets from data attributes (AST positions)
   - New text from `element.textContent`
5. Extract original markdown: `content.slice(start, end)`
6. Replace text content while preserving formatting via `replaceTextContent()` utility
7. Update content: `content.slice(0, start) + updatedMarkdown + content.slice(end)`

**Hover/Focus Styling:**
- Hover: `background-color: rgba(127, 127, 127, 0.08)`
- Focus: `background-color: rgba(38, 139, 210, 0.12)` with blue box-shadow

### 4.10 Copy to Clipboard

**Three Modes:**

#### 4.10.1 Raw Mode
- Copies plain markdown text
- Sanitizes to remove control characters (except \n, \r, \t)

#### 4.10.2 Text Mode
- Converts markdown to plain text via `convertMarkdownToText()`
- Sanitizes result
- Copies to clipboard

#### 4.10.3 Rendered/Split Mode
- Extracts HTML from `.markdown-preview` element
- Sanitizes HTML (removes scripts, iframes, event handlers, unsafe URLs)
- Extracts plain text as fallback
- Creates dual-format clipboard item:

```typescript
const htmlBlob = new Blob([sanitizedHtml], { type: 'text/html' });
const textBlob = new Blob([sanitizedText], { type: 'text/plain' });
const data = [new ClipboardItem({
  'text/html': htmlBlob,
  'text/plain': textBlob
})];
await navigator.clipboard.write(data);
```

**Fallback:** If Clipboard API fails, use `navigator.clipboard.writeText()` with plain text

### 4.11 Word Wrap Toggle

**State:** Managed by `useWordWrap()` hook, default `true`

**UI Controls:**
1. Toolbar button (⤸ when on, → when off)
2. View menu item with checkbox and keyboard shortcut
3. Keyboard shortcut: `Cmd+Alt+W`

**Application:**
- Sets CSS class on textarea and highlight layer
- `.word-wrap`: `white-space: pre-wrap; word-wrap: break-word; overflow-x: hidden;`
- `.no-wrap`: `white-space: pre; overflow-x: auto;`

**Syncing:**
- Toolbar button click → updates state
- Menu item click → sends IPC → renderer updates state
- Keyboard shortcut → updates state

---

## 5. Security Architecture

### 5.1 Electron Security Model

**Principles:**
1. **Least Privilege:** Renderer has minimal permissions
2. **Defense in Depth:** Multiple layers of protection
3. **Input Validation:** Never trust data from any source
4. **Safe Defaults:** Secure by default, opt-in for unsafe features

**Configuration:**
```typescript
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,      // Renderer can't access preload scope
  nodeIntegration: false,       // Renderer can't use Node.js APIs
  sandbox: true,                // Renderer runs in OS-level sandbox
}
```

### 5.2 Content Security Policy

**Implementation:** Via `rehype-sanitize` plugin

**Sanitization Rules:**
- Removes `<script>`, `<iframe>`, `<object>`, `<embed>` tags
- Removes event handlers (`onclick`, `onerror`, etc.)
- Removes `javascript:`, `data:`, `vbscript:` URLs
- Allows safe HTML tags (h1-h6, p, ul, ol, li, a, img, code, pre, etc.)
- Allows safe attributes (href, src, alt, title, etc.)

**PDF Export CSP:**
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               img-src 'self' data: blob:;
               style-src 'unsafe-inline';
               font-src 'self' data:;">
```

### 5.3 Input Validation

#### 5.3.1 File Path Validation

**Function:** `isPathSafe(filepath: string): boolean`

**Checks:**
1. Resolve to absolute path to prevent relative path traversal
2. Check file extension against allowlist: `.md`, `.markdown`
3. Log and reject invalid extensions

**Example:**
```typescript
const resolved = path.resolve(filepath);
const ext = path.extname(resolved).toLowerCase();
if (!SECURITY_CONFIG.ALLOWED_EXTENSIONS.includes(ext)) {
  console.warn(`Rejected file with invalid extension: ${ext}`);
  return false;
}
```

#### 5.3.2 File Content Validation

**Function:** `validateFileContent(buffer: Buffer)`

**Checks:**
1. **UTF-8 Encoding:** Decode buffer, check for decoding errors
2. **BOM Detection:** Strip UTF-8 BOM if present
3. **Binary Detection:** Count control characters (excluding \n, \r, \t)
4. **Ratio Check:** Reject if control char ratio > 10%

**Implementation:**
```typescript
export const validateFileContent = (buffer: Buffer) => {
  let content: string;
  try {
    content = buffer.toString('utf-8');
  } catch {
    return { valid: false, error: 'File is not valid UTF-8 text' };
  }

  if (content.startsWith('\uFEFF')) {
    content = content.slice(1); // Strip BOM
  }

  let controlChars = 0;
  for (const char of content) {
    const code = char.charCodeAt(0);
    if (code < 32 && !ALLOWED_CONTROL_CHARS.includes(char)) {
      controlChars++;
    }
  }

  const ratio = controlChars / content.length;
  if (ratio > FILE_INTEGRITY.MAX_CONTROL_CHAR_RATIO) {
    return { valid: false, error: 'File appears to be binary or corrupted' };
  }

  return { valid: true, content };
};
```

#### 5.3.3 URL Validation

**Function:** `validateExternalUrl(url: string)`

**Checks:**
1. Length ≤ 2048 characters
2. Not empty after trim
3. Valid URL format (parseable by `new URL()`)
4. Protocol in allowlist: `https:`, `http:`
5. Protocol not in blocklist (defensive logging)

**Returns:**
```typescript
{
  isValid: boolean;
  sanitizedUrl?: string; // Normalized by URL parser
  error?: string;
}
```

### 5.4 Rate Limiting

**Implementation:** `createRateLimiter(maxCalls, windowMs)`

**Configuration:** 100 calls per second per window per channel

**Algorithm:**
1. Track timestamps of recent calls per identifier (sender ID + channel)
2. On new call, filter timestamps to last `windowMs`
3. If count ≥ `maxCalls`, reject
4. Otherwise, add timestamp and allow

**Memory Management:**
- Auto-cleanup every 60 seconds
- Removes identifiers inactive for 2× window time
- Prevents unbounded growth from abandoned identifiers

**Application:**
```typescript
const rateLimiter = createRateLimiter(
  SECURITY_CONFIG.RATE_LIMIT.MAX_CALLS,
  SECURITY_CONFIG.RATE_LIMIT.WINDOW_MS
);

ipcMain.handle('save-file', (event, data) => {
  const senderId = event.sender.id.toString();
  if (!rateLimiter(senderId + '-save-file')) {
    console.warn('Rate limit exceeded for save-file');
    return { success: false, error: 'Rate limit exceeded' };
  }
  // ... proceed with save
});
```

### 5.5 IPC Origin Validation

**Function:** `isValidIPCOrigin(event: IpcMainInvokeEvent): boolean`

**Checks:**
1. Extract BrowserWindow from event sender
2. Verify window exists and is not destroyed
3. Verify window is in list of known windows

**Purpose:** Prevents malicious IPC calls from:
- External processes
- Compromised renderer contexts
- Destroyed windows

**Application:** First check in every IPC handler

### 5.6 Resource Limits

**File Size Limits:**
- Markdown files: 50MB
- IPC message content: 10MB
- Image files: 10MB

**Count Limits:**
- Max concurrent windows: 10
- Max dropped tab tracking: 1000
- Max recent files: 50
- Max undo history per document: 100

**Enforcement:**
```typescript
const stats = await fsPromises.stat(filepath);
if (stats.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
  const maxSizeMB = SECURITY_CONFIG.MAX_FILE_SIZE / (1024 * 1024);
  dialog.showErrorBox('File Too Large', `Exceeds ${maxSizeMB}MB`);
  return;
}
```

### 5.7 Error Message Sanitization

**Function:** `sanitizeError(error: Error): string`

**Development Mode:**
- Return error message with paths replaced by basenames
- Example: `/Users/name/Documents/file.md` → `.../file.md`

**Production Mode:**
- Return generic message: "An error occurred while processing the file"
- Prevents information disclosure

**Implementation:**
```typescript
const sanitizeError = (error: Error | NodeJS.ErrnoException): string => {
  if (app.isPackaged) {
    return 'An error occurred while processing the file';
  }

  let message = error.message;
  message = message.replace(/\/[^\s]+\//g, (match) => {
    const basename = path.basename(match);
    return basename ? `.../${basename}` : match;
  });
  return message;
};
```

### 5.8 Clipboard Sanitization

**HTML Sanitization:**
- Removes `<script>`, `<iframe>`, `<link>`, `<style>` tags
- Removes event handlers (onclick, onerror, onload, etc.)
- Removes `javascript:`, `data:`, `vbscript:` URLs from href/src
- Preserves safe formatting (b, i, u, em, strong, code, pre, etc.)

**Text Sanitization:**
- Removes control characters (except \n, \r, \t)
- Prevents injection via terminal escape sequences

---

## 6. Build System

### 6.1 Electron Forge Configuration

**File:** `forge.config.js`

**Packager Config:**
```javascript
packagerConfig: {
  asar: true,
  extendInfo: {
    CFBundleDocumentTypes: [
      {
        CFBundleTypeName: 'Markdown File',
        CFBundleTypeRole: 'Editor',
        LSHandlerRank: 'Owner',
        LSItemContentTypes: ['net.daringfireball.markdown'],
        CFBundleTypeExtensions: ['md', 'markdown'],
      },
    ],
  },
}
```

**Explanation:**
- `asar: true`: Package app into single ASAR archive
- `CFBundleDocumentTypes`: Register as handler for .md files on macOS
- `LSHandlerRank: 'Owner'`: Make mdviewer the preferred app for .md files
- `LSItemContentTypes`: UTI for markdown files

**Makers:**
1. `@electron-forge/maker-squirrel` (Windows installer)
2. `@electron-forge/maker-zip` (macOS ZIP archive)
3. `@electron-forge/maker-deb` (Debian package)
4. `@electron-forge/maker-rpm` (Red Hat package)

**Plugins:**
1. `@electron-forge/plugin-vite`: Build system integration
2. `@electron-forge/plugin-fuses`: Security hardening

### 6.2 Vite Configuration

**Three Separate Configs:**

#### 6.2.1 Main Process (`vite.main.config.mjs`)
- Entry: `src/main.ts`
- Target: `main`
- Output: `.vite/build/main.js`

#### 6.2.2 Preload Script (`vite.preload.config.mjs`)
- Entry: `src/preload.ts`
- Target: `preload`
- Output: `.vite/build/preload.js`

#### 6.2.3 Renderer Process (`vite.renderer.config.mjs`)
- Entry: `src/renderer.tsx`
- Plugin: `@vitejs/plugin-react`
- Output: `.vite/renderer/main_window/`
- HMR: Enabled (hot module replacement in dev mode)

### 6.3 Electron Fuses

**Purpose:** Disable dangerous Electron features at build time

**Configuration:**
```javascript
new FusesPlugin({
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,                    // Disable Node.js CLI
  [FuseV1Options.EnableCookieEncryption]: true,        // Encrypt cookies
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false, // Disable NODE_OPTIONS
  [FuseV1Options.EnableNodeCliInspectArguments]: false, // Disable --inspect
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true, // Validate ASAR
  [FuseV1Options.OnlyLoadAppFromAsar]: true,           // Only load from ASAR
})
```

### 6.4 TypeScript Configuration

**Four Separate tsconfig Files:**

#### 6.4.1 Base (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true
  }
}
```

#### 6.4.2 Main Process (`tsconfig.main.json`)
- Extends base
- Includes `src/main.ts`
- Target: Node.js environment

#### 6.4.3 Preload Script (`tsconfig.preload.json`)
- Extends base
- Includes `src/preload.ts`
- Target: Hybrid environment (Node.js + Electron APIs)

#### 6.4.4 Renderer Process (`tsconfig.renderer.json`)
- Extends base
- Includes `src/renderer.tsx`, `src/**/*.tsx`, `src/**/*.ts`
- Target: Browser environment (React, DOM APIs)

#### 6.4.5 Test Files (`tsconfig.test.json`)
- Extends base
- Includes `src/**/*.test.ts`, `src/**/*.test.tsx`
- Target: jsdom environment

### 6.5 Build Scripts

**package.json scripts:**
```json
{
  "start": "electron-forge start",           // Dev mode with HMR
  "package": "electron-forge package",       // Package app (no installer)
  "make": "electron-forge make",             // Create distributable
  "publish": "electron-forge publish",       // Publish to GitHub/S3
  "typecheck": "tsc --noEmit",               // Check all TypeScript
  "typecheck:main": "tsc --noEmit -p tsconfig.main.json",
  "typecheck:preload": "tsc --noEmit -p tsconfig.preload.json",
  "typecheck:renderer": "tsc --noEmit -p tsconfig.renderer.json",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:ui": "vitest --ui"
}
```

### 6.6 Development vs Production

**Development Mode (`npm start`):**
- Vite dev server for renderer (HMR enabled)
- Main/preload require restart on changes
- DevTools available (if uncommented)
- File associations NOT registered (dev server is not .app bundle)
- Source maps enabled
- Error messages verbose

**Production Mode (`npm run make`):**
- Compiled to native executables
- ASAR packaging enabled
- File associations registered via `CFBundleDocumentTypes`
- Fuses applied (security hardening)
- Code minified
- DevTools hidden (can be shown via menu)
- Error messages sanitized

### 6.7 macOS-Specific Build

**DMG Creation:**
- Maker: `@electron-forge/maker-zip`
- Platform: `darwin` (macOS)
- Output: `.dmg` file in `out/make/`

**Code Signing (Future):**
- Apple Developer ID certificate required
- Notarization for Gatekeeper
- Entitlements for sandboxing

**App Store (Future):**
- Requires Mac App Store certificate
- Strict sandboxing requirements
- No private APIs
- Hardened runtime

---

## 7. Testing Requirements

### 7.1 Testing Stack

**Test Runner:** Vitest 3.2.4
**Component Testing:** React Testing Library 16.3.0
**Environment:** jsdom 25.0.1
**Coverage:** @vitest/coverage-v8

### 7.2 Test Configuration

**File:** `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
      thresholds: {
        lines: 5,
        functions: 45,
        branches: 50,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 7.3 Test Setup

**File:** `src/test/setup.ts`

**Purpose:** Global test configuration and mocks

**Includes:**
- `@testing-library/jest-dom` matchers
- Electron API mocks (all `window.electronAPI` methods)
- `window.matchMedia` mock for theme testing

**Electron Mock Example:**
```typescript
beforeEach(() => {
  (global as any).window.electronAPI = {
    onFileOpen: vi.fn(() => vi.fn()),
    onFileNew: vi.fn(() => vi.fn()),
    saveFile: vi.fn(() => Promise.resolve({ success: true })),
    readFile: vi.fn(() => Promise.resolve({ content: '' })),
    // ... all other methods
  };
});
```

### 7.4 Test File Conventions

**Location:** Co-located with source files

**Naming:**
- `Component.tsx` → `Component.test.tsx`
- `utility.ts` → `utility.test.ts`

**Example Structure:**
```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Component } from './Component';

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<Component />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Result')).toBeInTheDocument();
  });
});
```

### 7.5 Coverage Requirements

**Current Thresholds:**
- Lines: 5%
- Functions: 45%
- Branches: 50%

**Rationale:** Low thresholds due to:
- Main process not tested (requires Electron-specific setup)
- Preload script not tested (requires context isolation testing)
- Many IPC integrations difficult to test in jsdom

**Future Goals:**
- Increase to 80% lines, 80% functions, 75% branches
- Add E2E tests with Playwright or Spectron
- Add main process unit tests

### 7.6 What to Test

**Unit Tests:**
- Utility functions (`textCalculations`, `textConverter`, `clipboardSanitizer`)
- Custom hooks (`useTheme`, `useDocuments`, `useTextFormatting`)
- Pure components without IPC dependencies

**Component Tests:**
- UI rendering (ErrorNotification, CodeBlock)
- User interactions (button clicks, input changes)
- Accessibility (ARIA attributes, keyboard navigation)

**Integration Tests (Future):**
- File opening flow (main → preload → renderer)
- Save flow with dialog
- Multi-window tab dragging

### 7.7 Running Tests

**Commands:**
```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode (re-runs on changes)
npm run test:coverage # Generate coverage report
npm run test:ui       # Launch Vitest UI
```

**Output:**
- Terminal: Test results with pass/fail counts
- Coverage report: `coverage/index.html`
- Vitest UI: `http://localhost:51204/__vitest__/`

---

## 8. Dependencies

### 8.1 Production Dependencies

**Core Framework:**
```json
{
  "electron": "39.2.3",
  "react": "19.2.0",
  "react-dom": "19.2.0"
}
```

**Markdown Processing:**
```json
{
  "react-markdown": "10.1.0",
  "remark-gfm": "4.0.1",           // GitHub Flavored Markdown
  "remark-parse": "11.0.0",         // Markdown parser
  "remark-rehype": "11.1.2",        // Markdown → HTML AST
  "rehype-highlight": "7.0.2",      // Syntax highlighting
  "rehype-sanitize": "6.0.0",       // XSS prevention
  "rehype-stringify": "10.0.1",     // HTML serialization
  "unified": "11.0.5"               // AST processing pipeline
}
```

**Utilities:**
```json
{
  "electron-squirrel-startup": "1.0.1"  // Windows installer helper
}
```

### 8.2 Development Dependencies

**Electron Forge:**
```json
{
  "@electron-forge/cli": "7.10.2",
  "@electron-forge/maker-deb": "7.10.2",
  "@electron-forge/maker-rpm": "7.10.2",
  "@electron-forge/maker-squirrel": "7.10.2",
  "@electron-forge/maker-zip": "7.10.2",
  "@electron-forge/plugin-auto-unpack-natives": "7.10.2",
  "@electron-forge/plugin-fuses": "7.10.2",
  "@electron-forge/plugin-vite": "7.10.2",
  "@electron/fuses": "1.8.0"
}
```

**Build Tools:**
```json
{
  "vite": "6.4.1",
  "@vitejs/plugin-react": "5.1.1",
  "typescript": "5.9.3"
}
```

**Testing:**
```json
{
  "vitest": "3.2.4",
  "@vitest/coverage-v8": "3.2.4",
  "@vitest/ui": "3.2.4",
  "@testing-library/react": "16.3.0",
  "@testing-library/jest-dom": "6.9.1",
  "@testing-library/user-event": "14.6.1",
  "jsdom": "25.0.1"
}
```

**TypeScript:**
```json
{
  "@types/node": "24.10.1",
  "@types/react": "19.2.6",
  "@types/react-dom": "19.2.3"
}
```

**Linting:**
```json
{
  "eslint": "9.39.1",
  "@typescript-eslint/eslint-plugin": "8.47.0",
  "@typescript-eslint/parser": "8.47.0",
  "eslint-plugin-no-secrets": "2.2.1",
  "eslint-plugin-security": "3.0.1"
}
```

### 8.3 Dependency Rationale

**Why these specific versions?**

- **Electron 39.2.3:** Latest stable, security patches
- **React 19.2.0:** Modern hooks, concurrent features
- **TypeScript 5.9.3:** Latest stable, improved type inference
- **Vite 6.4.1:** Fast HMR, ES modules support
- **Vitest 3.2.4:** Vite-native, faster than Jest

**Peer Dependencies:**
- None (all dependencies bundled in Electron app)

---

## 9. File Structure

```
mdviewer/
├── src/
│   ├── main.ts                    # Electron main process (1639 lines)
│   ├── preload.ts                 # IPC bridge (92 lines)
│   ├── renderer.tsx               # React entry point (17 lines)
│   ├── App.tsx                    # Main app component (1024 lines)
│   ├── index.css                  # Global styles (1420 lines)
│   │
│   ├── components/
│   │   ├── MarkdownPreview.tsx    # Markdown renderer (541 lines)
│   │   ├── CodeEditor.tsx         # Textarea with highlights (81 lines)
│   │   ├── ErrorNotification.tsx  # Toast system (31 lines)
│   │   ├── FindReplace.tsx        # Search panel (415 lines)
│   │   ├── TextPreview.tsx        # Plain text view (100 lines)
│   │   └── CodeBlock.tsx          # Code copy button (46 lines)
│   │
│   ├── hooks/
│   │   ├── index.ts               # Hook exports
│   │   ├── useDocuments.ts        # Multi-tab state (218 lines)
│   │   ├── useTheme.ts            # Theme management (66 lines)
│   │   ├── useTextFormatting.ts   # Markdown formatting (150 lines)
│   │   ├── useFileHandler.ts      # File IPC (120 lines)
│   │   ├── useErrorHandler.ts     # Toast notifications (50 lines)
│   │   ├── useKeyboardShortcuts.ts # Hotkeys (80 lines)
│   │   └── useWordWrap.ts         # Word wrap state (30 lines)
│   │
│   ├── types/
│   │   ├── document.d.ts          # Document types
│   │   ├── electron.d.ts          # IPC types
│   │   ├── error.d.ts             # Error types
│   │   └── electron-squirrel-startup.d.ts
│   │
│   ├── utils/
│   │   ├── textCalculations.ts    # Word/char/token count (16 lines)
│   │   ├── textConverter.ts       # Markdown → plain text (338 lines)
│   │   ├── pdfRenderer.ts         # PDF generation (134 lines)
│   │   ├── clipboardSanitizer.ts  # HTML/text sanitization (80 lines)
│   │   ├── fileValidator.ts       # File integrity checks (60 lines)
│   │   └── textEditing.ts         # Inline edit helpers (50 lines)
│   │
│   ├── constants/
│   │   ├── index.ts               # App constants (117 lines)
│   │   └── defaultContent.ts      # Default document content
│   │
│   └── test/
│       ├── setup.ts               # Test configuration
│       └── __mocks__/
│           └── electron.ts        # Electron API mocks
│
├── forge.config.js                # Electron Forge config (78 lines)
├── vite.main.config.mjs           # Main process Vite config
├── vite.preload.config.mjs        # Preload Vite config
├── vite.renderer.config.mjs       # Renderer Vite config
├── vitest.config.ts               # Vitest config
├── tsconfig.json                  # Base TypeScript config
├── tsconfig.main.json             # Main process TS config
├── tsconfig.preload.json          # Preload TS config
├── tsconfig.renderer.json         # Renderer TS config
├── tsconfig.test.json             # Test files TS config
├── package.json                   # Dependencies & scripts
├── README.md                      # User documentation (281 lines)
├── CHANGELOG.md                   # Full version history
├── CLAUDE.md                      # Development guide
└── LICENSE                        # MIT License
```

**Key Files by LOC:**
1. `src/main.ts` - 1639 lines (main process logic)
2. `src/index.css` - 1420 lines (complete styling system)
3. `src/App.tsx` - 1024 lines (React app container)
4. `src/components/MarkdownPreview.tsx` - 541 lines
5. `src/components/FindReplace.tsx` - 415 lines

**Total Source Lines:** ~8,000 lines of TypeScript/TSX/CSS

---

## 10. Behavioral Specifications

### 10.1 Application Lifecycle

**Launch:**
1. Check for Squirrel installer startup → quit if installer event
2. Load preferences from `userData/preferences.json`
3. Load recent files from `userData/recent-files.json`
4. Create application menu
5. Create main window (800×600)
6. Listen for pending file-open events
7. If pending file → open it once window is ready

**Window Ready:**
1. Load Vite dev server URL (dev) or static HTML (prod)
2. Initialize renderer React app
3. Mount default document or pending file
4. Start listening for IPC events

**File Open Event:**
1. macOS sends `open-file` event to main process
2. Main reads file securely (validation + size check)
3. Main sends content to renderer via `file-open` IPC
4. Renderer checks if file already open (by path)
5. If open → switch to existing tab
6. If new → create new tab with content
7. Add to recent files list

**Window Close:**
1. Main requests list of unsaved documents via IPC
2. If unsaved docs exist → show confirmation dialog
3. If user cancels → abort close
4. If user chooses "Save All" → renderer saves all → then closes
5. If user chooses "Don't Save" → force close immediately
6. On actual close → cleanup window reference, decrement count

**App Quit:**
1. All windows close (macOS typically quits when last window closes)
2. Cleanup timers and listeners
3. Exit process

### 10.2 File Opening Edge Cases

**Same File Twice:**
- Check if document with same `filePath` exists
- If yes → switch to existing tab (don't create duplicate)
- If no → create new tab

**Untitled Documents:**
- New documents have `filePath: null`
- Name defaults to "Untitled"
- Can have multiple "Untitled" tabs (each has unique ID)
- On save → dialog defaults to `~/Documents/Untitled.md`

**Very Large Files:**
- Files > 50MB → rejected with error dialog
- Content > 10MB in IPC → rejected (but shouldn't happen after 50MB check)

**Binary Files:**
- UTF-8 decode error → show error dialog
- High control character ratio → show error dialog

**Non-Existent Paths:**
- Recent files menu filters out missing files automatically
- Attempting to open missing file → shows error dialog

### 10.3 Tab Management Behaviors

**Creating New Tab:**
1. Click "+" button or press Cmd+N
2. Generate unique ID: `Date.now().toString()`
3. Add to `documents` array
4. Switch `activeTabId` to new document
5. Content area shows empty Raw view

**Switching Tabs:**
1. Click tab or use keyboard (not implemented)
2. Update `activeTabId` state
3. Content area re-renders with new document
4. Undo/redo history switches to new document's history

**Closing Tab:**
1. Click × on tab
2. If dirty → show unsaved dialog
3. If user confirms → remove from `documents` array
4. If last tab → create new default "Untitled" tab
5. If active tab → switch to last tab in array

**Dragging Tab Out:**
1. User drags tab outside window bounds
2. `handleDragEnd` detects coordinates outside window
3. Call IPC `createWindowForTab()` with document data
4. Main creates new window, sends `file-open` with content
5. Close tab in source window

**Dragging Tab Between Windows:**
1. User drags tab from Window A to Window B
2. Window B's drop handler receives tab data
3. Window B calls IPC `notifyTabDropped(dragId)`
4. Window A's `handleDragEnd` calls `checkTabDropped(dragId)` → returns true
5. Window A closes tab (tab moved to Window B)

### 10.4 View Mode Transitions

**Rendered → Raw:**
1. User clicks "Raw" button or presses Cmd+E
2. `setViewMode('raw')` state update
3. Content area unmounts `<MarkdownPreview />`
4. Content area mounts `<CodeEditor />`
5. Textarea receives content, cursor at start

**Raw → Split:**
1. User clicks "Split" button or presses Cmd+E
2. `setViewMode('split')` state update
3. Content area unmounts `<CodeEditor />`
4. Content area mounts split view with both components
5. Divider positioned at 50%

**Split → Text:**
1. User clicks "Text" button or presses Cmd+E
2. `setViewMode('text')` state update
3. Content area unmounts split view
4. Content area mounts `<TextPreview />`
5. Text conversion happens via `useMemo`

**Text → Rendered:**
1. User clicks "Rendered" button or presses Cmd+E
2. Completes cycle back to Rendered mode

**Formatting Button Disable:**
- In Rendered or Text mode → formatting buttons disabled
- In Raw or Split mode → formatting buttons enabled
- Visual: opacity 0.3, cursor not-allowed

### 10.5 Theme Switching Behavior

**User Clicks Theme Button:**
1. Call `handleThemeToggle()`
2. State cycles: system → light → dark → solarized-light → solarized-dark → system
3. `useEffect` triggers on theme change
4. Call `applyTheme(newTheme)`
5. Set `data-theme` attribute on `<html>` element
6. CSS custom properties update via `:root[data-theme='...']` selectors
7. All colors transition smoothly (0.3s transition)

**System Theme Detection:**
1. On mount, listen to `matchMedia('(prefers-color-scheme: dark)')`
2. If theme is "system" → apply dark or light based on OS preference
3. Listen for OS theme change → reapply if still in system mode
4. Cleanup listener on unmount

### 10.6 Search and Replace Behavior

**Find Panel Opens:**
1. User presses Cmd+F or clicks 🔍 button
2. `setShowFindReplace(true)` state update
3. Panel mounts at default position (top-right)
4. Find input auto-focuses
5. Panel is draggable by header

**User Types Search Term:**
1. `setFindText(value)` on input change
2. `useEffect` triggers, finds all matches in content
3. `setMatches([...])` and `setCurrentMatchIndex(0)`
4. Another `useEffect` generates highlighted content
5. Highlight layer or preview updates with `<mark>` elements
6. Current match styled differently (orange background)

**User Clicks Next (↓):**
1. `setCurrentMatchIndex((prev) => (prev + 1) % matches.length)`
2. Highlight layer updates current match styling
3. Textarea scrolls to center match in viewport

**User Clicks Replace:**
1. Get current match start/end positions
2. Set textarea selection to match
3. Execute `document.execCommand('insertText', false, replaceText)`
4. This preserves undo stack (unlike direct state update)
5. Advance to next match

**User Clicks Replace All:**
1. Iterate matches in reverse order (to preserve indices)
2. Build new content with all replacements
3. Select all text in textarea
4. Execute `document.execCommand('insertText', false, newContent)`
5. All matches replaced in single undo operation

**Panel Dragging:**
1. User clicks header (not buttons or inputs)
2. `setIsDragging(true)`, record drag offset
3. On `mousemove` (document level) → calculate new position
4. Constrain to viewport bounds (0, 0) to (width - panelWidth, height - panelHeight)
5. Update CSS custom properties `--panel-x`, `--panel-y`
6. On `mouseup` → `setIsDragging(false)`

### 10.7 Keyboard Shortcut Behavior

**Implementation:** Single `useEffect` with event listener

**Handler Logic:**
```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  const isMeta = e.metaKey;  // Cmd on Mac, Ctrl on Windows
  const isShift = e.shiftKey;

  if (isMeta && !isShift && e.key === 'b') {
    e.preventDefault();
    onBold();
  } else if (isMeta && !isShift && e.key === 'i') {
    e.preventDefault();
    onItalic();
  }
  // ... other shortcuts
};

document.addEventListener('keydown', handleKeyDown);
```

**Shortcuts:**
- `Cmd+N` → New document (IPC from menu, triggers `onFileNew`)
- `Cmd+O` → Open dialog (IPC from menu, triggers file picker)
- `Cmd+S` → Save (IPC from menu, triggers `onFileSave`)
- `Cmd+F` → Open find panel (handled in useKeyboardShortcuts)
- `Cmd+B` → Bold (only if Raw/Split mode)
- `Cmd+I` → Italic (only if Raw/Split mode)
- `Cmd+E` → Cycle view mode
- `Cmd+T` → Cycle theme
- `Cmd+Alt+W` → Toggle word wrap
- `Cmd+Z` → Undo
- `Cmd+Shift+Z` or `Cmd+Y` → Redo

**Conflict Prevention:**
- Check view mode before applying formatting shortcuts
- Check if find panel open before Esc key handling
- Prevent default browser behavior (e.g., Cmd+S saving HTML page)

### 10.8 Preference Persistence

**Preferences Saved:**
- `alwaysOnTop`: boolean (window preference)

**Save Flow:**
1. User toggles "Keep on Top" in Window menu
2. Update `appPreferences.alwaysOnTop` variable
3. Apply to all open windows: `win.setAlwaysOnTop(checked)`
4. Call `savePreferences()` (debounced 500ms)
5. Write JSON to `app.getPath('userData')/preferences.json`
6. Rebuild menu to update checkbox state

**Load Flow:**
1. On app launch, before creating first window
2. Read `preferences.json` asynchronously
3. Parse JSON, validate types
4. If file missing or invalid → use defaults
5. Apply when creating windows: `new BrowserWindow({ alwaysOnTop })`

**Recent Files Saved:**
- Array of up to 50 file paths
- Similar debounced save/load as preferences
- File: `app.getPath('userData')/recent-files.json`

---

## 11. Styling System

### 11.1 CSS Custom Properties

**Base Theme (Dark):**
```css
:root {
  --bg-color: #282c34;
  --text-color: #abb2bf;
  --toolbar-bg: #21252b;
  --toolbar-border: #181a1f;
  --editor-bg: #1e1e1e;
  --editor-text: #d4d4d4;
  --btn-hover: #3e4451;
  --btn-active: #3e4451;
}
```

**Light Theme:**
```css
[data-theme='light'] {
  --bg-color: #ffffff;
  --text-color: #333333;
  --toolbar-bg: #f0f0f0;
  --toolbar-border: #e0e0e0;
  --editor-bg: #ffffff;
  --editor-text: #333333;
  --btn-hover: #e0e0e0;
  --btn-active: #d0d0d0;
}
```

**Solarized Light:**
```css
[data-theme='solarized-light'] {
  --bg-color: #fdf6e3;
  --text-color: #657b83;
  --toolbar-bg: #eee8d5;
  --toolbar-border: #93a1a1;
  /* ... */
}
```

**Solarized Dark:**
```css
[data-theme='solarized-dark'] {
  --bg-color: #002b36;
  --text-color: #839496;
  /* ... */
}
```

### 11.2 Syntax Highlighting Colors

**Each theme has 20+ syntax highlighting variables:**
- `--hljs-bg`: Code block background
- `--hljs-color`: Default text color
- `--hljs-keyword`: Keywords (if, else, function)
- `--hljs-built-in`: Built-in types (String, Number)
- `--hljs-string`: String literals
- `--hljs-comment`: Comments
- `--hljs-function`: Function names
- `--hljs-variable`: Variable names
- ... etc.

**Applied via highlight.js classes:**
```css
.hljs-keyword { color: var(--hljs-keyword); }
.hljs-string { color: var(--hljs-string); }
```

### 11.3 Layout Measurements

**Fixed Heights:**
- Tab bar: 35px
- Toolbar: 50px
- Status bar: 25px
- Content area: `flex: 1` (fills remaining space)

**Padding:**
- Markdown preview: 20px left, 60px right, 20px top/bottom
- Code editor: 20px left, 80px right, 20px top/bottom
- Toolbar: 0px vertical, 20px horizontal

**Button Sizes:**
- Icon buttons: 24px × 24px
- Padding: 6px
- Toggle buttons: auto width, 5px vertical padding, 15px horizontal

**Font Sizes:**
- Toolbar buttons: 12px
- Status bar: 12px
- Code editor: 14px, line-height 1.5
- Markdown preview: 16px (base), headings scaled accordingly

### 11.4 Transitions

**All color transitions:** 0.3s
**Button hover:** 0.2s
**Panel animations:** 0.15s ease-in

**Example:**
```css
.icon-btn {
  transition: all 0.2s;
}

body {
  transition: background-color 0.3s, color 0.3s;
}
```

### 11.5 Responsive Behavior

**No Mobile Support:** Desktop-only app (800×600 minimum)

**Window Resize:**
- Flexbox layout adapts automatically
- Split view divider percentage remains constant
- Scroll indicators recalculate on resize (ResizeObserver)

### 11.6 Accessibility Features

**Focus Indicators:**
```css
*:focus-visible {
  outline: 2px solid #268bd2;
  outline-offset: 2px;
}
```

**Skip Links:** Not implemented (single-page app with keyboard shortcuts)

**ARIA Labels:**
- All interactive elements have `aria-label` or visible text
- Toolbar buttons have `role` and `aria-expanded` (for dropdowns)
- Tab bar has `role="tablist"`, tabs have `role="tab"`
- Content area has `role="tabpanel"`

**Keyboard Navigation:**
- All buttons focusable via Tab
- Enter/Space activate buttons
- Arrow keys in find panel (↑↓)
- Custom shortcuts documented

**Color Contrast:**
- Light theme: 7:1 (AAA level)
- Dark theme: 7:1 (AAA level)
- Solarized themes: Designed by Ethan Schoonover for readability

### 11.7 macOS-Specific Styling

**Titlebar:**
- Native macOS titlebar with traffic lights
- Toolbar has `-webkit-app-region: drag` to allow window dragging

**Scrollbars:**
- macOS native scrollbars (hidden when not scrolling)
- Custom scroll indicator in code editor (always visible)

**Context Menus:**
- Custom styling to match Electron theme
- Not using native macOS menus (for consistency)

### 11.8 Print Styles

**Not Implemented:** No `@media print` styles

**Workaround:** Use PDF export for printing

---

## 12. Implementation Checklist

To rebuild mdviewer from scratch, implement in this order:

### Phase 1: Foundation (Days 1-3)
- [ ] Set up project structure with Electron Forge + Vite
- [ ] Configure TypeScript with separate configs for main/preload/renderer
- [ ] Create basic main process with BrowserWindow
- [ ] Create preload script with contextBridge
- [ ] Create React renderer with basic App component
- [ ] Implement theme system with CSS custom properties

### Phase 2: Core UI (Days 4-7)
- [ ] Build tab bar with add/close functionality
- [ ] Build toolbar with button groups
- [ ] Build status bar with word/char/token counts
- [ ] Implement view mode toggle (Rendered/Raw/Split/Text)
- [ ] Create CodeEditor component with textarea
- [ ] Create MarkdownPreview component with react-markdown

### Phase 3: Document Management (Days 8-10)
- [ ] Implement useDocuments hook with multi-tab state
- [ ] Add file opening via IPC (main reads, sends to renderer)
- [ ] Add file saving with multi-format support (MD/PDF/TXT)
- [ ] Implement dirty state tracking
- [ ] Add unsaved changes prompts
- [ ] Implement undo/redo system

### Phase 4: Advanced Features (Days 11-14)
- [ ] Build Find & Replace panel with dragging
- [ ] Implement search highlighting in all view modes
- [ ] Add text formatting toolbar (bold, italic, headings, etc.)
- [ ] Implement keyboard shortcuts system
- [ ] Add error notification toast system
- [ ] Implement word wrap toggle

### Phase 5: Security (Days 15-17)
- [ ] Add input validation (paths, URLs, content)
- [ ] Implement rate limiting for IPC handlers
- [ ] Add file content integrity validation
- [ ] Implement clipboard sanitization
- [ ] Add origin validation for IPC calls
- [ ] Configure CSP and sandbox

### Phase 6: Polish (Days 18-21)
- [ ] Add recent files menu (50 items, persistence)
- [ ] Implement always-on-top preference
- [ ] Add context menus (tab, text)
- [ ] Implement image embedding (drag-and-drop)
- [ ] Add relative image path rendering
- [ ] Implement inline text editing in preview

### Phase 7: Build & Test (Days 22-25)
- [ ] Configure Electron Forge makers for all platforms
- [ ] Set up Electron Fuses for security
- [ ] Configure macOS file associations
- [ ] Write unit tests for utilities and hooks
- [ ] Write component tests for UI elements
- [ ] Set up Vitest coverage reporting

### Phase 8: Documentation (Days 26-28)
- [ ] Write README with installation instructions
- [ ] Create CHANGELOG with version history
- [ ] Document keyboard shortcuts
- [ ] Add accessibility documentation
- [ ] Write developer guide (CLAUDE.md)

**Total Estimated Time:** 28 working days (5.6 weeks) for one developer

---

## Appendix A: Complete IPC Channel Reference

| Channel | Direction | Data Type | Returns | Purpose |
|---------|-----------|-----------|---------|---------|
| `file-open` | Main → Renderer | `FileOpenData` | void | Send file content to renderer |
| `file-new` | Main → Renderer | void | void | Trigger new document creation |
| `file-save` | Main → Renderer | void | void | Trigger save operation |
| `save-all-and-quit` | Main → Renderer | void | void | Save all dirty docs then quit |
| `format-text` | Main → Renderer | `string` (format) | void | Apply text formatting |
| `toggle-word-wrap` | Main → Renderer | void | void | Toggle word wrap state |
| `request-unsaved-docs` | Main → Renderer | void | `string[]` | Request list of unsaved docs |
| `unsaved-docs-response` | Renderer → Main | `string[]` | void | Send list of unsaved docs |
| `create-window-for-tab` | Renderer → Main | `{filePath, content}` | `{success}` | Create new window for tab |
| `tab-dropped` | Renderer → Main | `{dragId}` | `boolean` | Notify tab was dropped |
| `check-tab-dropped` | Renderer → Main | `{dragId}` | `boolean` | Check if tab was dropped |
| `close-window` | Renderer → Main | void | void | Close current window |
| `open-external-url` | Renderer → Main | `{url}` | void | Open URL in browser |
| `export-pdf` | Renderer → Main | `{content, filename}` | `{success, filePath?, error?}` | Export as PDF |
| `save-file` | Renderer → Main | `{content, filename, filePath}` | `{success, filePath?, error?}` | Save file |
| `read-file` | Renderer → Main | `{filePath}` | `{content, error?}` | Read file content |
| `show-unsaved-dialog` | Renderer → Main | `{filename}` | `{response}` | Show unsaved changes dialog |
| `reveal-in-finder` | Renderer → Main | `{filePath}` | `{success, error?}` | Reveal file in Finder |
| `read-image-file` | Renderer → Main | `{imagePath, markdownFilePath}` | `{dataUri?, error?}` | Read image as data URI |
| `copy-image-to-document` | Renderer → Main | `{imagePath, markdownFilePath}` | `{relativePath?, error?}` | Copy image to images/ dir |

---

## Appendix B: Complete Keyboard Shortcut Reference

| Shortcut | Action | Context | Implementation |
|----------|--------|---------|---------------|
| `Cmd+N` | New document | Global | Menu → IPC → `onFileNew` |
| `Cmd+O` | Open file dialog | Global | Menu → Dialog → `openFile()` |
| `Cmd+S` | Save file | Global | Menu → IPC → `onFileSave` |
| `Cmd+F` | Open find panel | Global | `useKeyboardShortcuts` |
| `Cmd+B` | Bold | Raw/Split only | `useKeyboardShortcuts` → `handleFormat('bold')` |
| `Cmd+I` | Italic | Raw/Split only | `useKeyboardShortcuts` → `handleFormat('italic')` |
| `Cmd+E` | Cycle view mode | Global | `useKeyboardShortcuts` → cycle state |
| `Cmd+T` | Cycle theme | Global | `useKeyboardShortcuts` → `handleThemeToggle()` |
| `Cmd+Alt+W` | Toggle word wrap | Global | Menu or `useKeyboardShortcuts` |
| `Cmd+Z` | Undo | Global | `useKeyboardShortcuts` → `undo()` |
| `Cmd+Shift+Z` | Redo | Global | `useKeyboardShortcuts` → `redo()` |
| `Cmd+Y` | Redo (alternate) | Global | `useKeyboardShortcuts` → `redo()` |
| `Enter` | Next match | Find panel open | FindReplace component |
| `Shift+Enter` | Previous match | Find panel open | FindReplace component |
| `Esc` | Close find panel | Find panel open | FindReplace component |

---

## Appendix C: Complete Type Definitions

See `src/types/` directory for authoritative source. Key types:

```typescript
// Document
interface Document {
  id: string;
  name: string;
  content: string;
  filePath: string | null;
  dirty?: boolean;
  lastSavedContent?: string;
}

// Error
interface ErrorItem {
  id: number;
  message: string;
  type: 'error' | 'warning' | 'info';
}

// IPC Message (discriminated union)
type IPCMessage =
  | { channel: 'file-open'; data: FileOpenData }
  | { channel: 'save-file'; data: SaveFileData }
  | ... // 18 total message types

// ElectronAPI (exposed to renderer)
interface ElectronAPI {
  onFileOpen: (callback: (data: FileOpenData) => void) => () => void;
  saveFile: (data: SaveFileData) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  // ... 22 total methods
}
```

---

**End of Product Requirements Document**

This PRD provides complete specifications to rebuild mdviewer. For questions or clarifications, refer to:
- Source code in `/Users/true/dev/mdviewer/src/`
- CLAUDE.md for development guidelines
- CHANGELOG.md for feature evolution history
