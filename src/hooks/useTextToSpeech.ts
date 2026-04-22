import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chunkMarkdownForSpeech, findChunkIndexAtOffset, type SpeechChunk } from '../utils/speechChunker.js';
import { convertMarkdownToSpeech } from '../utils/markdownToSpeech.js';
import { extractChapters, type Chapter } from '../utils/chapterExtraction.js';

export type TTSStatus = 'idle' | 'speaking' | 'paused';

export interface SpeakOptions {
  voice?: string;
  rate?: number;
  tabId?: string;
  fromOffset?: number;
  chapterIndex?: number;
}

export interface UseTextToSpeechResult {
  isSpeaking: boolean;
  status: TTSStatus;
  speak: (markdown: string, opts?: SpeakOptions) => Promise<void>;
  stop: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  nextSentence: () => Promise<void>;
  prevSentence: () => Promise<void>;
  nextChunk: () => Promise<void>;
  prevChunk: () => Promise<void>;
  setLiveRate: (rate: number) => Promise<void>;
  setLiveVoice: (voice: string) => Promise<void>;
  currentChunkIndex: number;
  currentSentenceIndex: number;
  currentSourceOffset: { start: number; end: number } | null;
  chunks: SpeechChunk[];
  chapters: Chapter[];
  speakingTabId: string | null;
}

export interface UseTextToSpeechOptions {
  showError: (message: string, type?: string) => void;
  activeTabId?: string | null;
}

const MAX_CHUNK_CHARS = 10_000;
const MAX_TOTAL_CHARS = 100_000;

/**
 * Chunk-driven TTS hook. Converts markdown once via `chunkMarkdownForSpeech`,
 * then plays chunks through the `say` bridge one at a time, tracking which
 * chunk is active so UI layers can highlight it. Public API remains backward
 * compatible with V1 (isSpeaking/speak/stop).
 */
