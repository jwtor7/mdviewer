/**
 * TTS dispatcher — public entry point for main-process text-to-speech.
 *
 * Kokoro (neural, local) is the primary engine; the macOS `say` command is
 * the automatic fallback. The first failed Kokoro attempt disables the
 * engine for the rest of the session (no flapping), fires a one-time
 * notification so the renderer can toast, and every subsequent utterance
 * goes straight to `say`. The user's saved voice preference applies only
 * on the `say` path — Kokoro ships a single fixed voice.
 */

import * as sayEngine from './sayEngine.js';
import * as kokoroEngine from './kokoroEngine.js';
import type { EndCallback, StartSpeechOptions, TTSEngineName, TTSEngineStatus, TTSVoice } from './types.js';

export type { StartSpeechOptions, TTSVoice, EndReason, EndCallback, TTSEngineName, TTSEngineStatus } from './types.js';

let currentEngine: TTSEngineName = 'kokoro';
let kokoroDisabled = false;
let kokoroDisabledReason: string | null = null;
let notificationFired = false;
// Bumped on every startSpeech/stopSpeech. A Kokoro failure observed under a
// stale generation means the user already stopped (or restarted) — falling
// back to `say` would start speaking out of nowhere, so we return silently.
let dispatchGeneration = 0;

let endCallback: EndCallback | null = null;
let engineNotificationCallback: ((status: TTSEngineStatus) => void) | null = null;

// Each engine forwards its end events only while it owns the current
// utterance, so a late exit from the other engine can't advance the
// renderer's sentence loop.
sayEngine.setSpeechEndCallback((reason) => {
  if (currentEngine === 'say') endCallback?.(reason);
});
kokoroEngine.setSpeechEndCallback((reason) => {
  if (currentEngine === 'kokoro') endCallback?.(reason);
});

const sayStatus = (): TTSEngineStatus => ({ engine: 'say', voiceLabel: '' });
const kokoroStatus = (): TTSEngineStatus => ({
  engine: 'kokoro',
  voiceLabel: kokoroEngine.KOKORO_VOICE_LABEL,
});

const disableKokoro = (reason: string): void => {
  kokoroDisabled = true;
  kokoroDisabledReason = reason;
  console.warn('[tts] Kokoro disabled, falling back to say:', reason);
  if (!notificationFired && engineNotificationCallback) {
    notificationFired = true;
    try {
      engineNotificationCallback(sayStatus());
    } catch (err) {
      console.error('[tts] engine notification callback threw:', err);
    }
  }
};

/**
 * Register a callback invoked whenever the active utterance ends.
 * Replaces any previously registered callback.
 */
export const setSpeechEndCallback = (callback: EndCallback | null): void => {
  endCallback = callback;
};

/**
 * Register a callback fired once per session when Kokoro becomes
 * unavailable and narration falls back to `say`.
 */
export const setEngineNotificationCallback = (
  callback: ((status: TTSEngineStatus) => void) | null
): void => {
  engineNotificationCallback = callback;
};

/**
 * Start speaking: Kokoro first, `say` on failure. Resolves once playback
 * has started (Kokoro synthesis included), so the renderer's per-sentence
 * loop needs no changes.
 */
export const startSpeech = async (opts: StartSpeechOptions): Promise<void> => {
  dispatchGeneration += 1;
  const gen = dispatchGeneration;

  // Stop any prior say utterance without firing its end callback — the
  // caller is starting a new utterance and doesn't want a spurious "ended"
  // event. Kokoro is NOT stopped here: its speak() replaces the current
  // utterance itself, and kokoroEngine.stopSpeech() would wipe the prefetch
  // cache that was just populated for this very sentence.
  sayEngine.stopSpeech();

  if (kokoroDisabled) {
    kokoroEngine.stopSpeech();
    currentEngine = 'say';
    sayEngine.startSpeech(opts);
    return;
  }

  currentEngine = 'kokoro';
  try {
    await kokoroEngine.speak({
      text: opts.text,
      speed: kokoroEngine.wpmToKokoroSpeed(opts.rate),
      nextText: opts.nextText,
    });
  } catch (err) {
    if (gen !== dispatchGeneration) {
      // User stopped (or restarted) while Kokoro was synthesizing — do NOT
      // fall back and start speaking.
      return;
    }
    disableKokoro(err instanceof Error ? err.message : String(err));
    currentEngine = 'say';
    sayEngine.startSpeech(opts);
  }
};

/**
 * Stop any active narration. Kokoro's stop also runs unconditionally so a
 * stop landing during synthesis (before the utterance engine is settled)
 * still abandons the in-flight request.
 */
export const stopSpeech = (): void => {
  dispatchGeneration += 1;
  sayEngine.stopSpeech();
  kokoroEngine.stopSpeech();
};

/** Pause the active narration on whichever engine owns it. */
export const pauseSpeech = (): void => {
  if (currentEngine === 'kokoro') {
    kokoroEngine.pauseSpeech();
  } else {
    sayEngine.pauseSpeech();
  }
};

/** Resume the paused narration on whichever engine owns it. */
export const resumeSpeech = (): void => {
  if (currentEngine === 'kokoro') {
    kokoroEngine.resumeSpeech();
  } else {
    sayEngine.resumeSpeech();
  }
};

/** Enumerate macOS `say` voices (used by the fallback voice picker). */
export const listVoices = (): Promise<TTSVoice[]> => sayEngine.listVoices();

/**
 * Report which engine will narrate. Lazy-probes the Kokoro worker — opening
 * the Read Aloud menu warms the model, a feature — and memoizes via the
 * engine's own worker lifecycle, so it's instant after the first call.
 */
export const getEngineStatus = async (): Promise<TTSEngineStatus> => {
  if (kokoroDisabled) return sayStatus();
  try {
    await kokoroEngine.probeWorker();
    return kokoroStatus();
  } catch (err) {
    disableKokoro(err instanceof Error ? err.message : String(err));
    return sayStatus();
  }
};

/** Shutdown/cleanup for both engines. Fires no end callbacks. */
export const cleanupSpeech = (): void => {
  endCallback = null;
  sayEngine.cleanupSpeech();
  kokoroEngine.cleanupSpeech();
};

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Test-only: reset dispatcher state between tests. */
export const __resetDispatcherForTests = (): void => {
  currentEngine = 'kokoro';
  kokoroDisabled = false;
  kokoroDisabledReason = null;
  notificationFired = false;
  dispatchGeneration = 0;
  endCallback = null;
  engineNotificationCallback = null;
};

/** Test-only: report dispatcher state. */
export const __getDispatcherState = (): {
  currentEngine: TTSEngineName;
  kokoroDisabled: boolean;
  kokoroDisabledReason: string | null;
} => ({ currentEngine, kokoroDisabled, kokoroDisabledReason });
