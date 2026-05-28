---
description: Document, Version, Commit, Push — cut a release after work lands on master
argument-hint: "[patch|minor|major|<x.y.z>]"
---

# dvcp — Document, Version, Commit, Push

Cut a release for the work that has landed on `master` but is not yet versioned:
update the changelog, bump the version, commit, and push.

This runs **after** PRs are merged. Merging PRs, syncing `master`, and deleting
branches are **not** part of dvcp — assume `master` already holds the work to release.

Optional argument (`$ARGUMENTS`): the bump level (`patch` / `minor` / `major`) or an
explicit version (`1.8.0`). If omitted, infer the level from the commits in range
(see step 2) and **confirm with the user before committing**.

## 0. Pre-flight (abort if any fails — do not "fix" by force)

- On `master`: `git rev-parse --abbrev-ref HEAD` must be `master`.
- In sync with remote: `git fetch origin` then confirm `master` is not behind/ahead of `origin/master`.
- Clean tree: `git status --short` should be empty. If there are unrelated changes, stop and ask.
- Not already released: if `HEAD` is itself a `bump version to` commit, there is nothing new to release — stop and report.

## 1. Document — update `CHANGELOG.md`

Releases are tracked by bump commits, **not git tags**, so find the previous release point and diff from it:

```
# hash of the most recent version-bump commit (the last release)
git log -n 1 --format=%H --grep="bump version to"
```

- Review everything since that commit: `git log <hash>..HEAD --oneline` and the merged PR descriptions for those commits.
- Add a new section at the top of `CHANGELOG.md`, above the previous entry:
  - Heading: `## [<new-version>] - <YYYY-MM-DD>` (use today's date).
  - Group changes under the headings already used in the file: `### Added` / `### Fixed` / `### Changed` / `### Refactored`.
  - Lead each bullet with the issue it resolves where applicable, e.g. **Issue #66 (Compare Tickers Breakdown Matrix)**: …, matching the style of existing entries.
  - End the section with the `---` separator used between releases.

## 2. Version — bump `package.json`

Choose the bump per [Semantic Versioning](https://semver.org/), inferring from the commit prefixes in range when no argument was given:

| Change in range | Bump | Example |
|---|---|---|
| Breaking change (`!` / `BREAKING CHANGE`) | **major** | `1.7.0 → 2.0.0` |
| Any `feat(...)` | **minor** | `1.7.0 → 1.8.0` |
| Only `fix` / `chore` / `docs` / `refactor` | **patch** | `1.7.0 → 1.7.1` |

- Edit only the top-level `version` field in `package.json`.
- **Do not** touch `package-lock.json` — the established pattern leaves its root version alone (resync only if explicitly asked).
- If the inferred level is ambiguous, confirm with the user before committing.

## 3. Commit

Stage only the two files and commit directly on `master` (the one sanctioned direct-to-`master` commit), matching the existing message style exactly:

```
git add package.json CHANGELOG.md
git commit -m "docs: update changelog and bump version to <new-version>"
```

## 4. Push

```
git push
```

If you need `gh` to verify checks afterward, clear the placeholder token first:
PowerShell `$env:GITHUB_TOKEN = $null; gh <command>` · Bash `GITHUB_TOKEN="" gh <command>`.

## 5. Report

State the new version, the range of commits it covers, and the pushed commit hash.
