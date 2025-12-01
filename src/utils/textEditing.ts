/**
 * Replaces text content while preserving markdown formatting markers.
 *
 * This utility is designed for inline editing in the rendered preview mode.
 * It identifies markdown formatting around the edited text and preserves it
 * while replacing the inner content.
 *
 * Examples:
 * - "**bold text**" with new text "new content" -> "**new content**"
 * - "# Heading" with new text "New Heading" -> "# New Heading"
 * - "*italic*" with new text "changed" -> "*changed*"
 * - Plain text "hello" with new text "world" -> "world"
 *
 * @param originalMarkdown - The original markdown string (e.g., "**bold text**")
 * @param newPlainText - The new plain text content (e.g., "new content")
 * @returns The updated markdown with formatting preserved (e.g., "**new content**")
 */
export function replaceTextContent(originalMarkdown: string, newPlainText: string): string {
  // Handle empty cases
  if (!originalMarkdown) return newPlainText;
  if (!newPlainText) return newPlainText;

  // Define markdown patterns with their replacements
  // Order matters: check more specific patterns first

  // Heading patterns (# at start of line)
  const headingMatch = originalMarkdown.match(/^(#{1,6}\s+)(.*)$/);
  if (headingMatch) {
    return `${headingMatch[1]}${newPlainText}`;
  }

  // Bold patterns (**text** or __text__)
  const boldStarMatch = originalMarkdown.match(/^\*\*(.+?)\*\*$/);
  if (boldStarMatch) {
    return `**${newPlainText}**`;
  }
  const boldUnderMatch = originalMarkdown.match(/^__(.+?)__$/);
  if (boldUnderMatch) {
    return `__${newPlainText}__`;
  }

  // Italic patterns (*text* or _text_)
  const italicStarMatch = originalMarkdown.match(/^\*(.+?)\*$/);
  if (italicStarMatch) {
    return `*${newPlainText}*`;
  }
  const italicUnderMatch = originalMarkdown.match(/^_(.+?)_$/);
  if (italicUnderMatch) {
    return `_${newPlainText}_`;
  }

  // Strikethrough (~~text~~)
  const strikeMatch = originalMarkdown.match(/^~~(.+?)~~$/);
  if (strikeMatch) {
    return `~~${newPlainText}~~`;
  }

  // Inline code (`text`)
  const inlineCodeMatch = originalMarkdown.match(/^`(.+?)`$/);
  if (inlineCodeMatch) {
    return `\`${newPlainText}\``;
  }

  // Link text ([text](url))
  const linkMatch = originalMarkdown.match(/^\[(.+?)\]\((.+?)\)$/);
  if (linkMatch) {
    return `[${newPlainText}](${linkMatch[2]})`;
  }

  // Blockquote (> text at start of line)
  const blockquoteMatch = originalMarkdown.match(/^(>\s+)(.*)$/);
  if (blockquoteMatch) {
    return `${blockquoteMatch[1]}${newPlainText}`;
  }

  // List items (- text, * text, + text, or numbered)
  const unorderedListMatch = originalMarkdown.match(/^([-*+]\s+)(.*)$/);
  if (unorderedListMatch) {
    return `${unorderedListMatch[1]}${newPlainText}`;
  }
  const orderedListMatch = originalMarkdown.match(/^(\d+\.\s+)(.*)$/);
  if (orderedListMatch) {
    return `${orderedListMatch[1]}${newPlainText}`;
  }

  // If no markdown pattern matched, return plain text
  return newPlainText;
}
