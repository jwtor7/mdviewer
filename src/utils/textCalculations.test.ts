/**
 * Unit tests for text calculation utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateTextStats, type TextStats } from './textCalculations';
import { CALCULATIONS } from '../constants/index';

describe('calculateTextStats', () => {
  it('should calculate stats for empty string', () => {
    const result = calculateTextStats('');

    expect(result).toEqual({
      wordCount: 0,
      charCount: 0,
      tokenCount: 0,
    });
  });

  it('should calculate stats for whitespace-only string', () => {
    const result = calculateTextStats('   \n\t  ');

    expect(result).toEqual({
      wordCount: 0,
      charCount: 7,
      tokenCount: Math.ceil(7 / CALCULATIONS.TOKEN_ESTIMATE_DIVISOR),
    });
  });

  it('should calculate stats for single word', () => {
    const result = calculateTextStats('Hello');

    expect(result).toEqual({
      wordCount: 1,
      charCount: 5,
      tokenCount: Math.ceil(5 / CALCULATIONS.TOKEN_ESTIMATE_DIVISOR),
    });
  });

  it('should calculate stats for multiple words', () => {
    const text = 'Hello world from mdviewer';
    const result = calculateTextStats(text);

    expect(result).toEqual({
      wordCount: 4,
      charCount: text.length,
      tokenCount: Math.ceil(text.length / CALCULATIONS.TOKEN_ESTIMATE_DIVISOR),
    });
  });

  it('should calculate stats for text with multiple spaces', () => {
    const text = 'Hello    world  \n\n  test';
    const result = calculateTextStats(text);

    expect(result.wordCount).toBe(3);
    expect(result.charCount).toBe(text.length);
  });

  it('should calculate stats for markdown content', () => {
    const markdown = `# Heading

This is a **bold** paragraph with *italic* text.

- List item 1
- List item 2

\`\`\`javascript
const x = 5;
\`\`\``;

    const result = calculateTextStats(markdown);

    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.charCount).toBe(markdown.length);
    expect(result.tokenCount).toBe(Math.ceil(markdown.length / CALCULATIONS.TOKEN_ESTIMATE_DIVISOR));
  });

  it('should handle special characters', () => {
    const text = 'Hello @world #hashtag $money';
    const result = calculateTextStats(text);

    expect(result.wordCount).toBe(4);
    expect(result.charCount).toBe(text.length);
  });

  it('should correctly estimate tokens', () => {
    const text = '1234'; // Exactly divisor length
    const result = calculateTextStats(text);

    expect(result.tokenCount).toBe(1);
  });

  it('should round up token count', () => {
    const text = '12345'; // One more than divisor
    const result = calculateTextStats(text);

    expect(result.tokenCount).toBe(2);
  });

  it('should handle unicode characters', () => {
    const text = 'Hello 世界 🌍';
    const result = calculateTextStats(text);

    expect(result.wordCount).toBe(3);
    expect(result.charCount).toBe(text.length);
    expect(result.tokenCount).toBeGreaterThan(0);
  });

  it('should return correct TypeScript types', () => {
    const result: TextStats = calculateTextStats('test');

    expect(typeof result.wordCount).toBe('number');
    expect(typeof result.charCount).toBe('number');
    expect(typeof result.tokenCount).toBe('number');
  });

  it('should handle very long text efficiently', () => {
    const longText = 'word '.repeat(10000);
    const result = calculateTextStats(longText);

    expect(result.wordCount).toBe(10000);
    expect(result.charCount).toBe(longText.length);
  });
});
