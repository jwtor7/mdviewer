import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => '/mock/app'),
    getPath: vi.fn((name: string) => `/mock/${name}`),
  },
}));

const { spawnMock, fsMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  fsMock: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(() => [] as string[]),
    unlinkSync: vi.fn(),
    rmSync: vi.fn(),
  },
}));

vi.mock('node:child_process', () => {
  const spawn = (...args: unknown[]): unknown => spawnMock(...args);
  return { default: { spawn }, spawn };
});

vi.mock('node:fs', () => ({ default: fsMock, ...fsMock }));

import {
  speak,
  stopSpeech,
  pauseSpeech,
  resumeSpeech,
  setSpeechEndCallback,
  cleanupSpeech,
  probeWorker,
  isWorkerFailed,
  wpmToKokoroSpeed,
  KokoroUnavailableError,
  KokoroWorkerCrashedError,
  KOKORO_VOICE,
  __resetForTests,
  __getPlaybackState,
} from './kokoroEngine';

/** Minimal stand-in for a spawned child process. */
class FakeProc extends EventEmitter {
  stdout = new PassThrough({ encoding: 'utf8' });
  stderr = new PassThrough({ encoding: 'utf8' });
  stdin = new PassThrough({ encoding: 'utf8' });
  kill = vi.fn();
  setEncodingNoop(): void {
    // PassThrough already delivers strings via constructor encoding.
  }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Collect JSON-lines requests the engine wrote to the worker's stdin. */
const collectStdin = (proc: FakeProc): string[] => {
  const chunks: string[] = [];
  proc.stdout; // keep referenced
  proc.stdin.on('data', (c: string) => chunks.push(String(c)));
  return chunks;
};

const parseRequests = (chunks: string[]): Array<Record<string, unknown>> =>
  chunks
    .join('')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Record<string, unknown>);

describe('wpmToKokoroSpeed', () => {
  it('defaults to 200 wpm → ~1.11', () => {
    expect(wpmToKokoroSpeed(undefined)).toBeCloseTo(200 / 180, 5);
  });

  it('maps 180 wpm to exactly 1.0', () => {
    expect(wpmToKokoroSpeed(180)).toBe(1);
  });

  it('clamps slow rates to 0.5', () => {
    expect(wpmToKokoroSpeed(50)).toBe(0.5);
  });

  it('clamps fast rates to 2.0', () => {
    expect(wpmToKokoroSpeed(500)).toBe(2.0);
  });

  it('treats non-finite rates as the default', () => {
    expect(wpmToKokoroSpeed(Number.NaN)).toBeCloseTo(200 / 180, 5);
  });
});

