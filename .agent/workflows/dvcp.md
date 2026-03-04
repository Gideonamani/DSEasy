---
description: Document, Version, Commit, Push — the standard release workflow
---

# DVCP Protocol

> **Branch check**: This workflow should ONLY run on `master` (or `main`). If on a feature branch, remind the Developer to merge first.

> **IMPORTANT: Commit code changes FIRST!** Before running DVCP, ensure all code changes (features, fixes, chores) have already been committed as their own atomic commits using Conventional Commits format (e.g. `fix(functions): ...`, `feat(ui): ...`). DVCP only handles the changelog update and version bump — it should NEVER bundle code changes into its commit.

// turbo-all

1. **Check branch**: Run `git branch --show-current` and verify it is `master`. If not, stop and notify the user.

2. **Check for uncommitted code changes**: Run `git status`. If there are unstaged code changes (not changelog/package.json), stop and commit them first as separate atomic commits before proceeding.

3. **Review commits since last version**: Run `git log --oneline` and identify all commits since the last `docs: update changelog and bump version` commit.

4. **Document (CHANGELOG.md)**: Update `CHANGELOG.md` with a new version section summarizing all changes since the last version. Group by type (Features, Fixes, Chores, etc.).

5. **Version (package.json)**: Bump the version in `package.json`:
   - **patch** (0.0.x): bug fixes, minor tweaks
   - **minor** (0.x.0): new features, non-breaking
   - **major** (x.0.0): breaking changes

6. **Commit**: Stage ONLY changelog and version files, then commit:

   ```bash
   git add CHANGELOG.md package.json && git commit -m "docs: update changelog and bump version to X.X.X"
   ```

7. **Push**: Push to remote
   ```bash
   git push origin master
   ```
