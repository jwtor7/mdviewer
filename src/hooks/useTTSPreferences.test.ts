import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTTSPreferences, TTS_RATE_BOUNDS } from './useTTSPreferences';

describe('useTTSPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to empty voice and default rate on first load', () => {
    const { result } = renderHook(() => useTTSPreferences());
    expect(result.current.voice).toBe('');
    expect(result.current.rate).toBe(TTS_RATE_BOUNDS.DEFAULT);
  });

  it('persists voice changes to localStorage', () => {
    const { result } = renderHook(() => useTTSPreferences());
    act(() => result.current.setVoice('Samantha'));
    expect(result.current.voice).toBe('Samantha');
    expect(localStorage.getItem('mdviewer-tts-voice')).toBe('Samantha');
  });

  it('removes the storage key when voice is cleared', () => {
    localStorage.setItem('mdviewer-tts-voice', 'Alex');
    const { result } = renderHook(() => useTTSPreferences());
    expect(result.current.voice).toBe('Alex');
    act(() => result.current.setVoice(''));
    expect(localStorage.getItem('mdviewer-tts-voice')).toBeNull();
  });

  it('clamps rate changes to the valid range', () => {
    const { result } = renderHook(() => useTTSPreferences());
    act(() => result.current.setRate(10));
    expect(result.current.rate).toBe(TTS_RATE_BOUNDS.MIN);
    act(() => result.current.setRate(10_000));
    expect(result.current.rate).toBe(TTS_RATE_BOUNDS.MAX);
    act(() => result.current.setRate(175));
    expect(result.current.rate).toBe(175);
  });

  it('restores previously stored preferences on mount', () => {
    localStorage.setItem('mdviewer-tts-voice', 'Samantha');
    localStorage.setItem('mdviewer-tts-rate', JSON.stringify(260));
    const { result } = renderHook(() => useTTSPreferences());
    expect(result.current.voice).toBe('Samantha');
    expect(result.current.rate).toBe(260);
  });
});
