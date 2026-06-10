import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EndCallback } from './types';

vi.mock('./sayEngine.js', () => ({
  startSpeech: vi.fn(),
  stopSpeech: vi.fn(),
  pauseSpeech: vi.fn(),
  resumeSpeech: vi.fn(),
  setSpeechEndCallback: vi.fn(),
  listVoices: vi.fn(async () => []),
  cleanupSpeech: vi.fn(),
}));

vi.mock('./kokoroEngine.js', () => ({
  speak: vi.fn(async () => undefined),
  stopSpeech: vi.fn(),
  pauseSpeech: vi.fn(),
  resumeSpeech: vi.fn(),
  setSpeechEndCallback: vi.fn(),
  cleanupSpeech: vi.fn(),
  probeWorker: vi.fn(async () => undefined),
  wpmToKokoroSpeed: vi.fn((wpm?: number) => Math.min(2, Math.max(0.5, (wpm ?? 200) / 180))),
  KOKORO_VOICE_LABEL: 'Heart (Kokoro)',
}));

import * as sayEngine from './sayEngine.js';
import * as kokoroEngine from './kokoroEngine.js';
import {
  startSpeech,
  stopSpeech,
  pauseSpeech,
  resumeSpeech,
  setSpeechEndCallback,
  setEngineNotificationCallback,
  getEngineStatus,
  __resetDispatcherForTests,
  __getDispatcherState,
} from './index.js';

const sayMock = vi.mocked(sayEngine);
const kokoroMock = vi.mocked(kokoroEngine);

// The dispatcher registers one forwarder per engine at module load.
const sayForwarder = sayMock.setSpeechEndCallback.mock.calls[0][0] as EndCallback;
const kokoroForwarder = kokoroMock.setSpeechEndCallback.mock.calls[0][0] as EndCallback;

