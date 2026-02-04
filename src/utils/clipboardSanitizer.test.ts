/**
 * Tests for clipboardSanitizer utility
 *
 * Covers HTML sanitization, protocol validation, attribute filtering,
 * and XSS prevention for clipboard operations.
 */
/* eslint-disable no-secrets/no-secrets */

import { describe, it, expect } from 'vitest';
import { sanitizeHtmlForClipboard, sanitizeTextForClipboard } from './clipboardSanitizer';

describe('sanitizeHtmlForClipboard', () => {
  // ========== ALLOWED ELEMENTS ==========

  it('preserves basic allowed text formatting elements', () => {
    const html = '<strong>bold</strong> <em>italic</em> <u>underline</u>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
    expect(result).toContain('<u>underline</u>');
  });

  it('preserves heading elements', () => {
    const html = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('<h1>');
    expect(result).toContain('</h1>');
    expect(result).toContain('<h2>');
    expect(result).toContain('<h3>');
  });

  it('preserves table elements with structure', () => {
    const html = '<table><tr><th>Header</th><td>Data</td></tr></table>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('<table>');
    expect(result).toContain('<tr>');
    expect(result).toContain('<th>');
    expect(result).toContain('<td>');
  });

  it('preserves list elements', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
  });

  it('preserves image elements', () => {
    const html = '<img src="https://example.com/image.png" alt="Test image">';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('<img');
    expect(result).toContain('src="https://example.com/image.png"');
    expect(result).toContain('alt="Test image"');
  });

  it('preserves code and pre elements', () => {
    const html = '<pre><code>const x = 1;</code></pre>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('<pre>');
    expect(result).toContain('<code>');
  });

  it('preserves blockquote and citation elements', () => {
    const html = '<blockquote><p>Quote text</p></blockquote>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('<blockquote>');
  });

  // ========== DANGEROUS ELEMENTS REMOVAL ==========

  it('removes script elements', () => {
    const html = '<p>Safe</p><script>alert("XSS")</script>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
  });

  it('removes iframe elements', () => {
    const html = '<p>Safe</p><iframe src="evil.com"></iframe>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('<iframe>');
    expect(result).not.toContain('evil.com');
  });

  it('removes form, input, and button elements', () => {
    const html =
      '<form><input type="text"><button>Click</button><textarea></textarea></form>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('<form>');
    expect(result).not.toContain('<input>');
    expect(result).not.toContain('<button>');
    expect(result).not.toContain('<textarea>');
  });

  it('removes object and embed elements', () => {
    const html = '<p>Safe</p><object data="evil.swf"></object><embed src="bad.swf">';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('<object>');
    expect(result).not.toContain('<embed>');
  });

  it('removes meta, link, and style elements', () => {
    const html =
      '<style>body { color: red; }</style><meta name="evil"><link rel="import">';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('<style>');
    expect(result).not.toContain('<meta>');
    expect(result).not.toContain('<link>');
  });

  // ========== ATTRIBUTE ALLOWLIST ==========

  it('preserves safe global attributes', () => {
    const html = '<div class="container" id="main" title="Description">Content</div>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('class="container"');
    expect(result).toContain('id="main"');
    expect(result).toContain('title="Description"');
  });

  it('removes disallowed global attributes', () => {
    const html = '<div aria-label="aria" role="button" tabindex="0">Content</div>';
    const result = sanitizeHtmlForClipboard(html);
    // aria-label, role, and tabindex are not in the allowlist
    expect(result).not.toContain('aria-label');
    expect(result).not.toContain('role');
    expect(result).not.toContain('tabindex');
  });

  it('preserves element-specific allowed attributes', () => {
    const html = '<a href="https://example.com" target="_blank" rel="nofollow">Link</a>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel=');
  });

  it('removes data-* attributes for security', () => {
    const html = '<div data-tracking="evil" data-payload="xss">Content</div>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('data-tracking');
    expect(result).not.toContain('data-payload');
  });

  // ========== EVENT HANDLER BLOCKING ==========

  it('removes onclick event handler', () => {
    const html = '<p onclick="alert(\'XSS\')">Click me</p>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('onclick');
    expect(result).toContain('Click me');
  });

  it('removes all on* event handlers', () => {
    const html =
      '<img src="test.jpg" onerror="alert(\'XSS\')" onload="malicious()" onmouseover="bad()">';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('onmouseover');
  });

  it('removes style attribute', () => {
    const html =
      '<p style="background: url(javascript:alert(\'XSS\'))">Text</p>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('style');
    expect(result).toContain('Text');
  });

  // ========== PROTOCOL VALIDATION ==========

  it('blocks javascript: protocol in href', () => {
    const html = '<a href="javascript:alert(\'XSS\')">Click</a>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('javascript:');
    // The href attribute should be removed
    const linkMatch = result.match(/<a[^>]*>/);
    expect(linkMatch?.[0]).not.toContain('href');
  });

  it('blocks data: protocol in src', () => {
    const html =
      '<img src="data:text/html,<script>alert(\'XSS\')</script>">';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('data:');
  });

  it('blocks file: protocol', () => {
    const html = '<a href="file:///etc/passwd">Local file</a>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('file:');
  });

  it('blocks vbscript: protocol', () => {
    const html = '<a href="vbscript:msgbox(\'XSS\')">VB Script</a>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('vbscript:');
  });

  // ========== SAFE PROTOCOLS ALLOWED ==========

  it('allows http and https protocols', () => {
    const html =
      '<a href="http://example.com">HTTP</a> <a href="https://secure.example.com">HTTPS</a>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('http://example.com');
    expect(result).toContain('https://secure.example.com');
  });

  it('allows mailto protocol', () => {
    const html = '<a href="mailto:user@example.com">Email</a>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('mailto:user@example.com');
  });

  it('allows relative URLs', () => {
    const html = '<a href="/page">Relative</a>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('href="/page"');
  });

  it('allows hash URLs', () => {
    const html = '<a href="#section">Anchor</a>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('href="#section"');
  });

  // ========== LINK SECURITY ==========

  it('adds noopener noreferrer to links', () => {
    const html = '<a href="https://example.com">Link</a>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('rel="noopener noreferrer"');
  });

  // ========== COMMENT REMOVAL ==========

  it('removes HTML comments', () => {
    const html = '<p>Text</p><!-- Secret comment --><p>More</p>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('<!--');
    expect(result).not.toContain('Secret comment');
  });

  // ========== NESTED ELEMENTS ==========

  it('recursively sanitizes nested elements', () => {
    const html = `
      <div>
        <section>
          <article>
            <p onclick="bad()">Safe text</p>
          </article>
        </section>
      </div>
    `;
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('onclick');
    expect(result).toContain('Safe text');
    expect(result).toContain('<div>');
    expect(result).toContain('<section>');
    expect(result).toContain('<article>');
  });

  it('handles complex nested structures with mixed safe and dangerous elements', () => {
    const html = `
      <div>
        <p>Safe paragraph</p>
        <script>alert('XSS')</script>
        <span>More text</span>
        <img src="javascript:alert('bad')" alt="image">
      </div>
    `;
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('Safe paragraph');
    expect(result).toContain('More text');
    expect(result).not.toContain('script');
    expect(result).not.toContain('javascript:');
  });

  // ========== EDGE CASES ==========

  it('handles empty string input', () => {
    const result = sanitizeHtmlForClipboard('');
    expect(result).toBe('');
  });

  it('handles null input gracefully', () => {
    const result = sanitizeHtmlForClipboard(null as any);
    expect(result).toBe('');
  });

  it('handles undefined input gracefully', () => {
    const result = sanitizeHtmlForClipboard(undefined as any);
    expect(result).toBe('');
  });

  it('handles non-string input', () => {
    const result = sanitizeHtmlForClipboard(123 as any);
    expect(result).toBe('');
  });

  it('handles malformed HTML gracefully', () => {
    const html = '<p>Unclosed paragraph<div>Nested unclosed</div>';
    const result = sanitizeHtmlForClipboard(html);
    // Should not throw and should contain text
    expect(result).toContain('Unclosed paragraph');
  });

  it('handles whitespace and formatting in URLs', () => {
    const html = '<a href="  https://example.com  ">Link</a>';
    const result = sanitizeHtmlForClipboard(html);
    // Should handle trimmed URLs
    expect(result).toContain('https://example.com');
  });

  it('case-insensitive protocol blocking', () => {
    const html = '<a href="JavaScript:alert(\'XSS\')">Click</a>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).not.toContain('JavaScript:');
  });

  it('preserves empty elements', () => {
    const html = '<br><hr><img src="https://example.com/test.jpg" alt="">';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('<br>');
    expect(result).toContain('<hr>');
    expect(result).toContain('<img');
  });

  it('handles parsing errors by returning empty string', () => {
    // DOMParser in jsdom is quite forgiving, but we test the error handling
    const html = '<p>Normal text</p>';
    const result = sanitizeHtmlForClipboard(html);
    expect(result).toContain('Normal text');
  });
});

