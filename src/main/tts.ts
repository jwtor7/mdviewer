/**
 * Text-to-Speech Main Process Module
 *
 * Wraps the macOS `say` CLI so the renderer can narrate markdown via IPC.
 * Text is piped through stdin so it never touches argv, eliminating
 * command-injection risk. Only one `say` process is active at a time.
 */

import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';

type SayProcess = ChildProcessByStdio<Writable, null, Readable>;

export interface TTSVoice {
  name: string;
  language: string;
  sampleText: string;
}

let cachedVoices: TTSVoice[] | null = null;

export interface StartSpeechOptions {
  text: string;
  voice?: string;
  rate?: number;
}

type EndCallback = (reason: 'natural' | 'stopped' | 'error') => void;

let sayProcess: SayProcess | null = null;
let endCallback: EndCallback | null = null;
let isPaused = false;

/**
 * Register a callback invoked whenever the active `say` process exits.
 * Replaces any previously registered callback.
 */
export const setSpeechEndCallback = (callback: EndCallback | null): void => {
  endCallback = callback;
};

const teardownProcess = (reason: 'natural' | 'stopped' | 'error'): void => {
  const cb = endCallback;
  sayProcess = null;
  if (cb) {
    try {
      cb(reason);
    } catch (err) {
      console.error('TTS end callback threw:', err);
    }
  }
};

/**
 * Terminate any currently running `say` process.
 * Safe to call when nothing is active.
 */
export const stopSpeech = (): void => {
  if (!sayProcess) return;
  const proc = sayProcess;
  const wasPaused = isPaused;
  sayProcess = null;
  isPaused = false;
  try {
    // SIGTERM queues on stopped processes until SIGCONT, so resume first
    // if the process was paused — otherwise it would linger indefinitely.
    if (wasPaused) proc.kill('SIGCONT');
    proc.kill('SIGTERM');
  } catch (err) {
    console.error('Failed to stop say process:', err);
  }
};

/**
 * Pause the currently running `say` process via SIGSTOP.
 * No-op when nothing is active or already paused.
 */
export const pauseSpeech = (): void => {
  if (!sayProcess || isPaused) return;
  try {
    sayProcess.kill('SIGSTOP');
    isPaused = true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ESRCH' || code === 'ENOENT') {
      // Process already gone; clear tracking state.
      sayProcess = null;
      isPaused = false;
    } else {
      console.error('Failed to pause say process:', err);
    }
  }
};

/**
 * Resume a previously-paused `say` process via SIGCONT.
 * No-op when nothing is active or not currently paused.
 */
export const resumeSpeech = (): void => {
  if (!sayProcess || !isPaused) return;
  try {
    sayProcess.kill('SIGCONT');
    isPaused = false;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ESRCH' || code === 'ENOENT') {
      sayProcess = null;
      isPaused = false;
    } else {
      console.error('Failed to resume say process:', err);
    }
  }
};

/**
 * Start speaking the given text via the macOS `say` command.
 * Any prior speech is stopped first.
 *
 * @throws if the `say` process cannot be spawned.
 */
