/* eslint-disable security/detect-non-literal-fs-filename -- all paths are app-derived (resourcesPath, userData, temp), never renderer input */
/**
 * Kokoro Neural TTS Engine
 *
 * Drives a persistent Python worker (resources/tts/kokoro_worker.py) that
 * loads the Kokoro-82M ONNX model once and synthesizes WAV segments on
 * request over a JSON-lines stdin/stdout protocol. Playback goes through
 * `afplay` with the same SIGSTOP/SIGCONT pause semantics as the say engine.
 *
 * Text travels as a JSON field — never argv, never shell — preserving the
 * injection posture of the say engine's stdin piping.
 *
 * Availability is probed lazily: the first speak (or status probe) spawns
 * the worker and waits for its ready handshake. Any missing piece (python3,
 * worker script, model files) raises KokoroUnavailableError so the
 * dispatcher can fall back to `say`. A worker crash mid-session raises
 * KokoroWorkerCrashedError and disables the engine until app relaunch —
 * no auto-restart in v1.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { EndCallback, EndReason } from './types.js';

export class KokoroUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KokoroUnavailableError';
  }
}

export class KokoroWorkerCrashedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KokoroWorkerCrashedError';
  }
}

/** The single voice mdviewer ships with. The renderer never sends a voice. */
export const KOKORO_VOICE = 'af_heart';

/** Human-readable label for the UI. */
export const KOKORO_VOICE_LABEL = 'Heart (Kokoro)';

const READY_TIMEOUT_MS = 30_000;
const SYNTH_TIMEOUT_MS = 120_000;

const MODEL_FILE = 'kokoro-v1.0.onnx';
const VOICES_FILE = 'voices-v1.0.bin';

/**
 * Map the renderer's words-per-minute rate to Kokoro's speed multiplier.
 * Kokoro speed 1.0 is ~180 wpm natural narration; the app's default 200 wpm
 * maps to 1.11 — slightly brisk, matching the current `say` feel.
 */
export const wpmToKokoroSpeed = (wpm?: number): number => {
  const speed = (typeof wpm === 'number' && Number.isFinite(wpm) ? wpm : 200) / 180;
  return Math.min(2.0, Math.max(0.5, speed));
};

export interface KokoroSpeakOptions {
  text: string;
  speed: number;
  /** Next sentence to pre-synthesize while this one plays. */
  nextText?: string;
}

// ---------------------------------------------------------------------------
// Path resolution (markitdown.ts pattern)
// ---------------------------------------------------------------------------

const resolveWorkerScript = (): string | null => {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'tts', 'kokoro_worker.py')]
    : [
        path.join(app.getAppPath(), 'resources', 'tts', 'kokoro_worker.py'),
        path.join(process.cwd(), 'resources', 'tts', 'kokoro_worker.py'),
      ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      // ignore and try next
    }
  }
  return null;
};

const resolvePython = (): string => {
  for (const c of ['/opt/homebrew/bin/python3', '/usr/local/bin/python3']) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      // ignore and try next
    }
  }
  // Bare python3 resolved through the child's augmented PATH.
  return 'python3';
};

const buildChildPath = (): string => {
  const extras = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
  const existing = process.env.PATH ?? '';
  return existing ? `${existing}:${extras.join(':')}` : extras.join(':');
};

interface ModelPaths {
  model: string;
  voices: string;
}

const findModelInDir = (dir: string): ModelPaths | null => {
  const modelCandidates = [path.join(dir, 'models', MODEL_FILE), path.join(dir, MODEL_FILE)];
  const voicesCandidates = [path.join(dir, 'voices', VOICES_FILE), path.join(dir, VOICES_FILE)];
  let model: string | null = null;
  let voices: string | null = null;
  try {
    model = modelCandidates.find((c) => fs.existsSync(c)) ?? null;
    voices = voicesCandidates.find((c) => fs.existsSync(c)) ?? null;
  } catch {
    return null;
  }
  return model && voices ? { model, voices } : null;
};

