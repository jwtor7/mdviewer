# IPC & Preload

The IPC layer is the single bridge between the sandboxed renderer and the main process. Every channel is Zod-validated, origin-checked, and rate-limited.

## Architecture

```
Renderer (React)  ←contextBridge→  Preload Script  ←IPC→  Main Process
  window.electronAPI                src/preload.ts          src/main.ts
                                                            + src/main/security/ipcValidation.ts
```

The renderer never imports `electron`. All access goes through `window.electronAPI`, which is typed by the `ElectronAPI` interface in `src/types/electron.d.ts`.

## IPC Channel Catalog

### Event Subscribers (main → renderer)

These expose a `callback` subscription pattern. Each returns a cleanup function to remove the listener.

| Method | Channel | Payload | Source |
|--------|---------|---------|--------|
| `onFileOpen` | `file-open` | `FileOpenData` (`filePath`, `content`, `name`, `isConverted?`, `originalFormat?`) | `src/preload.ts` |
| `onFileNew` | `file-new` | — | `src/preload.ts` |
| `onFileSave` | `file-save` | save request | `src/preload.ts` |
| `onSaveAllAndQuit` | `save-all-and-quit` | — | `src/preload.ts` |
| `onFormatText` | `format-text` | format type string | `src/preload.ts` |
| `onToggleWordWrap` | `toggle-word-wrap` | — | `src/preload.ts` |
| `onRequestUnsavedDocs` | `request-unsaved-docs` | sends back via `unsaved-docs-response` | `src/preload.ts` |
| `onCloseTab` | `close-tab` | — | `src/preload.ts` |
| `onFileChanged` | `file-changed` | `{ filePath }` | `src/preload.ts` |
| `onSpeechEnd` | `tts:ended` | — | `src/preload.ts` |
| `onTTSEngineChanged` | `tts:engine-changed` | `{ engine, voiceLabel }` | `src/preload.ts` |

### Invoke Wrappers (renderer → main)

These use `ipcRenderer.invoke` and return `Promise<IPCResult<T>>`.

| Method | Channel | Zod Schema | Source |
|--------|---------|------------|--------|
| `createWindowForTab` | `create-window-for-tab` | `CreateWindowForTabDataSchema` | `src/types/ipc-schemas.ts` |
| `closeWindow` | `close-window` | — (no input) | — |
| `openExternalUrl` | `open-external-url` | `OpenExternalUrlDataSchema` | `src/types/ipc-schemas.ts` |
| `exportPDF` | `export-pdf` | `ExportPdfDataSchema` | `src/types/ipc-schemas.ts` |
| `saveFile` | `save-file` | `SaveFileDataSchema` | `src/types/ipc-schemas.ts` |
| `readFile` | `read-file` | `ReadFileDataSchema` | `src/types/ipc-schemas.ts` |
| `showUnsavedDialog` | `show-unsaved-dialog` | `ShowUnsavedDialogDataSchema` | `src/types/ipc-schemas.ts` |
| `revealInFinder` | `reveal-in-finder` | `RevealInFinderDataSchema` | `src/types/ipc-schemas.ts` |
| `readImageFile` | `read-image-file` | `ReadImageFileDataSchema` | `src/types/ipc-schemas.ts` |
| `copyImageToDocument` | `copy-image-to-document` | `CopyImageToDocumentDataSchema` | `src/types/ipc-schemas.ts` |
| `saveImageFromData` | `save-image-from-data` | `SaveImageFromDataSchema` | `src/types/ipc-schemas.ts` |
| `openMermaidWindow` | `open-mermaid-window` | (mermaid data) | `src/types/ipc-schemas.ts` |
| `openFilePath` | `open-file-path` | `OpenFilePathDataSchema` | `src/types/ipc-schemas.ts` |
| `startSpeech` | `tts:speak` | `StartSpeechDataSchema` | `src/types/ipc-schemas.ts` |
| `stopSpeech` | `tts:stop` | — | — |
| `pauseSpeech` | `tts:pause` | — | — |
| `resumeSpeech` | `tts:resume` | — | — |
| `listVoices` | `tts:list-voices` | — | — |
| `getTTSEngineStatus` | `tts:engine-status` | — | — |

### Send-Only (renderer → main, no response)

| Method | Channel | Payload |
|--------|---------|---------|
| `watchFile` | `watch-file` | `{ filePath }` |
| `unwatchFile` | `unwatch-file` | `{ filePath }` |
| `logDebug` | `log-debug` | `{ message, data? }` |

### Synchronous Bridge

| Method | Purpose |
|--------|---------|
| `getPathForFile` | `webUtils.getPathForFile(file)` — resolves drag-drop `File` objects to absolute paths under sandbox |

## Zod Schema Pattern

Schemas are declarative in `src/types/ipc-schemas.ts`:

```typescript
export const SaveFileDataSchema = z.object({
  content: z.string(),
  filename: z.string().min(1, 'Filename cannot be empty'),
  filePath: z.string().nullable(),
});
export type SaveFileDataInput = z.infer<typeof SaveFileDataSchema>;
```

Main-process handlers consume the inferred `*Input` types. The `withValidatedIPCHandler()` wrapper in `src/main/security/ipcValidation.ts` applies the schema at runtime before the handler runs.

## Type System

| File | Contents |
|------|---------|
| `src/types/electron.d.ts` | `ElectronAPI` interface (the contract preload satisfies via `satisfies ElectronAPI`), `FileOpenData`, `IPCResult<T>`, `IPCMessage` discriminated union |
| `src/types/ipc-schemas.ts` | Zod schemas for every validated channel, inferred `*Input` types |
| `src/types/document.d.ts` | `Document` interface (`id`, `name`, `content`, `filePath`) |

The `IPCMessage` discriminated union provides compile-time safety mapping channels to their payload types.

## How to Add a New IPC Channel

1. **Define the Zod schema** in `src/types/ipc-schemas.ts` (add `*Schema` and `*Input` type).
2. **Add the channel to `IPCMessage`** in `src/types/electron.d.ts`.
3. **Add the method to `ElectronAPI`** interface in `src/types/electron.d.ts`.
4. **Implement in `src/preload.ts`** — either an event subscriber (returning cleanup) or an `ipcRenderer.invoke` wrapper (returning `Promise<IPCResult<T>>`). Use `satisfies ElectronAPI`.
5. **Register the handler in `src/main.ts`** using `withValidatedIPCHandler({ schema, handlerName }, handler)` or `withIPCHandlerNoInput({ handlerName }, handler)`.
6. **Extend the test mock** in `src/test/setup.ts` — the `window.electronAPI` stub must cover the new method.
7. **Write tests** — co-located `*.test.ts` / `*.test.tsx` following the existing pattern.

> ⚠️ When touching IPC, always check both `src/types/ipc-schemas.ts` and `src/types/electron.d.ts` — every channel must be Zod-validated in the main process and typed on the preload bridge.
