/**
 * Shared types for the TTS engine modules (say + kokoro + dispatcher).
 */

/** Why an utterance ended. */
export type EndReason = 'natural' | 'stopped' | 'error';

/** Callback invoked when the active utterance finishes. */
export type EndCallback = (reason: EndReason) => void;

export interface StartSpeechOptions {
  text: string;
  voice?: string;
  rate?: number;
  /** Next sentence, used by the kokoro engine for prefetch. */
  nextText?: string;
}

export interface TTSVoice {
  name: string;
  language: string;
  sampleText: string;
}

/** Which engine is narrating. */
export type TTSEngineName = 'kokoro' | 'say';

export interface TTSEngineStatus {
  engine: TTSEngineName;
  voiceLabel: string;
}
