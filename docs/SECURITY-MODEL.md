# Security Model

mdviewer implements defense-in-depth security with multiple layers of protection.

## Process Isolation

### Sandboxed Renderer
- `sandbox: true` in BrowserWindow webPreferences
- Renderer process cannot access Node.js APIs directly
- All file system operations must go through IPC to main process

### Context Isolation
- `contextIsolation: true` prevents renderer from accessing Electron internals
- `nodeIntegration: false` blocks direct Node.js access
- Preload script uses `contextBridge` to expose a limited, safe API

### Electron Fuses (Production)
- `RunAsNode: false` - Prevents spawning Node.js from Electron
- `EnableCookieEncryption: true` - Encrypts session cookies
- `EnableNodeOptionsEnvironmentVariable: false` - Blocks NODE_OPTIONS
- `EnableNodeCliInspectArguments: false` - Disables debugging flags
- `OnlyLoadAppFromAsar: true` - Loads only from packaged archive

## IPC Validation

### Zod Schema Validation
All IPC handlers use Zod schemas for runtime type validation:

```typescript
// src/types/ipc-schemas.ts
export const SaveFileDataSchema = z.object({
  content: z.string(),
  filename: z.string().min(1),
  filePath: z.string().nullable(),
});
```

### Validation Wrapper
`withValidatedIPCHandler()` in `src/main/security/ipcValidation.ts` provides:
1. Zod schema validation with descriptive error messages
2. IPC origin validation (sender must be from known BrowserWindow)
3. Rate limiting (prevents DoS attacks)
4. Consistent error handling

### Origin Validation
`isValidIPCOrigin()` verifies every IPC request:
- Checks sender is associated with a valid BrowserWindow
- Confirms window is in the app's list of known windows
- Rejects requests from destroyed or unknown windows

## Rate Limiting

`createRateLimiter()` in `src/main/security/rateLimiter.ts`:
- Default: 100 calls per second per handler
- Automatic cleanup of stale entries (every 60 seconds)
- Prevents memory exhaustion from unique sender IDs

## Path Validation

`isPathSafe()` in `src/main/security/pathValidation.ts`:
- Resolves paths to absolute form (prevents `../` traversal)
- Validates file extensions (`.md`, `.markdown` only)
- Rejects paths with invalid extensions

## URL Security

`validateExternalUrl()` validates all external URLs before opening:

**Blocked protocols:**
- `javascript:`, `vbscript:` (code execution)
- `file:` (local file access)
- `data:`, `blob:` (content injection)
- `about:`, `chrome:` (browser internals)

**Allowed protocols:**
- `https:`, `http:` only (allowlist approach)

**Additional checks:**
- URL length limit (2048 chars) prevents DoS
- URL normalization prevents encoding bypass attacks

## Content Size Limits

Defined in `src/constants/index.ts`:

| Limit | Value | Purpose |
|-------|-------|---------|
| MAX_FILE_SIZE | 50MB | File read operations |
| MAX_IPC_CONTENT_SIZE | 10MB | IPC message payloads |
| MAX_WINDOWS | 10 | Concurrent window limit |

Renderer-side validation in `RENDERER_SECURITY.MAX_CONTENT_SIZE` (10MB) provides defense-in-depth.

## File Integrity Validation

`validateFileIntegrity()` in `src/utils/fileValidator.ts`:
- UTF-8 validation (manual byte-level checking)
- BOM detection and stripping
- Binary file detection (null bytes, control character ratio)

## Clipboard Sanitization

`sanitizeHtml()` and `sanitizeText()` in `src/utils/clipboardSanitizer.ts`:
- Removes dangerous HTML elements (script, iframe, object)
- Strips event handlers (onclick, onerror, etc.)
- Validates URL protocols in href/src attributes
- Adds `rel="noopener noreferrer"` to links

## Content Security Policy

### Renderer CSP
Strict CSP enforced via `<meta>` tag:
- `default-src 'self'`
- `script-src 'self'`
- `style-src 'self'` (production) or `'unsafe-inline'` (dev for HMR)
- `img-src 'self' data: blob:`

### PDF Export CSP
Generated PDFs include restrictive CSP:
- `default-src 'none'`
- `img-src 'self' data: blob:`
- `font-src 'self' data:`

## Security Logging

All security events logged with `[SECURITY]` prefix for audit trails:
- Rejected file extensions
- Blocked URL protocols
- Rate limit violations
- IPC origin failures

## ESLint Security Rules

Static analysis via `eslint-plugin-security`:
- `detect-non-literal-fs-filename`: Warns on dynamic file paths
- `detect-unsafe-regex`: Flags ReDoS-vulnerable patterns
- `detect-eval-with-expression`: Blocks eval() with variables
- `detect-child-process`: Warns on process spawning

Additional plugin `eslint-plugin-no-secrets` detects hardcoded credentials.

## Security Architecture Diagram

```
+------------------+     contextBridge     +------------------+
|  Renderer (React) | <----------------->  |  Preload Script  |
|  - Sandboxed     |    (limited API)     |  - contextBridge |
|  - No Node.js    |                      +--------+---------+
+------------------+                               |
                                                   | IPC
                                                   v
                            +------------------------------------------+
                            |           Main Process                    |
                            |  +----------------+  +------------------+ |
                            |  | ipcValidation  |  | pathValidation   | |
                            |  | - Zod schemas  |  | - isPathSafe     | |
                            |  | - Origin check |  | - validateUrl    | |
                            |  | - Rate limit   |  +------------------+ |
                            |  +----------------+                       |
                            +------------------------------------------+
```

## References

- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [OWASP Electron Security Guide](https://cheatsheetseries.owasp.org/cheatsheets/Electron_Security_Cheat_Sheet.html)
