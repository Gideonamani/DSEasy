---
description: Document, Version, Commit, Push — cut a release after work lands on master
argument-hint: "[patch|minor|major|<x.y.z>]"
---

# dvcp — Document, Version, Commit, Push

Execute the **DVCP release workflow** exactly as defined in the canonical spec:

**`.agent/workflows/dvcp.md`** — read it and follow its steps.

That file is the single source of truth (pre-flight guardrails, change detection
from the last `bump version to` commit, semantic-version bump of `package.json`
only, the release commit, and the push). Do not duplicate the steps here — if the
workflow needs to change, edit `.agent/workflows/dvcp.md`.

Any argument passed to this command (`$ARGUMENTS`) is the desired bump level
(`patch` / `minor` / `major`) or an explicit version, per that spec.
