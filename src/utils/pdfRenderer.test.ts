import { describe, it, expect } from 'vitest';
import { generatePDFHTML } from './pdfRenderer';

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
