import { describe, it, expect } from 'vitest';
import { parseVoicesOutput } from './tts';

describe('parseVoicesOutput', () => {
  it('parses a standard `say -v ?` output block', () => {
    const sample = [
      'Alex                en_US    # Most people recognize me by my voice.',
      'Samantha            en_US    # Hello, my name is Samantha.',
      'Thomas              fr_FR    # Bonjour, je m’appelle Thomas.',
      '',
    ].join('\n');
    const result = parseVoicesOutput(sample);
    expect(result).toHaveLength(3);
    expect(result.find(v => v.name === 'Alex')).toMatchObject({
      name: 'Alex',
      language: 'en_US',
    });
    expect(result.find(v => v.name === 'Thomas')?.language).toBe('fr_FR');
  });

  it('sorts voices by language then name', () => {
    const sample = [
      'Samantha            en_US    # Hello.',
      'Alex                en_US    # Hi.',
      'Thomas              fr_FR    # Bonjour.',
    ].join('\n');
    const result = parseVoicesOutput(sample);
    expect(result.map(v => v.name)).toEqual(['Alex', 'Samantha', 'Thomas']);
  });

  it('handles dash-separated locale codes (en-US → en_US)', () => {
    const sample = 'Alex                en-US    # Hi.';
    const result = parseVoicesOutput(sample);
    expect(result[0].language).toBe('en_US');
  });

  it('preserves sample phrase when present', () => {
    const sample = 'Alex                en_US    # Most people recognize me by my voice.';
    const result = parseVoicesOutput(sample);
    expect(result[0].sampleText).toBe('Most people recognize me by my voice.');
  });

  it('returns empty array for empty input', () => {
    expect(parseVoicesOutput('')).toEqual([]);
    expect(parseVoicesOutput('\n\n')).toEqual([]);
  });

  it('skips lines that do not match the expected voice format', () => {
    const sample = [
      'Alex                en_US    # Hi.',
      '-- partial --',
      'Samantha            en_US    # Hello.',
    ].join('\n');
    const result = parseVoicesOutput(sample);
    expect(result).toHaveLength(2);
  });
});
