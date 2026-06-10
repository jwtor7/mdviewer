import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ReadAloudMenu } from './ReadAloudMenu';
import { mockElectronAPI } from '../test/setup';

const noop = (): void => undefined;

const renderMenu = (): ReturnType<typeof render> =>
  render(
    <ReadAloudMenu
      voice=""
      rate={200}
      onVoiceChange={noop}
      onRateChange={noop}
      onTestVoice={noop}
    />
  );

describe('ReadAloudMenu engine display', () => {
  beforeEach(() => {
    mockElectronAPI.listVoices.mockResolvedValue({ success: true, data: [] });
  });

  it('shows the static Kokoro voice label and hides the say picker when Kokoro is active', async () => {
    mockElectronAPI.getTTSEngineStatus.mockResolvedValue({
      success: true,
      data: { engine: 'kokoro' as const, voiceLabel: 'Heart (Kokoro)' },
    });

    renderMenu();

    await waitFor(() => {
      expect(screen.getByText('Heart (Kokoro)')).toBeInTheDocument();
    });
    expect(screen.getByText('macOS voice used if Kokoro is unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows the say voice picker when the engine is say', async () => {
    mockElectronAPI.getTTSEngineStatus.mockResolvedValue({
      success: true,
      data: { engine: 'say' as const, voiceLabel: '' },
    });

    renderMenu();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
    expect(screen.queryByText('macOS voice used if Kokoro is unavailable')).not.toBeInTheDocument();
  });

  it('keeps the say picker visible while engine status is unknown', () => {
    mockElectronAPI.getTTSEngineStatus.mockReturnValue(new Promise(() => { /* never resolves */ }));
    renderMenu();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