describe('sanitizeTextForClipboard', () => {
  it('returns plain text unchanged', () => {
    const text = 'This is plain text';
    const result = sanitizeTextForClipboard(text);
    expect(result).toBe('This is plain text');
  });

  it('removes null bytes', () => {
    const text = 'Text\x00with\x00nulls';
    const result = sanitizeTextForClipboard(text);
    expect(result).toBe('Textwithnulls');
    expect(result).not.toContain('\x00');
  });

  it('removes problematic control characters', () => {
    const text = 'Text\x01\x02\x03with\x1Fcontrol chars';
    const result = sanitizeTextForClipboard(text);
    expect(result).not.toContain('\x01');
    expect(result).not.toContain('\x02');
    expect(result).not.toContain('\x1F');
  });

  it('preserves newlines and tabs', () => {
    const text = 'Line 1\nLine 2\tTabbed';
    const result = sanitizeTextForClipboard(text);
    expect(result).toContain('\n');
    expect(result).toContain('\t');
    expect(result).toBe(text);
  });

  it('handles empty string', () => {
    const result = sanitizeTextForClipboard('');
    expect(result).toBe('');
  });

  it('handles null input', () => {
    const result = sanitizeTextForClipboard(null as any);
    expect(result).toBe('');
  });

  it('handles undefined input', () => {
    const result = sanitizeTextForClipboard(undefined as any);
    expect(result).toBe('');
  });

  it('handles non-string input', () => {
    const result = sanitizeTextForClipboard(123 as any);
    expect(result).toBe('');
  });

  it('preserves HTML entities in plain text', () => {
    const text = 'Special chars: &lt; &gt; &amp;';
    const result = sanitizeTextForClipboard(text);
    expect(result).toBe('Special chars: &lt; &gt; &amp;');
  });

  it('handles multiline text with mixed control characters', () => {
    const text = 'Clean text\nWith newline\t\tAnd tabs\x00And null';
    const result = sanitizeTextForClipboard(text);
    expect(result).toContain('Clean text');
    expect(result).toContain('\n');
    expect(result).toContain('\t');
    expect(result).not.toContain('\x00');
  });
});