const resolveModelPaths = (): ModelPaths | null => {
  const home = process.env.HOME ?? '';
  const candidates = [
    process.env.MDVIEWER_KOKORO_DIR,
    path.join(home, '.cache', 'hyperframes', 'tts'),
    path.join(app.getPath('userData'), 'kokoro'),
  ].filter((d): d is string => typeof d === 'string' && d.length > 0);
  for (const dir of candidates) {
    const found = findModelInDir(dir);
    if (found) return found;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Worker lifecycle
// ---------------------------------------------------------------------------

interface PendingRequest {
  resolve: (wavPath: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let worker: ChildProcess | null = null;
let workerReady: Promise<void> | null = null;
let workerFailed: Error | null = null;
let nextRequestId = 1;
const pendingRequests = new Map<number, PendingRequest>();
let stdoutBuffer = '';

const getTempDir = (): string => path.join(app.getPath('temp'), 'mdviewer-tts');

const tryUnlink = (filePath: string | null): void => {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    // already gone or never written — fine
  }
};

const wipeTempDir = (): void => {
  const dir = getTempDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const entry of fs.readdirSync(dir)) {
      tryUnlink(path.join(dir, entry));
    }
  } catch (err) {
    console.error('[kokoro] failed to prepare temp dir:', err);
  }
};

const rejectAllPending = (err: Error): void => {
  for (const [, req] of pendingRequests) {
    clearTimeout(req.timer);
    req.reject(err);
  }
  pendingRequests.clear();
};

const handleWorkerLine = (line: string): void => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg: { type?: string; id?: number; wavPath?: string; error?: string };
  try {
    msg = JSON.parse(trimmed);
  } catch {
    // onnxruntime occasionally prints diagnostics to stdout — ignore.
    return;
  }
  if (msg.type === 'result' || msg.type === 'error') {
    const req = typeof msg.id === 'number' ? pendingRequests.get(msg.id) : undefined;
    if (!req) return;
    pendingRequests.delete(msg.id as number);
    clearTimeout(req.timer);
    if (msg.type === 'result' && typeof msg.wavPath === 'string') {
      req.resolve(msg.wavPath);
    } else {
      req.reject(new Error(msg.error ?? 'Kokoro synthesis failed'));
    }
  }
  // 'ready' and 'fatal' are consumed by the ensureWorker handshake listener.
};

const spawnWorker = (): Promise<void> => {
  const script = resolveWorkerScript();
  if (!script) {
    throw new KokoroUnavailableError('Kokoro worker script not found');
  }
  const modelPaths = resolveModelPaths();
  if (!modelPaths) {
    throw new KokoroUnavailableError('Kokoro model files not found');
  }
  const python = resolvePython();

  wipeTempDir();

  let child: ChildProcess;
  try {
    child = spawn(python, [script, '--model', modelPaths.model, '--voices', modelPaths.voices], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PATH: buildChildPath() },
    });
  } catch (err) {
    throw new KokoroUnavailableError(`Failed to spawn Kokoro worker: ${(err as Error).message}`);
  }

  worker = child;
  stdoutBuffer = '';

  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (chunk: string) => {
    console.warn('[kokoro worker]', chunk.trimEnd());
  });

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const readyTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const err = new KokoroUnavailableError('Kokoro worker did not become ready within 30s');
      workerFailed = err;
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
      reject(err);
    }, READY_TIMEOUT_MS);

    child.stdout?.on('data', (chunk: string) => {
      stdoutBuffer += chunk;
      let newlineIdx = stdoutBuffer.indexOf('\n');
      while (newlineIdx >= 0) {
        const line = stdoutBuffer.slice(0, newlineIdx);
        stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1);
        if (!settled) {
          let msg: { type?: string; error?: string } | null = null;
          try {
            msg = JSON.parse(line.trim());
          } catch {
            msg = null;
          }
          if (msg?.type === 'ready') {
            settled = true;
            clearTimeout(readyTimer);
            resolve();
          } else if (msg?.type === 'fatal') {
            settled = true;
            clearTimeout(readyTimer);
            const err = new KokoroUnavailableError(msg.error ?? 'Kokoro worker failed to load model');
            workerFailed = err;
            reject(err);
          }
        } else {
          handleWorkerLine(line);
        }
        newlineIdx = stdoutBuffer.indexOf('\n');
      }
    });

    child.on('error', (err) => {
      const wrapped = new KokoroUnavailableError(`Kokoro worker error: ${err.message}`);
      if (!settled) {
        settled = true;
        clearTimeout(readyTimer);
        workerFailed = wrapped;
        reject(wrapped);
      }
      if (worker === child) worker = null;
      rejectAllPending(wrapped);
    });

    child.on('exit', (code, signal) => {
      if (worker === child) worker = null;
      const crash = new KokoroWorkerCrashedError(
        `Kokoro worker exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`
      );
      if (!settled) {
        settled = true;
        clearTimeout(readyTimer);
        const err = new KokoroUnavailableError(crash.message);
        workerFailed = err;
        reject(err);
        return;
      }
      if (!shuttingDown) {
        workerFailed = crash;
        rejectAllPending(crash);
      }
    });
  });
};

