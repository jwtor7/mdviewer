# Project Context: Security Remediation

**Current Focus:** Security Remediation (Phase 1 - Data Leakage Prevention)
**Status Tracker:** [SECURITY_REMEDIATION_STATE.md](file:///Users/true/dev/mdviewer/SECURITY_REMEDIATION_STATE.md)

## **Active Task**
**SECURITY: PDF CSP Data Leakage (H-3)**
- **Goal:** Prevent data leakage via CSS background-image URLs in PDF export (Remove 'unsafe-inline').
- **Status:** Pending.
- **Note:** Priorities updated based on Security Report v2.0 (2025-11-24). Focus is on Data Leakage Prevention.

---

# Git Workflow

## Critical Rules

**NEVER push to remote without explicit user approval.** This is a hard rule with no exceptions.

### Autonomous Actions (No Permission Required)

- Create/delete local branches
- Modify files
- Stage changes (`git add`)
- Commit locally (`git commit`)
- Merge branches locally

### Actions Requiring Explicit Approval

- **ANY** `git push` command (to any remote branch)
- `git push --force`
- `git push origin --delete <branch>`
- Any command that modifies the remote repository

### Mandatory Workflow Pattern

1. Complete all local work (branch, commit, merge)
2. **STOP** - Present summary to user
3. **WAIT** for explicit approval
4. Execute push only after approval

**Check-in template:**
```
I've completed the following locally:
- Created feature branch and made changes
- Committed with message: [message]
- Merged to main locally
- Ready to push to remote

Please review and let me know if you want me to push to origin.
```

### Commit Message Requirements

**Format:** Short, imperative, specific

**Examples:**
- Add JWT authentication middleware
- Fix timeout handling in job runner
- Update setup instructions in README

**NEVER add:**
- "Generated with Claude Code" footers
- "Co-Authored-By: Claude" tags

The user is the author.

---

## Branch Strategy

### Philosophy

- **main** = stable, deployable, never commit directly
- All changes via short-lived feature branches
- Create from up-to-date main, merge when complete

### Naming Conventions

- `feature/<description>` - New features or larger changes
- `fix/<description>` - Bug fixes
- `docs/<description>` - Documentation-only updates

**Examples:**
- `feature/add-auth-system`
- `fix/api-timeout`
- `docs/update-readme`

---

## Standard Workflow

### 1. Create Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/<short-description>
```

All work for the task happens on this branch.

### 2. Make Changes and Commit

```bash
# edit files
git add .
git commit -m "Implement <short, clear description>"
```

### 3. Merge to Main

After work is complete and tests/linters pass:

```bash
git checkout main
git pull origin main
git merge feature/<short-description>
```

**STOP HERE.** Check in with user before pushing.

### 4. Push to Remote (After Approval Only)

```bash
git push origin main
```

This promotes changes to the stable main branch.

### 5. Cleanup (After Push, With Approval)

```bash
git branch -d feature/<short-description>
git push origin --delete feature/<short-description>
```

Keeps branch lists focused on active work.

### Optional: Push Feature Branch

**Only if user explicitly requests:**

```bash
git push -u origin feature/<short-description>
```

Most of the time, skip this step and only push main after user approval.

---

## Advanced Operations

### Rollback Basics

**Undo last local commit, keep changes staged:**
```bash
git reset --soft HEAD~1
```

**Undo last local commit, discard changes entirely:**
```bash
git reset --hard HEAD~1
```

*Use --hard carefully, as it deletes local work.*

### Revert Pushed Merge (Non-Destructive)

Find the merge commit hash:
```bash
git log --oneline
```

Revert the merge:
```bash
git revert -m 1 <merge-commit-hash>
git push origin main
```

Creates a new commit that undoes merged changes without rewriting history.

### Full Rollback (History Rewrite)

```bash
git checkout main
git reset --hard <known-good-commit-hash>
git push --force origin main
```

Rewrites history on main. Use consciously (typically safe in solo workflow when required).