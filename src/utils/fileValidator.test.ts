/**
 * Unit tests for file validation utility
 * Tests UTF-8 validation, BOM stripping, binary detection, and file integrity checks
 */

import { describe, it, expect } from 'vitest';
import { validateFileContent, type FileValidationResult } from './fileValidator';
import { FILE_INTEGRITY, SECURITY_CONFIG } from '../constants/index';

describe('validateFileContent', () => {
  // Helper to create buffers with specific byte sequences
  const bufferFromBytes = (bytes: number[]): Buffer => Buffer.from(bytes);

  describe('Valid UTF-8 sequences', () => {
    it('should accept ASCII text (1-byte characters)', () => {
      const buffer = Buffer.from('Hello World');
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe('Hello World');
      expect(result.error).toBeUndefined();
    });

    it('should accept 2-byte UTF-8 sequences (Latin Extended)', () => {
      // U+00C9 (É) = 0xC3 0x89
      const buffer = bufferFromBytes([0xc3, 0x89, 0x63, 0x6f, 0x6c, 0x65]); // "École"
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe('École');
    });

    it('should accept 3-byte UTF-8 sequences (CJK characters)', () => {
      // U+4E2D (中) = 0xE4 0xB8 0xAD
      // U+6587 (文) = 0xE6 0x96 0x87
      const buffer = bufferFromBytes([0xe4, 0xb8, 0xad, 0xe6, 0x96, 0x87]); // "中文"
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe('中文');
    });

    it('should accept 4-byte UTF-8 sequences (emoji)', () => {
      // U+1F600 (😀) = 0xF0 0x9F 0x98 0x80
      const buffer = bufferFromBytes([0xf0, 0x9f, 0x98, 0x80]); // "😀"
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe('😀');
    });

    it('should accept mixed UTF-8 sequences', () => {
      // ASCII + 2-byte + 3-byte + 4-byte
      const buffer = Buffer.from('Hello café 中文 😀');
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe('Hello café 中文 😀');
    });

    it('should accept plain text with newlines and tabs', () => {
      const buffer = Buffer.from('Line 1\nLine 2\n\tIndented');
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe('Line 1\nLine 2\n\tIndented');
    });
  });

  describe('Invalid UTF-8 sequences', () => {
    it('should reject truncated 2-byte sequence', () => {
      // 0xC3 (start of 2-byte) but missing continuation byte
      const buffer = bufferFromBytes([0x48, 0x69, 0xc3]); // "Hi" + incomplete
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
      expect(result.content).toBeUndefined();
    });

    it('should reject truncated 3-byte sequence', () => {
      // 0xE4 (start of 3-byte) but only 1 continuation byte
      const buffer = bufferFromBytes([0xe4, 0xb8]); // Incomplete
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });

    it('should reject truncated 4-byte sequence', () => {
      // 0xF0 (start of 4-byte) but only 2 continuation bytes
      const buffer = bufferFromBytes([0xf0, 0x9f, 0x98]); // Incomplete
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });

    it('should reject invalid continuation byte in 2-byte sequence', () => {
      // 0xC3 followed by non-continuation byte 0xFF
      const buffer = bufferFromBytes([0xc3, 0xff]);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });

    it('should reject overlong 2-byte encoding (overlong ASCII)', () => {
      // U+002F (/) encoded as overlong 2-byte: 0xC0 0xAF instead of 0x2F
      const buffer = bufferFromBytes([0xc0, 0xaf]);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });

    it('should reject overlong 3-byte sequence for 2-byte characters', () => {
      // 0xE0 requires continuation byte >= 0xA0 to prevent overlong
      const buffer = bufferFromBytes([0xe0, 0x9f, 0xaf]); // Invalid: 0x9F < 0xA0
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });

    it('should reject overlong 4-byte sequence for 3-byte characters', () => {
      // 0xF0 requires continuation byte >= 0x90 to prevent overlong
      const buffer = bufferFromBytes([0xf0, 0x8f, 0x80, 0x80]); // Invalid: 0x8F < 0x90
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });

    it('should reject invalid leading byte 0xC0', () => {
      const buffer = bufferFromBytes([0xc0, 0x80]);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });

    it('should reject invalid leading byte 0xC1', () => {
      const buffer = bufferFromBytes([0xc1, 0x81]);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });

    it('should reject invalid leading byte > 0xF4', () => {
      const buffer = bufferFromBytes([0xf5, 0x80, 0x80, 0x80]);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });

    it('should reject single continuation byte as leading byte', () => {
      // Continuation byte (0x80-0xBF) used as leading byte
      const buffer = bufferFromBytes([0x80, 0x81]);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });
  });

  describe('UTF-16 surrogate rejection (ED 80-9F)', () => {
    it('should reject UTF-16 surrogate (ED A0 sequence)', () => {
      // 0xED 0xA0 0x80 is a high surrogate (invalid in UTF-8)
      const buffer = bufferFromBytes([0xed, 0xa0, 0x80]);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });

    it('should reject UTF-16 surrogate (ED BF sequence)', () => {
      // 0xED 0xBF 0xBF would be a surrogate (invalid in UTF-8)
      const buffer = bufferFromBytes([0xed, 0xbf, 0xbf]);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });

    it('should accept valid ED sequence (ED 80-9F)', () => {
      // 0xED 0x80 0x80 is valid (within surrogate range but valid per spec)
      const buffer = bufferFromBytes([0xed, 0x80, 0x80]);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
    });

    it('should reject ED byte with invalid continuation', () => {
      // 0xED followed by out-of-range byte
      const buffer = bufferFromBytes([0xed, 0x7f, 0x80]);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });
  });

  describe('UTF-8 BOM stripping', () => {
    it('should strip UTF-8 BOM from file start', () => {
      // UTF-8 BOM = 0xEF 0xBB 0xBF
      const buffer = bufferFromBytes([0xef, 0xbb, 0xbf, 0x48, 0x65, 0x6c, 0x6c, 0x6f]); // BOM + "Hello"
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe('Hello');
    });

    it('should preserve BOM-like bytes in middle of file', () => {
      const buffer = Buffer.from('Hello\xef\xbb\xbfWorld');
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe('Hello\xef\xbb\xbfWorld');
    });

    it('should not strip partial BOM (2 bytes)', () => {
      // Only 0xEF 0xBB without 0xBF - should not be stripped
      // 0xEF is a 3-byte sequence starter, needs 2 continuation bytes
      // 0xBB is a valid continuation byte, but 0x48 ('H') is not, so invalid UTF-8
      const buffer = bufferFromBytes([0xef, 0xbb, 0x48, 0x69]); // Incomplete BOM + "Hi"
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });

    it('should not strip BOM from very short file', () => {
      // File shorter than 3 bytes
      // 0xEF is a 3-byte sequence starter, needs 2 continuation bytes
      // Only 1 continuation byte present, so invalid UTF-8
      const buffer = bufferFromBytes([0xef, 0xbb]); // Only 2 bytes
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });

    it('should handle file with only BOM', () => {
      const buffer = bufferFromBytes([0xef, 0xbb, 0xbf]);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe('');
    });
  });

  describe('Binary content detection', () => {
    it('should reject file with null bytes', () => {
      const buffer = Buffer.from('Hello\0World');
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('binary');
    });

    it('should reject file with multiple null bytes', () => {
      const buffer = Buffer.from('Hi\0\0\0There');
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('binary');
    });

    it('should reject file with excessive control characters', () => {
      // Create content with control chars exceeding threshold (10%)
      // Each control char is 1 char, so need > 10% ratio
      let content = 'Hello'; // 5 chars
      // Add 10+ control characters (>10% of 5 = > 0.5, so need 1+)
      // With 5 char base, need > 0.5 control chars, so 1 makes it 1/5 = 20%
      content += '\x01\x02\x03\x04\x05'; // 5 control chars added = total 10 chars, 5 control = 50%
      const buffer = Buffer.from(content);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('binary');
    });

    it('should allow normal text with newlines and tabs', () => {
      const content = 'Line 1\nLine 2\n\tIndented\r\nWindows line';
      const buffer = Buffer.from(content);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe(content);
    });

    it('should allow limited control characters', () => {
      // Only allowed control chars (newline, tab, carriage return)
      const content = 'Line 1\nLine 2\tTabbed\rReturn';
      const buffer = Buffer.from(content);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe(content);
    });

    it('should reject file with single disallowed control character in otherwise short file', () => {
      // Short file: "Hi" (2 chars) + 1 control char = 1/3 = 33% > 10%
      const buffer = Buffer.from('Hi\x01');
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('binary');
    });

    it('should reject binary data (typical binary file start)', () => {
      // Typical binary file magic bytes
      const buffer = bufferFromBytes([0x7f, 0x45, 0x4c, 0x46]); // ELF header
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('binary');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty buffer', () => {
      const buffer = Buffer.from('');
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe('');
      expect(result.error).toBeUndefined();
    });

    it('should handle file at maximum valid Unicode point (U+10FFFF)', () => {
      // F4 8F BF BF = U+10FFFF (valid maximum)
      const buffer = bufferFromBytes([0xf4, 0x8f, 0xbf, 0xbf]);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
    });

    it('should reject F4 sequence exceeding max valid codepoint', () => {
      // F4 90 80 80 = U+110000 (beyond maximum)
      const buffer = bufferFromBytes([0xf4, 0x90, 0x80, 0x80]);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid UTF-8');
    });

    it('should handle file with all allowed control characters', () => {
      const content = 'Text\nMore\rText\tMore';
      const buffer = Buffer.from(content);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe(content);
    });

    it('should return correct type for valid result', () => {
      const buffer = Buffer.from('test');
      const result: FileValidationResult = validateFileContent(buffer);

      expect(typeof result.valid).toBe('boolean');
      if (result.valid) {
        expect(typeof result.content).toBe('string');
        expect(result.error).toBeUndefined();
      }
    });

    it('should return correct type for invalid result', () => {
      const buffer = Buffer.from('Hi\x01');
      const result: FileValidationResult = validateFileContent(buffer);

      expect(typeof result.valid).toBe('boolean');
      if (!result.valid) {
        expect(typeof result.error).toBe('string');
        expect(result.content).toBeUndefined();
      }
    });
  });

  describe('Real-world scenarios', () => {
    it('should accept markdown file with UTF-8 encoding', () => {
      const markdown = `# Test Document

This is a **bold** sentence with *italic* text.

## Section 2

- List item 1
- List item 2 with special: café, naïve

\`\`\`javascript
const x = 42;
\`\`\`
`;
      const buffer = Buffer.from(markdown);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe(markdown);
    });

    it('should handle markdown with international characters', () => {
      const markdown = `# 中文标题

Bonjour le monde! 世界こんにちは

* 日本語リスト
* 中文列表
* Русский список
`;
      const buffer = Buffer.from(markdown);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toContain('中文');
      expect(result.content).toContain('Bonjour');
    });

    it('should handle markdown with emoji', () => {
      const markdown = `# Emoji Test

This is a happy face 😀 and a rocket 🚀

More emoji: ❤️ 🎉 🔥
`;
      const buffer = Buffer.from(markdown);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toContain('😀');
    });

    it('should accept markdown file with Windows line endings', () => {
      const markdown = 'Line 1\r\nLine 2\r\nLine 3';
      const buffer = Buffer.from(markdown);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe(markdown);
    });

    it('should accept markdown file with BOM and UTF-8 content', () => {
      const content = 'Test: café';
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      const contentBuffer = Buffer.from(content);
      const buffer = Buffer.concat([bom, contentBuffer]);
      const result = validateFileContent(buffer);

      expect(result.valid).toBe(true);
      expect(result.content).toBe(content);
    });
  });
});