let shuttingDown = false;

/**
 * Lazily spawn the worker and wait for its ready handshake. Memoized: the
 * probe IS the startup — on success the worker stays warm all session.
 */
const ensureWorker = (): Promise<void> => {
  if (workerFailed) return Promise.reject(workerFailed);
  if (workerReady) return workerReady;
  try {
    workerReady = spawnWorker();
  } catch (err) {
    workerFailed = err as Error;
    workerReady = null;
    return Promise.reject(err);
  }
  // Clear the memo on failure so a relaunch isn't required just because the
  // failure path already recorded workerFailed (which gates retries anyway).
  workerReady.catch(() => {
    workerReady = null;
  });
  return workerReady;
};

const sendSynthRequest = (text: string, speed: number): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    if (!worker || !worker.stdin || !worker.stdin.writable) {
      reject(workerFailed ?? new KokoroWorkerCrashedError('Kokoro worker is not running'));
      return;
    }
    const id = nextRequestId++;
    const outPath = path.join(getTempDir(), `seg-${id}.wav`);
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Kokoro synthesis timed out'));
    }, SYNTH_TIMEOUT_MS);
    pendingRequests.set(id, { resolve, reject, timer });
    const request = JSON.stringify({ id, type: 'synth', text, voice: KOKORO_VOICE, speed, outPath });
    try {
      worker.stdin.write(`${request}\n`);
    } catch (err) {
      pendingRequests.delete(id);
      clearTimeout(timer);
      reject(new KokoroWorkerCrashedError(`Failed to write to Kokoro worker: ${(err as Error).message}`));
    }
  });
};

// ---------------------------------------------------------------------------
// Playback state machine
// ---------------------------------------------------------------------------

// Incremented by stop and each new speak — any await that resumes with a
// stale generation discards its work (unlinks the wav, fires no callback).
let generation = 0;
let afplayProc: ChildProcess | null = null;
let currentWav: string | null = null;
let isPaused = false;
// Pause arrived while synthesis was in flight: hold the wav instead of
// playing it ('paused-pending'); resume plays it; stop unlinks it.
let pauseRequestedDuringSynth = false;
let heldWav: string | null = null;
let endCallback: EndCallback | null = null;

// One-slot prefetch cache: while a sentence plays, the next one is
// synthesized in the background so sentence boundaries don't pay the
// 0.5–3 s synthesis latency. A rate change invalidates implicitly via the
// key; stop clears it.
let prefetchEntry: { key: string; wavPath: string } | null = null;
let prefetchInFlight: { key: string; promise: Promise<void> } | null = null;

const prefetchKey = (text: string, speed: number): string => `${speed}|${text}`;

const clearPrefetch = (): void => {
  if (prefetchEntry) {
    tryUnlink(prefetchEntry.wavPath);
    prefetchEntry = null;
  }
  // A late in-flight resolution sees the mismatch and unlinks its own wav.
  prefetchInFlight = null;
};

