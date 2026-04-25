# Repo Hygiene

mdviewer is a public repo. To keep it safe to share, runnable on any machine, and free of personal data, the project enforces a small set of rules at commit time and in CI.

## What Not to Commit

### Absolute User Paths

Don't commit absolute home paths like `/Users/yourname/...` or `/home/yourname/...`. These leak the author's machine layout and break for everyone else.

Use one of these placeholders instead:

- `/Users/john/` — the convention used in `src/hooks/useFileHandler.test.ts` for test fixtures
- `/Users/name/` — generic placeholder used in `docs/PRD.md` for examples
- `/tmp/` — for ephemeral files in tests or scripts

Or, better, derive the path at runtime. `scripts/install.sh` does this with `REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"`.

### Local IDE / Agent State

Don't commit local tooling state:

- `.claude/` — Claude Code session data
- `.idea/` — JetBrains
- Personal `.vscode/` settings (project-wide settings are fine)
- `.env*` — environment files

The `.gitignore` covers these by default.

### Secrets

API keys, tokens, passwords, private keys, and credentials never go in source. The scan script checks for common patterns (AWS, GitHub, Slack, PEM-encoded keys), and `eslint-plugin-no-secrets` runs against the source tree. GitHub's secret scanning provides a final backstop on public repos.

## Enforcement

Three layers, same source of truth (`scripts/check-no-pii.sh`):

1. **Pre-commit hook** (`.husky/pre-commit`) — blocks commits that introduce violations. Wired up automatically by `npm install` via the `prepare` script.
2. **GitHub Actions** (`.github/workflows/repo-hygiene.yml`) — re-scans the full tree on every push and PR. Catches anything that bypassed the local hook (`git commit --no-verify`) or came from a contributor without husky installed.
3. **Manual scan** — run `bash scripts/check-no-pii.sh` anytime. Exit 0 means clean.

## Allowlist

`scripts/check-no-pii.sh` has a `case` block listing accepted placeholder paths. Add a new entry there with a comment explaining why. Keeping the list short is the point — every entry is a path the scan can't catch.

## Bypass

If you absolutely need to commit through the hook, use `git commit --no-verify` and explain why in the commit message. Bypasses are auditable:

```
git log --grep '\[skip-hygiene\]'
```

CI will still run the scan on push, so a bypass only buys time, not exemption.

## Adding New Rules

To extend what's blocked:

1. Edit `scripts/check-no-pii.sh` (the `HOME_PATH_RE` regex, `CRED_PATTERNS` array, or `is_allowlisted_path` function).
2. Smoke-test locally: write a file containing the new pattern and confirm the script exits 1 on it.
3. Update this doc if the contract changes.

The script is the single source of truth. Don't duplicate patterns into the husky hook or the workflow YAML — both call the script.
