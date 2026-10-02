import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defocusExternalOpen, resetDefocusExternalOpenForTests } from './externalOpenDefocus';

interface MockDefocusApp {
  hide: ReturnType<typeof vi.fn>;
  show: ReturnType<typeof vi.fn>;
  onceHide: ReturnType<typeof vi.fn>;
  hideListener: (() => void) | null;
}

function makeApp(): MockDefocusApp {
  const app: MockDefocusApp = {
    hide: vi.fn(),
    show: vi.fn(),
    onceHide: vi.fn((listener: () => void) => {
      app.hideListener = listener;
    }),
    hideListener: null,
  };

  return app;
}

describe('defocusExternalOpen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDefocusExternalOpenForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetDefocusExternalOpenForTests();
  });

  it('does nothing on non-macOS platforms', () => {
    const app = makeApp();

    defocusExternalOpen({ app, platform: 'linux' });

    expect(app.onceHide).not.toHaveBeenCalled();
    expect(app.hide).not.toHaveBeenCalled();
    expect(app.show).not.toHaveBeenCalled();
  });

  it('hides on macOS and shows after the app hide event', () => {
    const app = makeApp();

    defocusExternalOpen({ app, platform: 'darwin' });
    expect(app.onceHide).toHaveBeenCalledWith(expect.any(Function));
    expect(app.hide).toHaveBeenCalledTimes(1);
    expect(app.show).not.toHaveBeenCalled();

    app.hideListener?.();

    expect(app.show).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(250);
    expect(app.show).toHaveBeenCalledTimes(1);
  });

  it('shows via fallback if the app hide event does not fire', () => {
    const app = makeApp();

    defocusExternalOpen({ app, platform: 'darwin', fallbackMs: 250 });
    vi.advanceTimersByTime(249);
    expect(app.show).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(app.show).toHaveBeenCalledTimes(1);
  });

  it('coalesces repeated external opens while defocus is in flight', () => {
    const app = makeApp();

    defocusExternalOpen({ app, platform: 'darwin' });
    defocusExternalOpen({ app, platform: 'darwin' });

    expect(app.onceHide).toHaveBeenCalledTimes(1);
    expect(app.hide).toHaveBeenCalledTimes(1);

    app.hideListener?.();
    defocusExternalOpen({ app, platform: 'darwin' });

    expect(app.onceHide).toHaveBeenCalledTimes(2);
    expect(app.hide).toHaveBeenCalledTimes(2);
  });
});
