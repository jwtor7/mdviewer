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

    rerender({ activeTabId: 'tab-1' });
    expect(result.current.status).toBe('speaking');
    expect(mockElectronAPI.stopSpeech).not.toHaveBeenCalled();
  });
});
