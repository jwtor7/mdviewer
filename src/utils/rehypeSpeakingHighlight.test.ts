import { describe, it, expect } from 'vitest';
import { createRehypeSpeakingHighlight } from './rehypeSpeakingHighlight';

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const buildTree = (): HastNode => ({
  type: 'root',
  children: [
    {
      type: 'element',
      tagName: 'p',
      properties: { dataSourceStart: 0, dataSourceEnd: 10 },
      children: [{ type: 'text', value: 'First' }],
    },
    {
      type: 'element',
      tagName: 'p',
      properties: { dataSourceStart: 12, dataSourceEnd: 24 },
      children: [{ type: 'text', value: 'Second' }],
    },
    {
      type: 'element',
      tagName: 'p',
      properties: { dataSourceStart: 26, dataSourceEnd: 40 },
      children: [{ type: 'text', value: 'Third' }],
    },
  ],
});

describe('createRehypeSpeakingHighlight', () => {
  it('returns no-op plugin when start/end are null', () => {
    const plugin = createRehypeSpeakingHighlight({ start: null, end: null })();
    expect(plugin).toBeUndefined();
  });

  it('highlights the element whose source range contains the offset', () => {
    const tree = buildTree();
    const plugin = createRehypeSpeakingHighlight({ start: 14, end: 20 })();
    plugin?.(tree);
    const [first, second, third] = tree.children ?? [];
    expect(first.properties?.className).toBeUndefined();
    expect(second.properties?.className).toEqual(['tts-speaking']);
    expect(third.properties?.className).toBeUndefined();
  });

  it('highlights multiple overlapping elements', () => {
    const tree = buildTree();
    const plugin = createRehypeSpeakingHighlight({ start: 5, end: 30 })();
    plugin?.(tree);
    const [first, second, third] = tree.children ?? [];
    expect(first.properties?.className).toEqual(['tts-speaking']);
    expect(second.properties?.className).toEqual(['tts-speaking']);
    expect(third.properties?.className).toEqual(['tts-speaking']);
  });

  it('preserves existing className strings', () => {
    const tree: HastNode = {
      type: 'root',
      children: [{
        type: 'element',
        tagName: 'p',
        properties: { dataSourceStart: 0, dataSourceEnd: 10, className: 'existing' },
        children: [],
      }],
    };
    const plugin = createRehypeSpeakingHighlight({ start: 2, end: 5 })();
    plugin?.(tree);
    expect(tree.children?.[0].properties?.className).toBe('existing tts-speaking');
  });

  it('uses a custom className when provided', () => {
    const tree = buildTree();
    const plugin = createRehypeSpeakingHighlight({ start: 14, end: 20, className: 'my-class' })();
    plugin?.(tree);
    expect(tree.children?.[1].properties?.className).toEqual(['my-class']);
  });

  it('skips elements that lack data-source-* attributes', () => {
    const tree: HastNode = {
      type: 'root',
      children: [{
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [],
      }],
    };
    const plugin = createRehypeSpeakingHighlight({ start: 0, end: 100 })();
    plugin?.(tree);
    expect(tree.children?.[0].properties?.className).toBeUndefined();
  });
});
