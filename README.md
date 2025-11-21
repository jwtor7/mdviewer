# Markdown Viewer

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Electron](https://img.shields.io/badge/electron-latest-blueviolet)

A convenient, offline-capable Markdown Viewer for macOS built with Electron.

## Features
- **Instant Rendering**: View Markdown files as they are meant to be seen with GitHub Flavored Markdown.
- **Code View**: Toggle between rendered HTML and raw Markdown source.
- **Syntax Highlighting**: Beautiful code block highlighting.
- **Offline**: Runs 100% locally without internet access.
- **Secure**: Sandboxed environment with strict Content Security Policy.

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/jwtor7/mdviewer.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the app:
   ```bash
   npm start
   ```

## Usage
- Drag and drop a `.md` file onto the app.
- Use the toggle in the top bar to switch between Preview and Code modes.

---

## Changelog

### [1.2.1] - 2025-11-21
- Fixed application title in window.
- Improved macOS file association configuration.
- Fixed React mounting issue in renderer.

### [1.2.0] - 2025-11-21
- Implemented native file handling (open with...).
- Added file associations for `.md` files.
- Enabled drag-and-drop support on app icon.

### [1.1.0] - 2025-11-21
- **Toolbar**:
    - Copy to Clipboard: Copies Markdown source in Code view, and Rich Text (HTML) in Preview view.
    - Theme Toggle: Switch between Light, Dark, and System themes.
    - Formatting Buttons: Bold, Italic, and List buttons (Code view only).
- **Status Bar**: Real-time Word, Character, and Token counts.
- **UI**: Improved layout with visible toolbar in all views.
- **Core**:
    - Preview/Code toggle.
    - GFM support.
    - Syntax highlighting.

### [1.0.0] - 2025-11-21
- Initial release.
- Basic Markdown rendering.
- Code/Preview toggle.

## Upcoming Features

- [ ] **Export to HTML/PDF**: Save your rendered markdown as a standalone HTML file or PDF document.
- [ ] **Auto-Save**: Automatically save changes to the open file.
- [ ] **Split View**: View code and preview side-by-side.
- [ ] **Custom CSS**: Load your own CSS file to customize the preview.
- [ ] **Vim Mode**: Keybindings for Vim users in the code editor.
