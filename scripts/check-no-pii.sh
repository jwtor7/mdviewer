#!/usr/bin/env bash
# check-no-pii.sh
#
# Scans tracked files (default) or staged files (--staged) for:
#   - absolute home paths leaking real usernames
#   - common credential / private-key patterns
#
# Used by .husky/pre-commit and .github/workflows/repo-hygiene.yml.
# Single source of truth for what's blocked.
#
# Exit 0 if clean, 1 if any match found.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

mode="all"
explicit_files=()

for arg in "$@"; do
  case "$arg" in
    --staged) mode="staged" ;;
    -*)       echo "unknown flag: $arg" >&2; exit 2 ;;
    *)        explicit_files+=("$arg") ;;
  esac
done

# Gather file list
files=()
if [ "${#explicit_files[@]}" -gt 0 ]; then
  files=("${explicit_files[@]}")
elif [ "$mode" = "staged" ]; then
  while IFS= read -r f; do
    [ -n "$f" ] && files+=("$f")
  done < <(git diff --cached --name-only --diff-filter=ACMR)
else
  while IFS= read -r f; do
    [ -n "$f" ] && files+=("$f")
  done < <(git ls-files)
fi

if [ "${#files[@]}" -eq 0 ]; then
  exit 0
fi

# Patterns to flag
HOME_PATH_RE='/(Users|home)/[a-z][a-z0-9_-]*/'
CRED_PATTERNS=(
  'AKIA[0-9A-Z]{16}'
  'ghp_[A-Za-z0-9]{36}'
  'xox[bp]-[A-Za-z0-9-]+'
  '-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----'
)

# Allowlist: known safe placeholder usernames in test fixtures and docs.
# Add new entries here with a comment explaining why.
is_allowlisted_path() {
  case "$1" in
    */Users/john/*)     return 0 ;;  # neutral test fixture (matches useFileHandler.test.ts)
    */Users/name/*)     return 0 ;;  # generic placeholder used in PRD.md
    */Users/testuser/*) return 0 ;;  # generic test placeholder
    */Users/runner/*)   return 0 ;;  # GitHub Actions default home
    */home/runner/*)    return 0 ;;  # GitHub Actions default home (legacy linux runner)
  esac
  return 1
}

violations=0

for f in "${files[@]}"; do
  # Skip non-existent (e.g. deleted) files
  [ -f "$f" ] || continue
  # Skip self - this script defines the patterns it shouldn't match against itself.
  case "$f" in
    scripts/check-no-pii.sh) continue ;;
    docs/REPO-HYGIENE.md)    continue ;;
  esac

  # Home path scan
  while IFS=: read -r lineno match; do
    [ -z "$lineno" ] && continue
    # Extract just the matched path segment for allowlist check
    if is_allowlisted_path "$match"; then
      continue
    fi
    echo "PII: $f:$lineno: absolute home path: $match"
    violations=$((violations + 1))
  done < <(grep -nE "$HOME_PATH_RE" "$f" 2>/dev/null || true)

  # Credential pattern scan
  for pat in "${CRED_PATTERNS[@]}"; do
    while IFS=: read -r lineno _; do
      [ -z "$lineno" ] && continue
      echo "CREDENTIAL: $f:$lineno: matches /$pat/"
      violations=$((violations + 1))
    done < <(grep -nE "$pat" "$f" 2>/dev/null || true)
  done
done

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "check-no-pii: $violations match(es) found. See docs/REPO-HYGIENE.md for the contract."
  exit 1
fi

exit 0
