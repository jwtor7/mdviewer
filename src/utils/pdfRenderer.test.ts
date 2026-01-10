import { describe, it, expect } from 'vitest';
import { generatePDFHTML, convertMarkdownToHTML, getPDFStyles } from './pdfRenderer';

describe('generatePDFHTML', () => {
    it('should include nonce in CSP and style tag', async () => {
        const markdown = '# Hello World';
        const html = await generatePDFHTML(markdown);

        // Check for CSP meta tag
        expect(html).toContain('<meta http-equiv="Content-Security-Policy"');

        // Extract nonce from CSP
        const cspMatch = html.match(/style-src 'nonce-([^']+)'/);
        expect(cspMatch).not.toBeNull();
        const nonce = cspMatch![1];

        // Check that nonce is valid base64 (approximately)
        expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);

        // Check that the style tag uses the same nonce
        expect(html).toContain(`<style nonce="${nonce}">`);

        // Ensure unsafe-inline is NOT present
        expect(html).not.toContain("'unsafe-inline'");
    });
});

describe('convertMarkdownToHTML', () => {
    it('should wrap headers in pdf-section elements', async () => {
        const markdown = `## Section One

Content for section one.

## Section Two

Content for section two.`;

        const html = await convertMarkdownToHTML(markdown);

        // Verify sections are created
        expect(html).toContain('<section class="pdf-section">');
        expect(html).toContain('<h2>Section One</h2>');
        expect(html).toContain('<h2>Section Two</h2>');

        // Count sections - should have 2
        const sectionCount = (html.match(/<section class="pdf-section">/g) || []).length;
        expect(sectionCount).toBe(2);
    });

    it('should include pdf-section in full PDF output', async () => {
        const markdown = `# Main Title

Some intro text.`;

        const html = await generatePDFHTML(markdown);

        // Verify section appears in complete PDF HTML
        expect(html).toContain('<section class="pdf-section">');
        expect(html).toContain('<h1>Main Title</h1>');
    });
});

describe('getPDFStyles', () => {
    it('should include pdf-section styles for page breaking', () => {
        const styles = getPDFStyles();

        expect(styles).toContain('.pdf-section');
        expect(styles).toContain('break-inside: avoid');
        expect(styles).toContain('page-break-inside: avoid');
    });
});
