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

1.  **Switch & Pull `master`**:
    Verify you are on the `master` branch and have pulled all recently merged pull requests:
    ```bash
    git checkout master && git pull
    ```

2.  **Check for Uncommitted Code**:
    Run `git status`. If there are any uncommitted code files (outside of `package.json` or `CHANGELOG.md`), stop immediately. Commit those changes separately before proceeding.

3.  **Collate New Commits**:
    Identify all new commits merged since the last release version bump:
    ```bash
    git log --oneline
    ```

4.  **Document (CHANGELOG.md)**:
    Open `CHANGELOG.md` and add a new version block. Categorize all recently merged commits since the last release:
    *   **Features** (new modules/options)
    *   **Fixes** (bug resolutions)
    *   **Chores/Docs** (internal maintenance or docs updates)

5.  **Version Bump (package.json)**:
    Update the `version` field in `package.json` following semantic versioning rules:
    *   **patch** (0.0.x) — standard daily fixes, UI alignment, or incremental updates.
    *   **minor** (0.x.0) — new components, workflows, or substantial functional updates.
    *   **major** (x.0.0) — breaking API/rule architectural changes.

6.  **Commit the Release**:
    Stage *only* the changelog and version files and commit the bump:
    ```bash
    git add CHANGELOG.md package.json && git commit -m "docs: update changelog and bump version to X.X.X"
    ```

7.  **Push to Master**:
    Push the atomic release commit to origin:
    ```bash
    git push origin master
    ```
