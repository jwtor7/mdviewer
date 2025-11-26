# Repository Guidelines

## Project Structure & Module Organization
- Electron entrypoints: `src/main.ts` (main process), `src/preload.ts` (IPC bridge), `src/renderer.tsx` (React bootstrap); Vite bundles everything.
- UI components live in `src/components/`; shared state in `src/hooks/`; shared types in `src/types/`; constants in `src/constants/`; utilities in `src/utils/`; styling in `src/index.css` and `src/styles/`.
- Output lands in `out/`; keep generated artifacts and `node_modules/` out of commits. `prototypes/` and `test-pdf-export.md` contain exploratory docs.
- Colocate new feature code; push heavy logic into hooks/utilities and keep components lean.

## Build, Test, and Development Commands
- `npm start` — Electron Forge dev server with Vite HMR.
- `npm run package` — Unsigned app bundle in `out/`.
- `npm run make` — Platform installers/distributables.
- `npm run lint` / `npm run lint:fix` — ESLint with security and secret scanning.
- `npm run typecheck` or `npm run typecheck:{main,preload,renderer}` — Strict TypeScript checks without emitting files.

## Coding Style & Naming Conventions
- TypeScript + React functional components; avoid classes.
- 2-space indentation and single quotes; rely on ESLint auto-fix for commas/spacing.
- Components are PascalCase (`MarkdownPreview.tsx`), hooks camelCase with `use` prefix, constants UPPER_SNAKE_CASE, utilities camelCase.
- Renderer stays sandboxed: interact with OS only through typed `electronAPI` exposed in preload; never access Node APIs directly from the renderer.

## Testing Guidelines
- No automated test suite yet; always run `npm run lint` and `npm run typecheck` before pushing.
- Add focused unit or integration coverage when touching parsing, IPC, or stateful flows; colocate tests beside the source they cover.
- Manual smoke test: open several `.md` files, toggle Rendered/Raw/Split, switch themes, and confirm save/export paths work.

## Commit & Pull Request Guidelines
- Write imperative, scoped commits (`feat: add split-view autosave`); squash noisy WIPs.
- PRs should state intent, risks, and manual test notes; attach screenshots/GIFs for UI changes.
- Link issues and flag security-sensitive edits (IPC contracts, file handling, sanitization, CSP).
- Keep diffs focused; separate refactors from feature/bugfix where practical.

## Security & Configuration Tips
- Preserve hardening: contextIsolation on, `rehype-sanitize` for markdown, validated IPC payloads.
- Never enable `nodeIntegration` or dynamic `eval`; validate file paths and sizes before use.
- Secrets are disallowed; ESLint fails on suspect patterns.
- Respect `package-lock.json`; do not commit build outputs.