const startPrefetch = (text: string, speed: number): void => {
  const key = prefetchKey(text, speed);
  if (prefetchEntry?.key === key || prefetchInFlight?.key === key) return;
  if (prefetchEntry) {
    tryUnlink(prefetchEntry.wavPath);
    prefetchEntry = null;
  }
  const promise = sendSynthRequest(text, speed)
    .then((wavPath) => {
      if (prefetchInFlight?.key !== key) {
        // Cleared (stop) or superseded while synthesizing — discard.
        tryUnlink(wavPath);
        return;
      }
      prefetchEntry = { key, wavPath };
    })
    .catch(() => {
      // Prefetch failures are silent — the real synth will surface errors.
    })
    .finally(() => {
      if (prefetchInFlight?.key === key) prefetchInFlight = null;
    });
  prefetchInFlight = { key, promise };
};

const fireEnd = (reason: EndReason): void => {
  const cb = endCallback;
  if (cb) {
    try {
      cb(reason);
    } catch (err) {
      console.error('Kokoro end callback threw:', err);
    }
  }
};

/**
 * Register a callback invoked when the active utterance finishes.
 * Replaces any previously registered callback.
 */
export const setSpeechEndCallback = (callback: EndCallback | null): void => {
  endCallback = callback;
};

const stopPlayback = (): void => {
  if (!afplayProc) return;
  const proc = afplayProc;
  const wasPaused = isPaused;
  afplayProc = null;
  isPaused = false;
  const wav = currentWav;
  currentWav = null;
  try {
    // SIGTERM queues on stopped processes until SIGCONT, so resume first.
    if (wasPaused) proc.kill('SIGCONT');
    proc.kill('SIGTERM');
  } catch (err) {
    console.error('[kokoro] failed to stop afplay:', err);
  }
  tryUnlink(wav);
};

const playWav = (wavPath: string, gen: number): void => {
  const proc = spawn('afplay', [wavPath], { stdio: 'ignore' });
  afplayProc = proc;
  currentWav = wavPath;
  isPaused = false;

  proc.on('error', (err) => {
    console.error('[kokoro] afplay error:', err);
    if (afplayProc !== proc) return;
    afplayProc = null;
    currentWav = null;
    tryUnlink(wavPath);
    if (gen === generation) fireEnd('error');
  });

  proc.on('exit', (code) => {
    if (afplayProc !== proc) {
      // Replaced or stopped — the stopper already handled cleanup and the
      // caller doesn't want a spurious "ended" event.
      return;
    }
    afplayProc = null;
    currentWav = null;
    isPaused = false;
    tryUnlink(wavPath);
    if (gen !== generation) return;
    fireEnd(code === 0 ? 'natural' : 'error');
  });
};

/**
 * Synthesize and play one utterance. Resolves once afplay has spawned (or
 * the utterance was stopped/paused mid-synthesis); rejects on synth or
 * worker failure so the dispatcher can fall back to `say`.
 */
export const speak = async ({ text, speed, nextText }: KokoroSpeakOptions): Promise<void> => {
  // Replace any current utterance without firing the end callback.
  stopPlayback();
  tryUnlink(heldWav);
  heldWav = null;
  pauseRequestedDuringSynth = false;
  generation += 1;
  const gen = generation;

  const key = prefetchKey(text, speed);
  let wavPath: string | null = null;

  // Prefetch cache: exact hit plays immediately; an in-flight prefetch for
  // this text is awaited rather than re-synthesized.
  if (prefetchEntry && prefetchEntry.key === key) {
    wavPath = prefetchEntry.wavPath;
    prefetchEntry = null;
  } else if (prefetchInFlight && prefetchInFlight.key === key) {
    await prefetchInFlight.promise;
    if (gen !== generation) return; // stopped while waiting on the prefetch
    const entry = prefetchEntry as { key: string; wavPath: string } | null;
    if (entry && entry.key === key) {
      wavPath = entry.wavPath;
      prefetchEntry = null;
    }
  }

  if (!wavPath) {
    // Cache miss — a stale entry for different text is dead weight.
    if (prefetchEntry) {
      tryUnlink(prefetchEntry.wavPath);
      prefetchEntry = null;
    }
    await ensureWorker();
    if (gen !== generation) return; // stopped while the worker was warming up

    wavPath = await sendSynthRequest(text, speed);

    if (gen !== generation) {
      // Stopped (or replaced) while synthesizing — discard the late result.
      tryUnlink(wavPath);
      return;
    }
  }

  if (pauseRequestedDuringSynth) {
    pauseRequestedDuringSynth = false;
    heldWav = wavPath; // paused-pending: resume will play it
  } else {
    playWav(wavPath, gen);
  }

  if (typeof nextText === 'string' && nextText.trim().length > 0) {
    startPrefetch(nextText, speed);
  }
};

