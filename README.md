# Markdown Viewer

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
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

### [1.2.0] - 2025-11-21
- Implemented native file handling (open with...).
- Added file associations for `.md` files.
- Enabled drag-and-drop support on app icon.

### [1.1.0] - 2025-11-21
- Added UI with Preview/Code toggle.
- Implemented Markdown rendering with GFM support.
- Added syntax highlighting for code blocks.

### [1.0.0] - 2025-11-21
- Initial release.
- Basic Markdown rendering.
- Code/Preview toggle.
