---
description: Document, Version, Commit, Push — the standard post-merge release workflow
---

# DVCP Protocol (Post-Merge Release Workflow)

The **DVCP Protocol** is a release-cadence workflow executed **strictly on the `master` (or `main`) branch** after one or more feature branches/pull requests have been successfully merged. 

This workflow handles the changelog compilation and semantic version bump. It should **never** bundle functional code changes (fixes/features) into the version bump commit.

---

### 🛡️ Workflow Architecture Guidelines

1.  **Branch Isolation**: Version bumps and changelog updates must **never** be performed directly on a feature/bug branch to prevent merge conflicts when combining parallel branches.
2.  **Post-Merge Execution**: Always merge your feature PR into `master` first. Then, check out `master`, run `git pull`, and execute the DVCP workflow.
3.  **Code Commit First**: Ensure all code changes are already committed as separate atomic commits matching Conventional Commits (e.g. `fix(functions): ...`, `feat(ui): ...`) before running DVCP.

---

### 🚀 Execution Steps

Optional argument: the bump level (`patch` / `minor` / `major`) or an explicit version (e.g. `1.8.0`). If omitted, infer the level from the commits in range (step 4) and **confirm before committing**.

1.  **Switch & Pull `master`**:
    Verify you are on the `master` branch and have pulled all recently merged pull requests:
    ```bash
    git checkout master && git pull
    ```

2.  **Pre-flight (abort if any fails — do not force-fix)**:
    *   On `master`: `git rev-parse --abbrev-ref HEAD` must be `master`.
    *   In sync: after `git fetch origin`, `master` must not be ahead of / behind `origin/master`.
    *   Clean tree: `git status --short` must be empty. If there are uncommitted code files (outside `package.json` / `CHANGELOG.md`), stop and commit them separately first.
    *   Not already released: if `HEAD` is itself a `bump version to` commit, there is nothing new to release — stop.

3.  **Collate New Commits**:
    Releases are tracked by version-bump commits, **not git tags**, so find the previous release point and diff from it:
    ```bash
    # hash of the most recent version-bump commit (the last release)
    git log -n 1 --format=%H --grep="bump version to"
    # then review everything since
    git log <hash>..HEAD --oneline
    ```

4.  **Document (CHANGELOG.md)**:
    Open `CHANGELOG.md` and add a new `## [X.X.X] - YYYY-MM-DD` block at the top (today's date), above the previous entry. Categorize all commits in the range, leading each bullet with the issue it resolves where applicable (e.g. **Issue #66 (...)**):
    *   **Added** (new modules/options)
    *   **Fixed** (bug resolutions)
    *   **Changed / Refactored** (internal maintenance or docs updates)

    End the section with the `---` separator used between releases.

5.  **Version Bump (package.json)**:
    Update *only* the top-level `version` field in `package.json` following semantic versioning rules:
    *   **patch** (0.0.x) — standard daily fixes, UI alignment, or incremental updates.
    *   **minor** (0.x.0) — new components, workflows, or substantial functional updates.
    *   **major** (x.0.0) — breaking API/rule architectural changes.

    Do **not** touch `package-lock.json` — the established pattern leaves its root version alone (resync only if explicitly asked). If the inferred level is ambiguous, confirm before committing.

6.  **Commit the Release**:
    Stage *only* the changelog and version files and commit the bump:
    ```bash
    git add CHANGELOG.md package.json && git commit -m "docs: update changelog and bump version to X.X.X"
    ```

7.  **Push to Master**:
    Push the atomic release commit to origin, then report the new version, the commit range it covers, and the pushed hash:
    ```bash
    git push origin master
    ```
    > When using `gh` to verify checks afterward, clear the placeholder token first: PowerShell `$env:GITHUB_TOKEN = $null; gh <command>` · Bash `GITHUB_TOKEN="" gh <command>`.