describe('tts dispatcher', () => {
  beforeEach(() => {
    __resetDispatcherForTests();
    sayMock.startSpeech.mockClear();
    sayMock.stopSpeech.mockClear();
    sayMock.pauseSpeech.mockClear();
    sayMock.resumeSpeech.mockClear();
    kokoroMock.speak.mockClear().mockResolvedValue(undefined);
    kokoroMock.stopSpeech.mockClear();
    kokoroMock.pauseSpeech.mockClear();
    kokoroMock.resumeSpeech.mockClear();
    kokoroMock.probeWorker.mockClear().mockResolvedValue(undefined);
    kokoroMock.wpmToKokoroSpeed.mockClear();
  });

  it('happy path: speaks via kokoro with mapped speed, never touching say', async () => {
    await startSpeech({ text: 'Hello.', voice: 'Samantha', rate: 200 });

    expect(kokoroMock.speak).toHaveBeenCalledWith({
      text: 'Hello.',
      speed: 200 / 180,
      nextText: undefined,
    });
    expect(sayMock.startSpeech).not.toHaveBeenCalled();
    expect(__getDispatcherState().currentEngine).toBe('kokoro');
  });

  it('voice is passed only to sayEngine, never to kokoro', async () => {
    kokoroMock.speak.mockRejectedValueOnce(new Error('model missing'));
    await startSpeech({ text: 'Hello.', voice: 'Samantha', rate: 180 });

    const kokoroArg = kokoroMock.speak.mock.calls[0][0];
    expect(kokoroArg).not.toHaveProperty('voice');
    expect(sayMock.startSpeech).toHaveBeenCalledWith({ text: 'Hello.', voice: 'Samantha', rate: 180 });
  });

  it('kokoro failure falls back to say and fires the notification once', async () => {
    const notifications: unknown[] = [];
    setEngineNotificationCallback((status) => notifications.push(status));

    kokoroMock.speak.mockRejectedValueOnce(new Error('worker died'));
    await startSpeech({ text: 'One.', rate: 200 });

    expect(sayMock.startSpeech).toHaveBeenCalledWith({ text: 'One.', rate: 200 });
    expect(notifications).toEqual([{ engine: 'say', voiceLabel: '' }]);
    expect(__getDispatcherState()).toMatchObject({ currentEngine: 'say', kokoroDisabled: true });

    // Subsequent sentences go straight to say — kokoro is not retried and
    // the notification does not repeat.
    await startSpeech({ text: 'Two.', rate: 200 });
    expect(kokoroMock.speak).toHaveBeenCalledTimes(1);
    expect(sayMock.startSpeech).toHaveBeenCalledTimes(2);
    expect(notifications).toHaveLength(1);
  });

  it('stop during kokoro synthesis does not fall back and start speaking', async () => {
    let rejectSpeak: (err: Error) => void = () => undefined;
    kokoroMock.speak.mockImplementationOnce(
      () => new Promise<void>((_, reject) => { rejectSpeak = reject; })
    );

    const p = startSpeech({ text: 'Long sentence.', rate: 200 });
    stopSpeech(); // user stops while synthesis is in flight
    rejectSpeak(new Error('abandoned'));
    await p;

    expect(sayMock.startSpeech).not.toHaveBeenCalled();
    // A user stop is not an engine failure — kokoro stays enabled.
    expect(__getDispatcherState().kokoroDisabled).toBe(false);
  });

  it('a new startSpeech superseding a failing one does not double-speak', async () => {
    let rejectSpeak: (err: Error) => void = () => undefined;
    kokoroMock.speak.mockImplementationOnce(
      () => new Promise<void>((_, reject) => { rejectSpeak = reject; })
    );

    const first = startSpeech({ text: 'First.', rate: 200 });
    const second = startSpeech({ text: 'Second.', rate: 200 }); // user restarted
    rejectSpeak(new Error('late failure'));
    await first;
    await second;

    // The stale failure must not trigger a say fallback for "First."
    expect(sayMock.startSpeech).not.toHaveBeenCalled();
    expect(kokoroMock.speak).toHaveBeenCalledTimes(2);
  });

  it('consecutive sentences never stop the kokoro engine (prefetch survives)', async () => {
    await startSpeech({ text: 'One.', rate: 200, nextText: 'Two.' });
    await startSpeech({ text: 'Two.', rate: 200 });

    // kokoroEngine.speak replaces utterances itself; calling its stopSpeech
    // between sentences would wipe the prefetch cache for the very sentence
    // about to play.
    expect(kokoroMock.stopSpeech).not.toHaveBeenCalled();
    expect(kokoroMock.speak).toHaveBeenCalledTimes(2);
  });

  it('stopSpeech stops both engines', () => {
    stopSpeech();
    expect(sayMock.stopSpeech).toHaveBeenCalled();
    expect(kokoroMock.stopSpeech).toHaveBeenCalled();
  });

  it('pause/resume route to the engine that owns the utterance', async () => {
    await startSpeech({ text: 'Kokoro speaking.', rate: 200 });
    pauseSpeech();
    resumeSpeech();
    expect(kokoroMock.pauseSpeech).toHaveBeenCalledTimes(1);
    expect(kokoroMock.resumeSpeech).toHaveBeenCalledTimes(1);
    expect(sayMock.pauseSpeech).not.toHaveBeenCalled();

    kokoroMock.speak.mockRejectedValueOnce(new Error('down'));
    await startSpeech({ text: 'Say speaking.', rate: 200 });
    pauseSpeech();
    resumeSpeech();
    expect(sayMock.pauseSpeech).toHaveBeenCalledTimes(1);
    expect(sayMock.resumeSpeech).toHaveBeenCalledTimes(1);
  });

  it('end events forward only from the engine that owns the utterance', async () => {
    const ended: string[] = [];
    setSpeechEndCallback((reason) => ended.push(reason));

    await startSpeech({ text: 'Kokoro owns this.', rate: 200 });
    sayForwarder('natural'); // late say exit must not advance the loop
    expect(ended).toEqual([]);
    kokoroForwarder('natural');
    expect(ended).toEqual(['natural']);
  });

  it('getEngineStatus probes the worker and reports kokoro when available', async () => {
    await expect(getEngineStatus()).resolves.toEqual({
      engine: 'kokoro',
      voiceLabel: 'Heart (Kokoro)',
    });
    expect(kokoroMock.probeWorker).toHaveBeenCalledTimes(1);
  });

  it('getEngineStatus disables kokoro and notifies when the probe fails', async () => {
    const notifications: unknown[] = [];
    setEngineNotificationCallback((status) => notifications.push(status));
    kokoroMock.probeWorker.mockRejectedValueOnce(new Error('no model'));

    await expect(getEngineStatus()).resolves.toEqual({ engine: 'say', voiceLabel: '' });
    expect(__getDispatcherState().kokoroDisabled).toBe(true);
    expect(notifications).toHaveLength(1);

    // Subsequent narration goes straight to say without retrying kokoro.
    await startSpeech({ text: 'After failed probe.', rate: 200 });
    expect(kokoroMock.speak).not.toHaveBeenCalled();
    expect(sayMock.startSpeech).toHaveBeenCalled();
  });
});
