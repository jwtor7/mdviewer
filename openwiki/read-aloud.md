# Read Aloud (TTS)

mdviewer's Read Aloud feature narrates Markdown documents using a local neural TTS engine (Kokoro-82M) with automatic fallback to the macOS `say` command.

## Architecture Overview

```
Renderer (useTextToSpeech)  ──IPC──►  Main Process (tts/index.ts dispatcher)
                                           ├── kokoroEngine.ts (primary)
                                           └── sayEngine.ts (fallback)
```

The renderer hook `useTextToSpeech` drives the UX; the main-process dispatcher (`src/main/tts/index.ts`) selects the engine and manages lifecycle.

## TTS Engines

### Kokoro Neural Engine (Primary)

**Source:** `src/main/tts/kokoroEngine.ts`

- Uses the [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro) ONNX model
- Voice: `af_heart` (label: "Heart (Kokoro)") — the single fixed voice mdviewer ships
- Drives a **persistent Python worker** (`resources/tts/kokoro_worker.py`) that loads the model once and synthesizes WAV segments on request
- Playback goes through `afplay` with SIGSTOP/SIGCONT pause semantics (same as the say engine)
- Text travels as a JSON field — never argv, never shell — preserving injection-safe piping
- Availability is **probed lazily**: the first speak spawns the worker and waits for a ready handshake (30s timeout)
- Missing pieces (python3, worker script, model files) raise `KokoroUnavailableError`
- Worker crash mid-session raises `KokoroWorkerCrashedError` and **disables the engine until app relaunch** (no auto-restart in v1)

**Python worker protocol** (JSON-lines over stdin/stdout):

```
stdin  →  {"id": 1, "type": "synth", "text": "...", "voice": "af_heart",
           "speed": 1.0, "outPath": "/tmp/seg-1.wav"}
          {"type": "shutdown"}
stdout ←  {"type": "ready", "version": 1}
          {"id": 1, "type": "result", "wavPath": "...", "durationSeconds": 1.23, "sampleRate": 24000}
          {"id": 1, "type": "error", "error": "..."}
          {"type": "fatal", "error": "..."}  (then non-zero exit)
```

The worker script is placed outside `app.asar` at `Contents/Resources/tts/` (via `extraResource` in `forge.config.js`) so `python3` can execute it.

### macOS `say` Engine (Fallback)

**Source:** `src/main/tts/sayEngine.ts`

- Shells out to the native macOS `say` command
- Uses the user's saved voice preference (Kokoro ships a fixed voice, so preferences only apply on the `say` path)
- Pause via SIGSTOP/SIGCONT on the `say`/`afplay` process
- Always available on macOS — no installation required

## Dispatcher Logic

**Source:** `src/main/tts/index.ts`

The dispatcher manages engine selection and failover:

1. **Default engine:** Kokoro
2. **First failed Kokoro attempt** disables the engine for the rest of the session (no flapping)
3. Fires a one-time `tts:engine-changed` notification so the renderer can toast
4. Every subsequent utterance goes straight to `say`
5. **Dispatch generation:** A counter bumped on every `startSpeech`/`stopSpeech`. A late Kokoro failure observed under a stale generation is silently dropped (the user already stopped or restarted — falling back to `say` would start speaking out of nowhere)
6. **End-callback ownership:** Each engine forwards its end events only while it owns the current utterance, so a late exit from the other engine can't advance the renderer's sentence loop

**IPC channels:** `tts:speak`, `tts:stop`, `tts:pause`, `tts:resume`, `tts:list-voices`, `tts:ended` (event), `tts:engine-status`, `tts:engine-changed` (event)

## Markdown-to-Speech Pipeline

Before text reaches the TTS engine, it goes through a speech-optimized conversion pipeline:

### 1. Markdown → Speech Prose

**Source:** `src/utils/markdownToSpeech.ts`

Uses `unified` + `remark-parse` + `remark-gfm` to parse Markdown, then converts to speech-friendly prose:
- Strips frontmatter
- Strips URL link text (keeps display text, drops URLs)
- Strips code block contents (would be read as noise)
- Strips ASCII table formatting (converts small tables to prose, skips large ones)
- Renders images as "Image: [alt text]."
- Maximum 100,000 characters (truncates with suffix)

### 2. Speech Chunking

**Source:** `src/utils/speechChunker.ts`

Splits the prose into sentence-sized chunks for sequential playback:
- Sentence boundary detection
- Prefetch: the next sentence is sent as `nextText` so Kokoro can synthesize it while the current one plays (gapless playback)
- Chapter navigation via `src/utils/chapterExtraction.ts` (detects headings)

### 3. Speaking Highlight

**Source:** `src/utils/rehypeSpeakingHighlight.ts`

A custom rehype plugin that highlights the active paragraph in Rendered view during narration, so the user can follow along visually.

## Renderer Hook

**Source:** `src/hooks/useTextToSpeech.ts` (~19K)

The `useTextToSpeech` hook manages the full narration lifecycle:

- **Start/stop/pause/resume** via IPC to the main-process dispatcher
- **Sentence prefetch** — sends `nextText` ahead for gapless Kokoro playback
- **Sentence navigation** — `Cmd+Shift+→` / `Cmd+Shift+←` for next/previous sentence
- **Chapter navigation** — `Cmd+Shift+]` / `Cmd+Shift+[` for next/previous chapter
- **Read from cursor** — `Cmd+Alt+Shift+R` starts reading from the cursor position (Rendered-view reading anchor)
- **Per-tab scoping** — each tab has its own speech state
- **Engine status** — subscribes to `tts:engine-changed` to update the UI when Kokoro falls back to `say`

### TTS Preferences

**Source:** `src/hooks/useTTSPreferences.ts`

Persists rate (speed) and voice preferences. Rate bounds defined in `TTS_RATE_BOUNDS`. Voice preference only applies on the `say` path (Kokoro has a fixed voice).

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+R` | Start / pause / resume reading |
| `Cmd+Shift+.` | Stop reading |
| `Cmd+Shift+→` / `Cmd+Shift+←` | Next / previous sentence |
| `Cmd+Shift+]` / `Cmd+Shift+[` | Next / previous chapter |
| `Cmd+Alt+Shift+R` | Read from cursor |

## Key Source Files

| File | Role |
|------|------|
| `src/main/tts/index.ts` | Dispatcher — engine selection, failover, generation tracking |
| `src/main/tts/kokoroEngine.ts` | Kokoro neural engine — Python worker management, WAV playback |
| `src/main/tts/sayEngine.ts` | macOS `say` engine — process spawning, pause via signals |
| `src/main/tts/types.ts` | Shared types: `EndReason`, `StartSpeechOptions`, `TTSVoice`, `TTSEngineStatus` |
| `resources/tts/kokoro_worker.py` | Python worker — loads ONNX model, synthesizes WAV on request |
| `src/hooks/useTextToSpeech.ts` | Renderer hook — narration lifecycle, prefetch, nav |
| `src/hooks/useTTSPreferences.ts` | Rate/voice preference persistence |
| `src/utils/markdownToSpeech.ts` | Markdown → speech prose (strips URLs, code, tables) |
| `src/utils/speechChunker.ts` | Sentence chunking for sequential playback |
| `src/utils/chapterExtraction.ts` | Heading detection for chapter navigation |
| `src/utils/rehypeSpeakingHighlight.ts` | Rehype plugin for active-paragraph highlight |
| `src/components/ReadAloudMenu.tsx` | TTS UI controls |