export const startSpeech = ({ text, voice, rate }: StartSpeechOptions): void => {
  if (sayProcess) {
    // Stop previous playback without firing the callback — the caller
    // is starting a new run and doesn't want a spurious "ended" event.
    const prev = sayProcess;
    const prevPaused = isPaused;
    sayProcess = null;
    isPaused = false;
    try {
      if (prevPaused) prev.kill('SIGCONT');
      prev.kill('SIGTERM');
    } catch {
      // ignore
    }
  }

  const args: string[] = [];
  if (typeof rate === 'number' && Number.isFinite(rate)) {
    args.push('-r', String(Math.round(rate)));
  }
  if (typeof voice === 'string' && voice.trim().length > 0) {
    args.push('-v', voice.trim());
  }

  console.log('[tts] starting say with args:', args, 'text preview:', text.slice(0, 60));

  let child: SayProcess;
  try {
    child = spawn('say', args, { stdio: ['pipe', 'ignore', 'pipe'] }) as SayProcess;
  } catch (err) {
    console.error('Failed to spawn say:', err);
    throw new Error('Text-to-speech is unavailable on this system');
  }

  sayProcess = child;

  child.on('error', (err) => {
    console.error('say process error:', err);
    if (sayProcess === child) {
      teardownProcess('error');
    }
  });

  child.on('exit', (code, signal) => {
    if (sayProcess !== child) {
      // This process was already replaced or stopped — don't fire the callback.
      return;
    }
    const reason: 'natural' | 'stopped' = signal === 'SIGTERM' ? 'stopped' : 'natural';
    teardownProcess(code === 0 || signal === 'SIGTERM' ? reason : 'error');
  });

  try {
    child.stdin.write(text);
    child.stdin.end();
  } catch (err) {
    console.error('Failed to write text to say stdin:', err);
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
    sayProcess = null;
    throw new Error('Failed to send text to speech engine');
  }
};

/**
 * Kill any active speech process during shutdown/cleanup.
 * Does not fire the end callback.
 */
export const cleanupSpeech = (): void => {
  if (!sayProcess) return;
  const proc = sayProcess;
  sayProcess = null;
  endCallback = null;
  try {
    if (isPaused) proc.kill('SIGCONT');
    proc.kill('SIGTERM');
  } catch {
    // ignore
  }
  isPaused = false;
};

/** Test-only: report whether a speech process is currently tracked. */
export const isSpeechActive = (): boolean => sayProcess !== null;

/** Test-only: report whether the tracked process is currently paused. */
export const isSpeechPaused = (): boolean => isPaused;

const VOICE_LINE = /^(\S.*?)\s{2,}([a-z]{2,3}[-_][A-Z]{2})(?:\s+#\s+(.*))?\s*$/;

/**
 * Parse `say -v '?'` output. Exported for tests.
 */
export const parseVoicesOutput = (output: string): TTSVoice[] => {
  const voices: TTSVoice[] = [];
  for (const raw of output.split('\n')) {
    const line = raw.trimEnd();
    if (!line) continue;
    const match = VOICE_LINE.exec(line);
    if (!match) continue;
    const [, rawName, rawLocale, sample] = match;
    const name = rawName.trim();
    const language = rawLocale.replace('-', '_');
    voices.push({
      name,
      language,
      sampleText: sample ? sample.trim() : '',
    });
  }
  voices.sort((a, b) => {
    if (a.language !== b.language) return a.language.localeCompare(b.language);
    return a.name.localeCompare(b.name);
  });
  return voices;
};

/**
 * Enumerate available `say` voices. Cached at module level on first call
 * (voices do not change while the app is running).
 */
export const listVoices = async (): Promise<TTSVoice[]> => {
  if (cachedVoices) return cachedVoices;

  const voices = await new Promise<TTSVoice[]>((resolve) => {
    let child: ChildProcessByStdio<null, Readable, Readable>;
    try {
      child = spawn('say', ['-v', '?'], { stdio: ['ignore', 'pipe', 'pipe'] }) as ChildProcessByStdio<null, Readable, Readable>;
    } catch (err) {
      console.error('Failed to spawn `say -v ?`:', err);
      resolve([]);
      return;
    }

    let stdout = '';
    let settled = false;

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      console.error('say -v ? error:', err);
      resolve([]);
    });

    child.on('close', () => {
      if (settled) return;
      settled = true;
      try {
        resolve(parseVoicesOutput(stdout));
      } catch (err) {
        console.error('Failed to parse voices output:', err);
        resolve([]);
      }
    });
  });

  cachedVoices = voices;
  return voices;
};

/** Test-only helper for resetting the voice cache. */
export const __resetVoiceCache = (): void => { cachedVoices = null; };