export const useTextToSpeech = ({ showError, activeTabId }: UseTextToSpeechOptions): UseTextToSpeechResult => {
  const [chunks, setChunks] = useState<SpeechChunk[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);
  const [status, setStatus] = useState<TTSStatus>('idle');
  const [speakingTabId, setSpeakingTabId] = useState<string | null>(null);

  // Refs mirror state so async callbacks always see the latest values without
  // forcing them into the dependency list.
  const chunksRef = useRef<SpeechChunk[]>([]);
  const chunkIndexRef = useRef(-1);
  const sentenceIndexRef = useRef(-1);
  const statusRef = useRef<TTSStatus>('idle');
  const optionsRef = useRef<SpeakOptions>({});
  const resolveEndRef = useRef<(() => void) | null>(null);
  const runIdRef = useRef(0);
  const speakingTabIdRef = useRef<string | null>(null);
  // Pause gate: the playback loop awaits this between sentences whenever
  // statusRef is 'paused'. Protects against the race where the `say` process
  // exits naturally at the exact moment the user hits pause — without it,
  // tts:ended advances the loop and a new sentence starts even though the
  // user has paused, creating a loop of pause → play-snippet → pause.
  const pauseGateRef = useRef<(() => void) | null>(null);

  useEffect(() => { chunksRef.current = chunks; }, [chunks]);
  useEffect(() => { chunkIndexRef.current = currentChunkIndex; }, [currentChunkIndex]);
  useEffect(() => { sentenceIndexRef.current = currentSentenceIndex; }, [currentSentenceIndex]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { speakingTabIdRef.current = speakingTabId; }, [speakingTabId]);

  const isSpeaking = status !== 'idle';

  const resetState = useCallback(() => {
    setStatus('idle');
    setCurrentChunkIndex(-1);
    setCurrentSentenceIndex(-1);
    setSpeakingTabId(null);
    chunkIndexRef.current = -1;
    sentenceIndexRef.current = -1;
    statusRef.current = 'idle';
    speakingTabIdRef.current = null;
  }, []);

  const resolveEndListener = useCallback(() => {
    const fn = resolveEndRef.current;
    resolveEndRef.current = null;
    fn?.();
  }, []);

  const releasePauseGate = useCallback(() => {
    const gate = pauseGateRef.current;
    pauseGateRef.current = null;
    gate?.();
  }, []);

  const waitIfPaused = useCallback(async (): Promise<void> => {
    if (statusRef.current !== 'paused') return;
    await new Promise<void>((resolve) => {
      pauseGateRef.current = resolve;
    });
  }, []);

  // Subscribe once to the main-process end event.
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onSpeechEnd) return undefined;
    const cleanup = api.onSpeechEnd(() => {
      resolveEndListener();
    });
    return cleanup;
  }, [resolveEndListener]);

  const waitForChunkEnd = useCallback((): Promise<void> => {
    return new Promise<void>((resolve) => {
      resolveEndRef.current = resolve;
    });
  }, []);

  const speakTextFragment = useCallback(async (text: string): Promise<boolean> => {
    const api = window.electronAPI;
    if (!api?.startSpeech) return false;
    const bounded = text.slice(0, MAX_CHUNK_CHARS);
    if (!bounded.trim()) return true;
    console.log('[tts] speakTextFragment options:', { voice: optionsRef.current.voice, rate: optionsRef.current.rate, textPreview: bounded.slice(0, 60) });
    const result = await api.startSpeech({
      text: bounded,
      voice: optionsRef.current.voice || undefined,
      rate: optionsRef.current.rate,
    });
    if (!result.success) {
      showError(result.error || 'Failed to start speech');
      return false;
    }
    await waitForChunkEnd();
    return true;
  }, [showError, waitForChunkEnd]);

  const stop = useCallback(async (): Promise<void> => {
    runIdRef.current += 1; // Invalidate any in-flight playback loop.
    resetState();
    resolveEndListener();
    releasePauseGate();
    const api = window.electronAPI;
    if (!api?.stopSpeech) return;
    try {
      await api.stopSpeech();
    } catch (err) {
      console.error('Failed to stop speech:', err);
    }
  }, [resetState, resolveEndListener, releasePauseGate]);

  const runPlaybackLoop = useCallback(async (chunkStart: number, sentenceStart: number, runId: number): Promise<void> => {
    const list = chunksRef.current;
    let chunkIndex = chunkStart;
    let sentenceIndex = sentenceStart;

    while (chunkIndex < list.length) {
      if (runId !== runIdRef.current) return;

      const chunk = list[chunkIndex];
      const sentences = chunk.sentences.length > 0
        ? chunk.sentences
        : [{ text: chunk.text, sourceStart: chunk.sourceStart, sourceEnd: chunk.sourceEnd }];

      if (sentenceIndex >= sentences.length) {
        chunkIndex += 1;
        sentenceIndex = 0;
        continue;
      }

      setCurrentChunkIndex(chunkIndex);
      setCurrentSentenceIndex(sentenceIndex);
      chunkIndexRef.current = chunkIndex;
      sentenceIndexRef.current = sentenceIndex;

      const ok = await speakTextFragment(sentences[sentenceIndex].text);
      if (!ok) {
        if (runId === runIdRef.current) resetState();
        return;
      }
      if (runId !== runIdRef.current) return;

      // Hold the loop between sentences while paused — robust to the race
      // where the `say` process exits naturally at the moment pause() fires.
      await waitIfPaused();
      if (runId !== runIdRef.current) return;

      sentenceIndex += 1;
    }
    if (runId === runIdRef.current) resetState();
  }, [resetState, speakTextFragment, waitIfPaused]);

  const speak = useCallback(async (markdown: string, opts: SpeakOptions = {}): Promise<void> => {
    const api = window.electronAPI;
    if (!api?.startSpeech) {
      showError('Text-to-speech is not available');
      return;
    }

    const fallbackText = convertMarkdownToSpeech(markdown);
    if (!fallbackText || fallbackText.trim().length === 0) {
      showError('Nothing to read');
      return;
    }

    const builtChunks = chunkMarkdownForSpeech(markdown);
    const effectiveChunks = builtChunks.length > 0
      ? builtChunks
      : [{
          index: 0,
          kind: 'paragraph' as const,
          text: fallbackText,
          sourceStart: 0,
          sourceEnd: markdown.length,
          sentences: [{ text: fallbackText, sourceStart: 0, sourceEnd: markdown.length }],
        }];

    // Cap total narration length to match the V1 safety budget.
    let totalChars = 0;
    const boundedChunks: SpeechChunk[] = [];
    for (const chunk of effectiveChunks) {
      const slice = chunk.text.slice(0, Math.max(0, MAX_TOTAL_CHARS - totalChars));
      if (!slice) break;
      totalChars += slice.length;
      boundedChunks.push({ ...chunk, text: slice });
      if (totalChars >= MAX_TOTAL_CHARS) break;
    }

    // Decide starting chunk. Chapter index wins over fromOffset when both are set.
    let startChunkIdx = 0;
    if (typeof opts.chapterIndex === 'number' && opts.chapterIndex >= 0) {
      const chapterList = extractChapters(boundedChunks);
      const chapter = chapterList[opts.chapterIndex];
      if (chapter) startChunkIdx = chapter.chunkStartIndex;
    } else if (typeof opts.fromOffset === 'number' && opts.fromOffset >= 0) {
      const foundIdx = findChunkIndexAtOffset(boundedChunks, opts.fromOffset);
      if (foundIdx >= 0) startChunkIdx = foundIdx;
    }

    // Cancel any prior run. Explicitly stop the main-process `say` so a
    // restart (e.g. Read from cursor) doesn't briefly overlap the old
    // narration with the new one.
    runIdRef.current += 1;
    const runId = runIdRef.current;
    resolveEndListener();
    releasePauseGate();
    try {
      await api.stopSpeech?.();
    } catch {
      // ignore
    }

    optionsRef.current = { voice: opts.voice, rate: opts.rate };
    chunksRef.current = boundedChunks;
    setChunks(boundedChunks);
    setCurrentChunkIndex(startChunkIdx);
    setCurrentSentenceIndex(0);
    setStatus('speaking');
    statusRef.current = 'speaking';
    chunkIndexRef.current = startChunkIdx;
    sentenceIndexRef.current = 0;
    setSpeakingTabId(opts.tabId ?? null);
    speakingTabIdRef.current = opts.tabId ?? null;

    // Kick off the chunk loop without blocking the caller. speak() resolves
    // as soon as playback has started; natural end or stop() updates state.
    void runPlaybackLoop(startChunkIdx, 0, runId).catch((err) => {
      console.error('Playback loop error:', err);
      if (runId === runIdRef.current) resetState();
    });
  }, [resetState, resolveEndListener, releasePauseGate, runPlaybackLoop, showError]);

  // Seek helpers that restart playback from a specific (chunk, sentence) pair.
  const seekTo = useCallback(async (chunkIdx: number, sentenceIdx: number): Promise<void> => {
    const list = chunksRef.current;
    if (chunkIdx < 0 || chunkIdx >= list.length) return;
    if (statusRef.current === 'idle') return;

    // Cancel current playback.
    runIdRef.current += 1;
    const runId = runIdRef.current;
    resolveEndListener();
    releasePauseGate();

    const api = window.electronAPI;
    try {
      await api?.stopSpeech?.();
    } catch {
      // ignore
    }

    setStatus('speaking');
    statusRef.current = 'speaking';
    setCurrentChunkIndex(chunkIdx);
    setCurrentSentenceIndex(sentenceIdx);
    chunkIndexRef.current = chunkIdx;
    sentenceIndexRef.current = sentenceIdx;

    void runPlaybackLoop(chunkIdx, sentenceIdx, runId).catch((err) => {
      console.error('Playback loop error:', err);
      if (runId === runIdRef.current) resetState();
    });
  }, [resetState, resolveEndListener, releasePauseGate, runPlaybackLoop]);

  const nextSentence = useCallback(async (): Promise<void> => {
    const list = chunksRef.current;
    let chunkIdx = chunkIndexRef.current;
    let sentenceIdx = sentenceIndexRef.current;
    if (chunkIdx < 0) return;
    const sentencesInChunk = list[chunkIdx]?.sentences.length ?? 0;
    if (sentenceIdx + 1 < sentencesInChunk) {
      sentenceIdx += 1;
    } else if (chunkIdx + 1 < list.length) {
      chunkIdx += 1;
      sentenceIdx = 0;
    } else {
      await stop();
      return;
    }
    await seekTo(chunkIdx, sentenceIdx);
  }, [seekTo, stop]);

  const prevSentence = useCallback(async (): Promise<void> => {
    const list = chunksRef.current;
    let chunkIdx = chunkIndexRef.current;
    let sentenceIdx = sentenceIndexRef.current;
    if (chunkIdx < 0) return;
    if (sentenceIdx > 0) {
      sentenceIdx -= 1;
    } else if (chunkIdx > 0) {
      chunkIdx -= 1;
      const prevChunkSentences = list[chunkIdx]?.sentences.length ?? 1;
      sentenceIdx = Math.max(0, prevChunkSentences - 1);
    } else {
      sentenceIdx = 0;
    }
    await seekTo(chunkIdx, sentenceIdx);
  }, [seekTo]);

  // Chapter navigation. Next jumps to the next chapter; if we're already in
  // the last chapter, stay put rather than stopping narration (stopping on
  // "next" is surprising — users read it as "skip", not "end").
  const nextChunk = useCallback(async (): Promise<void> => {
    const list = chunksRef.current;
    const chapters = extractChapters(list);
    if (chapters.length === 0) return;
    const currentIdx = chunkIndexRef.current;
    const nextChapter = chapters.find(ch => ch.chunkStartIndex > currentIdx);
    if (!nextChapter) return;
    await seekTo(nextChapter.chunkStartIndex, 0);
  }, [seekTo]);

  // Prev chapter follows standard media-player semantics: if we're inside a
  // chapter (not at its first chunk), rewind to the start of the current
  // chapter; if we're already at a chapter boundary, jump to the previous one.
  const prevChunk = useCallback(async (): Promise<void> => {
    const list = chunksRef.current;
    const chapters = extractChapters(list);
    if (chapters.length === 0) return;
    const currentIdx = chunkIndexRef.current;
    const currentChapter = [...chapters].reverse().find(ch => ch.chunkStartIndex <= currentIdx);
    if (!currentChapter) {
      // Before the first chapter — seek to the first chapter.
      await seekTo(chapters[0].chunkStartIndex, 0);
      return;
    }
    if (currentIdx > currentChapter.chunkStartIndex) {
      // Inside a chapter — rewind to its start.
      await seekTo(currentChapter.chunkStartIndex, 0);
      return;
    }
    // At a chapter boundary — go to the previous chapter, or stay at
    // chapter 0 if this is already the first one.
    const currentChapterIdx = chapters.indexOf(currentChapter);
    const target = currentChapterIdx > 0 ? chapters[currentChapterIdx - 1] : currentChapter;
    await seekTo(target.chunkStartIndex, 0);
  }, [seekTo]);

  // Live parameter updates. The macOS `say` process bakes rate and voice
  // into its CLI args at spawn time, so mid-utterance updates require
  // killing and restarting the current sentence.
  //
  // Behavior: when speaking, restart the current sentence immediately so the
  // change is audible within ~1 sentence. When paused, only update optionsRef
  // — the next sentence (post-resume) will pick up the new values. Restarting
  // while paused would either play a brief blip or silently consume the new
  // rate without playing, both of which are worse than just deferring.
  const setLiveRate = useCallback(async (rate: number): Promise<void> => {
    if (optionsRef.current.rate === rate) return;
    optionsRef.current = { ...optionsRef.current, rate };
    if (statusRef.current !== 'speaking') return;
    await seekTo(chunkIndexRef.current, sentenceIndexRef.current);
  }, [seekTo]);

  const setLiveVoice = useCallback(async (voice: string): Promise<void> => {
    if (optionsRef.current.voice === voice) return;
    optionsRef.current = { ...optionsRef.current, voice };
    if (statusRef.current !== 'speaking') return;
    await seekTo(chunkIndexRef.current, sentenceIndexRef.current);
  }, [seekTo]);

  const pause = useCallback(async (): Promise<void> => {
    if (statusRef.current !== 'speaking') return;
    // Flip status before the IPC round-trip so the playback loop gate takes
    // effect immediately, even if the `say` process exits naturally before
    // SIGSTOP reaches it.
    setStatus('paused');
    statusRef.current = 'paused';
    const api = window.electronAPI;
    if (!api?.pauseSpeech) return;
    try {
      await api.pauseSpeech();
    } catch (err) {
      console.error('Failed to pause speech:', err);
    }
  }, []);

  const resume = useCallback(async (): Promise<void> => {
    if (statusRef.current !== 'paused') return;
    setStatus('speaking');
    statusRef.current = 'speaking';
    const api = window.electronAPI;
    if (api?.resumeSpeech) {
      try {
        await api.resumeSpeech();
      } catch (err) {
        console.error('Failed to resume speech:', err);
      }
    }
    // Unblock the playback loop if it was parked at the between-sentence gate.
    releasePauseGate();
  }, [releasePauseGate]);

  // Per-tab scoping: stop speech if the active tab changes while speaking.
  useEffect(() => {
    if (activeTabId === undefined || activeTabId === null) return;
    if (statusRef.current === 'idle') return;
    const speakingTab = speakingTabIdRef.current;
    if (speakingTab && speakingTab !== activeTabId) {
      const api = window.electronAPI;
      runIdRef.current += 1;
      resetState();
      resolveEndRef.current?.();
      resolveEndRef.current = null;
      api?.stopSpeech?.().catch(() => { /* ignore */ });
    }
  }, [activeTabId, resetState]);

  // Stop on unmount.
  useEffect(() => {
    return () => {
      if (statusRef.current !== 'idle') {
        const api = window.electronAPI;
        api?.stopSpeech?.().catch(() => { /* ignore */ });
      }
      resolveEndRef.current = null;
    };
  }, []);

  const currentSourceOffset = currentChunkIndex >= 0 && currentChunkIndex < chunks.length
    ? { start: chunks[currentChunkIndex].sourceStart, end: chunks[currentChunkIndex].sourceEnd }
    : null;

  const chapters = useMemo(() => extractChapters(chunks), [chunks]);

  return {
    isSpeaking,
    status,
    speak,
    stop,
    pause,
    resume,
    nextSentence,
    prevSentence,
    nextChunk,
    prevChunk,
    setLiveRate,
    setLiveVoice,
    currentChunkIndex,
    currentSentenceIndex,
    currentSourceOffset,
    chunks,
    chapters,
    speakingTabId,
  };
};
