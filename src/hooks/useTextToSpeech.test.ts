import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTextToSpeech } from './useTextToSpeech';
import { mockElectronAPI } from '../test/setup';

const setupShowError = (): ReturnType<typeof vi.fn> => vi.fn();

describe('useTextToSpeech', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.startSpeech.mockImplementation(() => Promise.resolve({ success: true, data: undefined }));
    mockElectronAPI.stopSpeech.mockImplementation(() => Promise.resolve({ success: true, data: undefined }));
    mockElectronAPI.onSpeechEnd.mockImplementation(() => vi.fn());
  });

  it('starts in idle state', () => {
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));
    expect(result.current.isSpeaking).toBe(false);
  });

  it('flips to speaking when speak() succeeds', async () => {
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));

    await act(async () => {
      await result.current.speak('# Hello\n\nThis is a test.');
    });

    expect(mockElectronAPI.startSpeech).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('Hello') })
    );
    expect(result.current.isSpeaking).toBe(true);
    expect(showError).not.toHaveBeenCalled();
  });

  it('shows error and stays idle when markdown is empty', async () => {
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));

    await act(async () => {
      await result.current.speak('   ');
    });

    expect(showError).toHaveBeenCalledWith('Nothing to read');
    expect(result.current.isSpeaking).toBe(false);
    expect(mockElectronAPI.startSpeech).not.toHaveBeenCalled();
  });

  it('shows error when the IPC call fails', async () => {
    mockElectronAPI.startSpeech.mockImplementationOnce(() => Promise.resolve({ success: false, error: 'boom' } as never));
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));

    await act(async () => {
      await result.current.speak('Hello');
    });

    expect(showError).toHaveBeenCalledWith('boom');
    expect(result.current.isSpeaking).toBe(false);
  });

  it('returns to idle on stop()', async () => {
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));

    await act(async () => {
      await result.current.speak('Hello');
    });
    expect(result.current.isSpeaking).toBe(true);

    await act(async () => {
      await result.current.stop();
    });

    expect(mockElectronAPI.stopSpeech).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });

  it('returns to idle when the natural end event fires', async () => {
    let endCallback: (() => void) | null = null;
    mockElectronAPI.onSpeechEnd.mockImplementation(((cb: () => void) => {
      endCallback = cb;
      return vi.fn();
    }) as never);

    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));

    await act(async () => {
      await result.current.speak('Hello');
    });
    expect(result.current.isSpeaking).toBe(true);

    act(() => {
      endCallback?.();
    });

    await waitFor(() => expect(result.current.isSpeaking).toBe(false));
  });

  it('stops speech when the hook unmounts mid-playback', async () => {
    const showError = setupShowError();
    const { result, unmount } = renderHook(() => useTextToSpeech({ showError }));

    await act(async () => {
      await result.current.speak('Hello');
    });

    unmount();

    expect(mockElectronAPI.stopSpeech).toHaveBeenCalled();
  });

  it('transitions speaking → paused → speaking on pause/resume', async () => {
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));

    await act(async () => {
      await result.current.speak('Hello');
    });
    expect(result.current.status).toBe('speaking');

    await act(async () => {
      await result.current.pause();
    });
    expect(mockElectronAPI.pauseSpeech).toHaveBeenCalled();
    expect(result.current.status).toBe('paused');

    await act(async () => {
      await result.current.resume();
    });
    expect(mockElectronAPI.resumeSpeech).toHaveBeenCalled();
    expect(result.current.status).toBe('speaking');
  });

  it('is a no-op when pause() is called while idle', async () => {
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));

    await act(async () => {
      await result.current.pause();
    });

    expect(mockElectronAPI.pauseSpeech).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('stops speech when the active tab changes mid-playback', async () => {
    const showError = setupShowError();
    let activeTabId: string | null = 'tab-1';
    const { result, rerender } = renderHook(
      ({ activeTabId: id }: { activeTabId: string | null }) => useTextToSpeech({ showError, activeTabId: id }),
      { initialProps: { activeTabId } }
    );

    await act(async () => {
      await result.current.speak('Hello', { tabId: 'tab-1' });
    });
    expect(result.current.status).toBe('speaking');

    activeTabId = 'tab-2';
    rerender({ activeTabId });

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(mockElectronAPI.stopSpeech).toHaveBeenCalled();
  });

  it('a superseded sentence resolving late does not steal the end listener from a new run', async () => {
    // With Kokoro, startSpeech resolves only after synthesis (seconds). A
    // restart (read-from-cursor, rate change, sentence nav) while the old
    // loop is parked on that await must not let the old loop re-register
    // the end listener when its abandoned call finally resolves.
    let endCb: () => void = () => undefined;
    mockElectronAPI.onSpeechEnd.mockImplementation(((cb: () => void) => {
      endCb = cb;
      return vi.fn();
    }) as never);
    let resolveFirst: (v: { success: true; data: undefined }) => void = () => undefined;
    mockElectronAPI.startSpeech
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementation(() => Promise.resolve({ success: true, data: undefined }));

    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));

    // Old run: its first sentence is "synthesizing" (startSpeech pending).
    await act(async () => {
      await result.current.speak('One one one. Two two two.');
    });

    // Restart while the old run is still awaiting startSpeech.
    await act(async () => {
      await result.current.speak('Alpha alpha. Beta beta.');
    });
    await waitFor(() => expect(mockElectronAPI.startSpeech.mock.calls.length).toBeGreaterThanOrEqual(2));

    // The abandoned first call resolves late — it must not touch the listener.
    await act(async () => {
      resolveFirst({ success: true, data: undefined });
    });

    // Natural end of the new run's first sentence must advance the NEW loop.
    await act(async () => {
      endCb();
    });
    await waitFor(() => {
      const texts = (mockElectronAPI.startSpeech.mock.calls as unknown as Array<[{ text: string }]>).map((c) => c[0].text);
      expect(texts.some((t) => t.includes('Beta'))).toBe(true);
    });
    expect(result.current.isSpeaking).toBe(true);
  });

  it('passes the upcoming sentence as nextText for prefetch', async () => {
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));

    await act(async () => {
      await result.current.speak('First sentence here. Second sentence here.');
    });

    await waitFor(() => expect(mockElectronAPI.startSpeech).toHaveBeenCalled());
    const calls = mockElectronAPI.startSpeech.mock.calls as unknown as Array<[{ text: string; nextText?: string }]>;
    const firstCall = calls[0][0];
    expect(firstCall.text).toContain('First sentence');
    expect(firstCall.nextText).toContain('Second sentence');
  });

  it('passes rate through to startSpeech', async () => {
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));
    await act(async () => {
      await result.current.speak('Hello world.', { rate: 350 });
    });
    expect(mockElectronAPI.startSpeech).toHaveBeenCalledWith(
      expect.objectContaining({ rate: 350 })
    );
  });

  it('passes voice through to startSpeech', async () => {
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));
    await act(async () => {
      await result.current.speak('Hello world.', { voice: 'Samantha' });
    });
    expect(mockElectronAPI.startSpeech).toHaveBeenCalledWith(
      expect.objectContaining({ voice: 'Samantha' })
    );
  });

  it('starts from the chunk containing fromOffset', async () => {
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));
    const md = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const offset = md.indexOf('Second');
    await act(async () => {
      await result.current.speak(md, { fromOffset: offset });
    });
    const calls = mockElectronAPI.startSpeech.mock.calls as unknown as Array<[{ text: string }]>;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0].text).toContain('Second paragraph');
    expect(calls[0][0].text).not.toContain('First paragraph');
  });

  it('setLiveRate restarts the current sentence with the new rate while speaking', async () => {
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));

    await act(async () => {
      await result.current.speak('First sentence. Second sentence.', { rate: 200 });
    });
    expect(result.current.isSpeaking).toBe(true);
    const callsBefore = mockElectronAPI.startSpeech.mock.calls.length;

    await act(async () => {
      await result.current.setLiveRate(350);
    });

    expect(mockElectronAPI.stopSpeech).toHaveBeenCalled();
    const calls = mockElectronAPI.startSpeech.mock.calls as unknown as Array<[{ rate?: number }]>;
    expect(calls.length).toBeGreaterThan(callsBefore);
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.rate).toBe(350);
  });

  it('setLiveRate is a no-op while idle', async () => {
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));

    await act(async () => {
      await result.current.setLiveRate(275);
    });

    expect(mockElectronAPI.startSpeech).not.toHaveBeenCalled();
    expect(mockElectronAPI.stopSpeech).not.toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });

  it('nextChunk does not stop narration when already in the last chapter', async () => {
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));
    // Single-heading doc → one chapter, so next-chapter has nowhere to go.
    await act(async () => {
      await result.current.speak('# Only Chapter\n\nBody text.');
    });
    expect(result.current.status).toBe('speaking');

    await act(async () => {
      await result.current.nextChunk();
    });

    // Must remain speaking — previously this called stop() and went idle.
    expect(result.current.status).toBe('speaking');
  });

  it('pause flips status to paused even if SIGSTOP races with natural end', async () => {
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));

    await act(async () => {
      await result.current.speak('Hello world.');
    });

    await act(async () => {
      await result.current.pause();
    });

    expect(result.current.status).toBe('paused');
    expect(mockElectronAPI.pauseSpeech).toHaveBeenCalled();
  });

  it('setLiveRate skips the restart when rate is unchanged', async () => {
    const showError = setupShowError();
    const { result } = renderHook(() => useTextToSpeech({ showError }));

    await act(async () => {
      await result.current.speak('Hello world.', { rate: 200 });
    });
    const stopCallsBefore = mockElectronAPI.stopSpeech.mock.calls.length;

    await act(async () => {
      await result.current.setLiveRate(200);
    });

    expect(mockElectronAPI.stopSpeech.mock.calls.length).toBe(stopCallsBefore);
  });

  it('keeps speaking when tab stays the same', async () => {
    const showError = setupShowError();
    const { result, rerender } = renderHook(
      ({ activeTabId: id }: { activeTabId: string | null }) => useTextToSpeech({ showError, activeTabId: id }),
      { initialProps: { activeTabId: 'tab-1' as string | null } }
    );

    await act(async () => {
      await result.current.speak('Hello', { tabId: 'tab-1' });
    });
    expect(result.current.status).toBe('speaking');
    const stopCallsAfterSpeak = mockElectronAPI.stopSpeech.mock.calls.length;

    rerender({ activeTabId: 'tab-1' });
    expect(result.current.status).toBe('speaking');
    // Rerendering with the same tab id must not trigger an additional stop.
    expect(mockElectronAPI.stopSpeech.mock.calls.length).toBe(stopCallsAfterSpeak);
  });
});