describe('kokoroEngine', () => {
  let fakeWorker: FakeProc;
  let fakeAfplay: FakeProc;
  let stdinChunks: string[];

  beforeEach(() => {
    __resetForTests();
    spawnMock.mockReset();
    fsMock.existsSync.mockReturnValue(true);
    fsMock.unlinkSync.mockClear();
    fsMock.rmSync.mockClear();
    fakeWorker = new FakeProc();
    fakeAfplay = new FakeProc();
    stdinChunks = collectStdin(fakeWorker);
    spawnMock.mockImplementation((cmd: string) => (cmd === 'afplay' ? fakeAfplay : fakeWorker));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const becomeReady = async (): Promise<void> => {
    fakeWorker.stdout.write('{"type":"ready","version":1}\n');
    await flush();
  };

  const deliverResult = async (req: Record<string, unknown>): Promise<void> => {
    fakeWorker.stdout.write(
      `${JSON.stringify({ id: req.id, type: 'result', wavPath: req.outPath, durationSeconds: 1.2, sampleRate: 24000 })}\n`
    );
    await flush();
  };

  it('handshake: speaks after ready, plays via afplay, exit 0 fires natural', async () => {
    const ended: string[] = [];
    setSpeechEndCallback((reason) => ended.push(reason));

    const p = speak({ text: 'Hello world.', speed: 1.11 });
    await flush();
    await becomeReady();

    const requests = parseRequests(stdinChunks);
    expect(requests).toHaveLength(1);
    const req = requests[0];
    expect(req.type).toBe('synth');
    expect(req.text).toBe('Hello world.');
    expect(req.voice).toBe(KOKORO_VOICE);
    expect(req.speed).toBe(1.11);

    await deliverResult(req);
    await p; // resolves once afplay has spawned

    expect(spawnMock).toHaveBeenCalledWith('afplay', [req.outPath], expect.anything());
    expect(ended).toEqual([]);

    fakeAfplay.emit('exit', 0, null);
    expect(ended).toEqual(['natural']);
    expect(fsMock.unlinkSync).toHaveBeenCalledWith(req.outPath);
  });

  it('handshake: fatal message rejects with KokoroUnavailableError', async () => {
    const p = speak({ text: 'x', speed: 1 });
    await flush();
    fakeWorker.stdout.write('{"type":"fatal","error":"ModuleNotFoundError: kokoro_onnx"}\n');
    await expect(p).rejects.toBeInstanceOf(KokoroUnavailableError);
    expect(isWorkerFailed()).toBe(true);
  });

  it('handshake: ready timeout rejects with KokoroUnavailableError', async () => {
    vi.useFakeTimers();
    const p = speak({ text: 'x', speed: 1 });
    const assertion = expect(p).rejects.toBeInstanceOf(KokoroUnavailableError);
    await vi.advanceTimersByTimeAsync(30_001);
    await assertion;
    expect(isWorkerFailed()).toBe(true);
  });

  it('ignores non-JSON noise on stdout (onnxruntime diagnostics)', async () => {
    const p = speak({ text: 'Hi.', speed: 1 });
    await flush();
    fakeWorker.stdout.write('some onnxruntime warning\n');
    await becomeReady();
    fakeWorker.stdout.write('more noise mid-session\n');
    await flush();
    const [req] = parseRequests(stdinChunks);
    await deliverResult(req);
    await p;
    expect(spawnMock).toHaveBeenCalledWith('afplay', [req.outPath], expect.anything());
  });

  it('missing model files reject with KokoroUnavailableError without spawning', async () => {
    fsMock.existsSync.mockReturnValue(false);
    await expect(speak({ text: 'x', speed: 1 })).rejects.toBeInstanceOf(KokoroUnavailableError);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('stop during synthesis abandons the request: late result unlinks, no afplay, no callback', async () => {
    const ended: string[] = [];
    setSpeechEndCallback((reason) => ended.push(reason));

    const p = speak({ text: 'Slow sentence.', speed: 1 });
    await flush();
    await becomeReady();
    const [req] = parseRequests(stdinChunks);

    stopSpeech(); // user hits stop while model.create is running

    await deliverResult(req);
    await p; // resolves silently

    expect(spawnMock).not.toHaveBeenCalledWith('afplay', expect.anything(), expect.anything());
    expect(fsMock.unlinkSync).toHaveBeenCalledWith(req.outPath);
    expect(ended).toEqual([]);
  });

  it('pause during synthesis holds the wav; resume plays it', async () => {
    const ended: string[] = [];
    setSpeechEndCallback((reason) => ended.push(reason));

    const p = speak({ text: 'Paused mid-synth.', speed: 1 });
    await flush();
    await becomeReady();
    const [req] = parseRequests(stdinChunks);

    pauseSpeech(); // pause lands while synthesizing

    await deliverResult(req);
    await p;

    // Held, not played.
    expect(spawnMock).not.toHaveBeenCalledWith('afplay', expect.anything(), expect.anything());
    expect(__getPlaybackState().heldWav).toBe(req.outPath);

    resumeSpeech();
    expect(spawnMock).toHaveBeenCalledWith('afplay', [req.outPath], expect.anything());

    fakeAfplay.emit('exit', 0, null);
    expect(ended).toEqual(['natural']);
  });

  it('stop while paused-pending unlinks the held wav', async () => {
    const p = speak({ text: 'Held then stopped.', speed: 1 });
    await flush();
    await becomeReady();
    const [req] = parseRequests(stdinChunks);
    pauseSpeech();
    await deliverResult(req);
    await p;
    expect(__getPlaybackState().heldWav).toBe(req.outPath);

    stopSpeech();
    expect(__getPlaybackState().heldWav).toBeNull();
    expect(fsMock.unlinkSync).toHaveBeenCalledWith(req.outPath);
    expect(spawnMock).not.toHaveBeenCalledWith('afplay', expect.anything(), expect.anything());
  });

  it('pause/resume while playing uses SIGSTOP/SIGCONT on afplay', async () => {
    const p = speak({ text: 'Playing.', speed: 1 });
    await flush();
    await becomeReady();
    const [req] = parseRequests(stdinChunks);
    await deliverResult(req);
    await p;

    pauseSpeech();
    expect(fakeAfplay.kill).toHaveBeenCalledWith('SIGSTOP');
    expect(__getPlaybackState().paused).toBe(true);

    resumeSpeech();
    expect(fakeAfplay.kill).toHaveBeenCalledWith('SIGCONT');
    expect(__getPlaybackState().paused).toBe(false);
  });

  it('stop while paused sends SIGCONT before SIGTERM and fires no callback', async () => {
    const ended: string[] = [];
    setSpeechEndCallback((reason) => ended.push(reason));

    const p = speak({ text: 'Playing.', speed: 1 });
    await flush();
    await becomeReady();
    const [req] = parseRequests(stdinChunks);
    await deliverResult(req);
    await p;

    pauseSpeech();
    stopSpeech();

    const killCalls = fakeAfplay.kill.mock.calls.map((c) => c[0]);
    expect(killCalls).toEqual(['SIGSTOP', 'SIGCONT', 'SIGTERM']);

    // The untracked exit must not fire a callback.
    fakeAfplay.emit('exit', null, 'SIGTERM');
    expect(ended).toEqual([]);
  });

  it('worker crash rejects the pending request and disables the engine', async () => {
    const p = speak({ text: 'Crash victim.', speed: 1 });
    await flush();
    await becomeReady();
    parseRequests(stdinChunks); // request is in flight

    fakeWorker.emit('exit', 1, null);
    await expect(p).rejects.toBeInstanceOf(KokoroWorkerCrashedError);
    expect(isWorkerFailed()).toBe(true);

    // No auto-restart: the next speak rejects immediately.
    await expect(speak({ text: 'After crash.', speed: 1 })).rejects.toBeInstanceOf(KokoroWorkerCrashedError);
    expect(spawnMock).toHaveBeenCalledTimes(1); // only the original worker spawn
  });

  it('synth error response rejects speak so the dispatcher can fall back', async () => {
    const p = speak({ text: 'Bad input.', speed: 1 });
    await flush();
    await becomeReady();
    const [req] = parseRequests(stdinChunks);
    fakeWorker.stdout.write(`${JSON.stringify({ id: req.id, type: 'error', error: 'boom' })}\n`);
    await expect(p).rejects.toThrow('boom');
  });

  it('probeWorker memoizes: second probe resolves without a second spawn', async () => {
    const p1 = probeWorker();
    await flush();
    await becomeReady();
    await p1;
    await probeWorker();
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it('prefetches nextText while playing and serves the next speak from cache', async () => {
    const p1 = speak({ text: 'One.', speed: 1, nextText: 'Two.' });
    await flush();
    await becomeReady();
    const [req1] = parseRequests(stdinChunks);
    expect(req1.text).toBe('One.');
    await deliverResult(req1);
    await p1;

    // The engine queued a background synth for the upcoming sentence.
    await flush();
    const requests = parseRequests(stdinChunks);
    expect(requests).toHaveLength(2);
    const req2 = requests[1];
    expect(req2.text).toBe('Two.');
    await deliverResult(req2);

    // Next sentence: cache hit — afplay starts without a third synth request.
    await speak({ text: 'Two.', speed: 1 });
    expect(spawnMock).toHaveBeenCalledWith('afplay', [req2.outPath], expect.anything());
    expect(parseRequests(stdinChunks).filter((r) => r.type === 'synth')).toHaveLength(2);
  });

  it('a different speed misses the prefetch cache and re-synthesizes', async () => {
    const p1 = speak({ text: 'One.', speed: 1, nextText: 'Two.' });
    await flush();
    await becomeReady();
    const [req1] = parseRequests(stdinChunks);
    await deliverResult(req1);
    await p1;
    await flush();
    const req2 = parseRequests(stdinChunks)[1];
    await deliverResult(req2);

    // User dragged the rate slider — the key no longer matches.
    const p2 = speak({ text: 'Two.', speed: 1.5 });
    await flush();
    const synths = parseRequests(stdinChunks).filter((r) => r.type === 'synth');
    expect(synths).toHaveLength(3);
    expect(synths[2].speed).toBe(1.5);
    // The stale cached wav was discarded.
    expect(fsMock.unlinkSync).toHaveBeenCalledWith(req2.outPath);
    await deliverResult(synths[2]);
    await p2;
  });

  it('stop clears the prefetch cache', async () => {
    const p1 = speak({ text: 'One.', speed: 1, nextText: 'Two.' });
    await flush();
    await becomeReady();
    const [req1] = parseRequests(stdinChunks);
    await deliverResult(req1);
    await p1;
    await flush();
    const req2 = parseRequests(stdinChunks)[1];
    await deliverResult(req2);

    stopSpeech();
    expect(fsMock.unlinkSync).toHaveBeenCalledWith(req2.outPath);
  });

  it('cleanup sends shutdown and removes the temp dir', async () => {
    const p = probeWorker();
    await flush();
    await becomeReady();
    await p;

    cleanupSpeech();
    await flush();

    const requests = parseRequests(stdinChunks);
    expect(requests).toContainEqual({ type: 'shutdown' });
    expect(fsMock.rmSync).toHaveBeenCalledWith(
      expect.stringContaining('mdviewer-tts'),
      { recursive: true, force: true }
    );
  });
});