/**
 * Stop the current utterance: kills playback, abandons any in-flight
 * synthesis (the worker is never killed to cancel a synth — the result is
 * discarded on arrival), and unlinks a held wav. Fires no end callback.
 */
export const stopSpeech = (): void => {
  generation += 1;
  pauseRequestedDuringSynth = false;
  tryUnlink(heldWav);
  heldWav = null;
  clearPrefetch();
  stopPlayback();
};

/**
 * Pause. SIGSTOP is unusable here: it freezes the afplay process but
 * CoreAudio keeps cycling the last queued buffer, producing an audible
 * 3–4× stutter until the audio daemon starves. Instead, pause kills
 * playback and holds the wav; resume replays the sentence from its start
 * (sentences are short, so the rewind is barely noticeable).
 */
export const pauseSpeech = (): void => {
  if (afplayProc) {
    const proc = afplayProc;
    const wav = currentWav;
    afplayProc = null;
    currentWav = null;
    isPaused = false;
    try {
      proc.kill('SIGTERM');
    } catch (err) {
      console.error('[kokoro] failed to pause afplay:', err);
    }
    heldWav = wav; // resume replays this sentence from the start
    return;
  }
  if (heldWav) return; // already paused-pending
  pauseRequestedDuringSynth = true;
};

/**
 * Resume: replay the held wav (set by a pause during playback or during
 * synthesis), or clear a between-sentence pause flag.
 */
export const resumeSpeech = (): void => {
  if (heldWav) {
    const wav = heldWav;
    heldWav = null;
    playWav(wav, generation);
    return;
  }
  pauseRequestedDuringSynth = false;
};

/** Whether the engine has permanently failed this session. */
export const isWorkerFailed = (): boolean => workerFailed !== null;

/**
 * Probe availability: resolves when the worker is warm, rejects with
 * KokoroUnavailableError / KokoroWorkerCrashedError otherwise.
 */
export const probeWorker = (): Promise<void> => ensureWorker();

/**
 * Shutdown/cleanup: stop playback, ask the worker to exit, remove temp WAVs.
 * Does not fire the end callback.
 */
export const cleanupSpeech = (): void => {
  shuttingDown = true;
  generation += 1;
  endCallback = null;
  pauseRequestedDuringSynth = false;
  tryUnlink(heldWav);
  heldWav = null;
  clearPrefetch();
  stopPlayback();
  rejectAllPending(new KokoroWorkerCrashedError('Kokoro engine shutting down'));
  if (worker) {
    const proc = worker;
    worker = null;
    try {
      proc.stdin?.write(`${JSON.stringify({ type: 'shutdown' })}\n`);
      proc.stdin?.end();
    } catch {
      try {
        proc.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
  }
  try {
    fs.rmSync(getTempDir(), { recursive: true, force: true });
  } catch {
    // ignore
  }
};

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Test-only: reset all module state between tests. */
export const __resetForTests = (): void => {
  rejectAllPending(new Error('test reset'));
  worker = null;
  workerReady = null;
  workerFailed = null;
  nextRequestId = 1;
  stdoutBuffer = '';
  generation = 0;
  afplayProc = null;
  currentWav = null;
  isPaused = false;
  pauseRequestedDuringSynth = false;
  heldWav = null;
  endCallback = null;
  shuttingDown = false;
  prefetchEntry = null;
  prefetchInFlight = null;
};

/** Test-only: report playback state. */
export const __getPlaybackState = (): {
  playing: boolean;
  paused: boolean;
  heldWav: string | null;
  pendingCount: number;
} => ({
  playing: afplayProc !== null,
  paused: isPaused || heldWav !== null,
  heldWav,
  pendingCount: pendingRequests.size,
});
