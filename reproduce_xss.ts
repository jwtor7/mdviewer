import { generatePDFHTML } from './src/utils/pdfRenderer';

const maliciousInputs = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert(1)>',
    '[click me](javascript:alert(1))',
    '<a href="javascript:alert(1)">click me</a>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '![external](http://attacker.com/image.png)'
];

async function test() {
    console.log('Testing PDF HTML generation for XSS vulnerabilities...');

    for (const input of maliciousInputs) {
        const output = await generatePDFHTML(input);

        // Check for CSP
        if (!output.includes('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src * data:; style-src \'unsafe-inline\'; font-src * data:;">')) {
            console.log('❌ FAIL: CSP meta tag missing!');
        } else {
            console.log('✅ PASS: CSP meta tag present');
        }

        console.log(`\nInput: ${input}`);
        if (output.includes('alert') || output.includes('<script>') || output.includes('javascript:')) {
            console.log('❌ VULNERABLE: Output contains malicious code');
            console.log('Output snippet:', output.substring(output.indexOf('body') + 6, output.indexOf('/body')));
        } else {
            console.log('✅ SAFE: Malicious code stripped');
        }
    }
}

test().catch(console.error);
