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
    const api = window.electronAPI;
    if (!api?.stopSpeech) return;
    try {
      await api.stopSpeech();
    } catch (err) {
      console.error('Failed to stop speech:', err);
    }
  }, [resetState, resolveEndListener]);

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

      sentenceIndex += 1;
    }
    if (runId === runIdRef.current) resetState();
  }, [resetState, speakTextFragment]);

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

    // Cancel any prior run without waiting on it.
    runIdRef.current += 1;
    const runId = runIdRef.current;
    resolveEndListener();

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
  }, [resetState, resolveEndListener, runPlaybackLoop, showError]);

  // Seek helpers that restart playback from a specific (chunk, sentence) pair.
  const seekTo = useCallback(async (chunkIdx: number, sentenceIdx: number): Promise<void> => {
    const list = chunksRef.current;
    if (chunkIdx < 0 || chunkIdx >= list.length) return;
    if (statusRef.current === 'idle') return;

    // Cancel current playback.
    runIdRef.current += 1;
    const runId = runIdRef.current;
    resolveEndListener();

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
  }, [resetState, resolveEndListener, runPlaybackLoop]);

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

  // Chapter navigation hops to the chapter before/after the current chunk.
  const nextChunk = useCallback(async (): Promise<void> => {
    const list = chunksRef.current;
    const chapters = extractChapters(list);
    if (chapters.length === 0) return;
    const currentIdx = chunkIndexRef.current;
    const nextChapter = chapters.find(ch => ch.chunkStartIndex > currentIdx);
    if (!nextChapter) {
      await stop();
      return;
    }
    await seekTo(nextChapter.chunkStartIndex, 0);
  }, [seekTo, stop]);

  const prevChunk = useCallback(async (): Promise<void> => {
    const list = chunksRef.current;
    const chapters = extractChapters(list);
    if (chapters.length === 0) return;
    const currentIdx = chunkIndexRef.current;
    // Find the last chapter whose start is BEFORE currentIdx. If we're already
    // at a chapter boundary, go to the prior one.
    const prior = [...chapters].reverse().find(ch => ch.chunkStartIndex < currentIdx);
    const target = prior ?? chapters[0];
    await seekTo(target.chunkStartIndex, 0);
  }, [seekTo]);

  const pause = useCallback(async (): Promise<void> => {
    if (statusRef.current !== 'speaking') return;
    const api = window.electronAPI;
    if (!api?.pauseSpeech) return;
    try {
      const result = await api.pauseSpeech();
      if (result.success) {
        setStatus('paused');
        statusRef.current = 'paused';
      } else {
        showError(result.error || 'Failed to pause');
      }
    } catch (err) {
      console.error('Failed to pause speech:', err);
    }
  }, [showError]);

  const resume = useCallback(async (): Promise<void> => {
    if (statusRef.current !== 'paused') return;
    const api = window.electronAPI;
    if (!api?.resumeSpeech) return;
    try {
      const result = await api.resumeSpeech();
      if (result.success) {
        setStatus('speaking');
        statusRef.current = 'speaking';
      } else {
        showError(result.error || 'Failed to resume');
      }
    } catch (err) {
      console.error('Failed to resume speech:', err);
    }
  }, [showError]);

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
    currentChunkIndex,
    currentSentenceIndex,
    currentSourceOffset,
    chunks,
    chapters,
    speakingTabId,
  };
};
