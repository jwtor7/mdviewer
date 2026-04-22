import { useCallback, useEffect, useState } from 'react';

export const TTS_RATE_BOUNDS = {
  MIN: 50,
  MAX: 500,
  DEFAULT: 200,
} as const;

const VOICE_KEY = 'mdviewer-tts-voice';
const RATE_KEY = 'mdviewer-tts-rate';

const clampRate = (value: number): number => {
  if (!Number.isFinite(value)) return TTS_RATE_BOUNDS.DEFAULT;
  const rounded = Math.round(value);
  if (rounded < TTS_RATE_BOUNDS.MIN) return TTS_RATE_BOUNDS.MIN;
  if (rounded > TTS_RATE_BOUNDS.MAX) return TTS_RATE_BOUNDS.MAX;
  return rounded;
};

const loadInitialVoice = (): string => {
  try {
    return localStorage.getItem(VOICE_KEY) ?? '';
  } catch {
    return '';
  }
};

const loadInitialRate = (): number => {
  try {
    const stored = localStorage.getItem(RATE_KEY);
    if (!stored) return TTS_RATE_BOUNDS.DEFAULT;
    const parsed = JSON.parse(stored);
    if (typeof parsed !== 'number') return TTS_RATE_BOUNDS.DEFAULT;
    return clampRate(parsed);
  } catch {
    return TTS_RATE_BOUNDS.DEFAULT;
  }
};

export interface UseTTSPreferencesReturn {
  voice: string;
  rate: number;
  setVoice: (value: string) => void;
  setRate: (value: number) => void;
}

/**
 * Renderer-side persistence for TTS voice and rate selections.
 * Mirrors `useWordWrap` (localStorage only — no main-process file store).
 */
export const useTTSPreferences = (): UseTTSPreferencesReturn => {
  const [voice, setVoiceState] = useState<string>(loadInitialVoice);
  const [rate, setRateState] = useState<number>(loadInitialRate);

  useEffect(() => {
    try {
      if (voice) {
        localStorage.setItem(VOICE_KEY, voice);
      } else {
        localStorage.removeItem(VOICE_KEY);
      }
    } catch {
      // Non-fatal: persistence best-effort.
    }
  }, [voice]);

  useEffect(() => {
    try {
      localStorage.setItem(RATE_KEY, JSON.stringify(rate));
    } catch {
      // Non-fatal.
    }
  }, [rate]);

  const setVoice = useCallback((value: string): void => {
    setVoiceState(value.trim());
  }, []);

  const setRate = useCallback((value: number): void => {
    setRateState(clampRate(value));
  }, []);

  return { voice, rate, setVoice, setRate };
};
