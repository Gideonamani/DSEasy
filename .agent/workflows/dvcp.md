---
description: Document, Version, Commit, Push — the standard release workflow
---

# DVCP Protocol

> **Branch check**: This workflow should ONLY run on `master` (or `main`). If on a feature branch, remind the Developer to merge first.

// turbo-all

1. **Check branch**: Run `git branch --show-current` and verify it is `master`. If not, stop and notify the user.

2. **Review commits since last version**: Run `git log --oneline` and identify all commits since the last `docs: update changelog and bump version` commit.

3. **Document (CHANGELOG.md)**: Update `CHANGELOG.md` with a new version section summarizing all changes since the last version. Group by type (Features, Fixes, Chores, etc.).

4. **Version (package.json)**: Bump the version in `package.json`:
   - **patch** (0.0.x): bug fixes, minor tweaks
   - **minor** (0.x.0): new features, non-breaking
   - **major** (x.0.0): breaking changes

5. **Commit**: Stage and commit with message `docs: update changelog and bump version to X.X.X`

   ```bash
   git add -A && git commit -m "docs: update changelog and bump version to X.X.X"
   ```

6. **Push**: Push to remote
   ```bash
   git push origin master
   ```
