# DSEasy - Agent Role & Workflow Guidelines

## Context & Tech Stack

- **Role**: You are an AI Coding Assistant helping develop the DSEasy application.
- **Tech Stack**: React, TypeScript, Firestore (Backend/DB).
- **Hosting**: Vercel (Frontend).
- **Version Control**: Git / GitHub.
- **Testing**: Manual verification (no automated tests currently).

## Core Principles

1. **One Step at a Time**: Provide granular, focused implementations. Do not try to solve the entire application architecture in a single step. Finish the current task completely before moving to the next.
2. **Verify then Commit**:
   - Wait for the Developer to manually verify the UI/Logic behaves as expected before suggesting the next major change.
   - Remind the Developer to commit working states frequently.
3. **Clean Code**: Remove temporary debugging logs (e.g., `console.log`) or unused imports before finalizing a feature.
4. **Assume TypeScript Strictness**: Default to rigorous TypeScript implementations. Avoid using `any`; define precise interfaces/types for Firestore documents and React component props.

## Workflow: Documenting Changes

1. **Code-Level**: Use standard JSDoc/TSDoc blocks to document complex functions, custom hooks, and utility methods. Explain _why_ a particular approach was taken if it addresses a specific edge case.
2. **Task Management**: For complex updates, organize work into a `task.md` with checklist items. Update this as progress is made.
3. **Summarize Work**: At the end of a major feature, summarize the changes in `walkthrough.md` to maintain a clear record of completed milestones.

## Workflow: Versioning & Committing (Conventional Commits)

When writing commit messages, adhere strictly to the **Conventional Commits** format. This makes the project history readable and helps establish clear version boundaries:

- `feat: [description]` for a new feature.
- `fix: [description]` for a bug fix.
- `chore: [description]` for updating tasks, refactoring, or maintenance (e.g., dependency updates).
- `docs: [description]` for updating documentation like this file.
  _Rule: Keep commits atomic. Focus on a single feature or fix per commit._

### The DVCP Protocol (Document, Version, Commit, Push)

When the Developer requests `dvcp` (or when preparing for a major push), follow these sequential steps meticulously:

> **Important**: Version bumping and updating the `CHANGELOG.md` should **ONLY** occur when on the `master` (or `main`) branch to ensure proper alignment. If on a feature branch, remind the Developer to perform the `dvcp` workflow after merging to `master`.

1. **Document**:
   - Check the commit history (`git log`) to review **all commits made since the last version bump**. Do not look at just the most recent commit.
   - Summarize these changes and update the `CHANGELOG.md` file comprehensively.
   - Update any other relevant documentation (e.g., `agent.md`, JSDoc comments).
2. **Version**: Bump the project version in `package.json` appropriately (patch, minor, or major based on the changes).
3. **Commit**: Stage the updated documentation and `package.json`, then commit the changes with a Conventional Commits message (e.g., `docs: update changelog and bump version to X.X.X`).
4. **Push**: Push the committed changes to the upstream remote branch.

## Workflow: Deployment & Verification

Since the app relies on manual verification and is deployed to Vercel, adhere to the following checklist before considering a feature "Done":

1. **Pre-Deploy Checks**: Always ensure the code has no linting errors and builds successfully locally (`npm run build`).
2. **Environment Variables**: Verify that all new Firebase configuration variables (if added) are present in the `.env` file locally and remind the Developer to add them to Vercel Project Settings for production.
3. **Branching & Previews**: For major architectural changes, work on a separate git branch. Pushing this branch to GitHub will trigger a Vercel Preview Deployment, allowing for safe manual verification of the UI and database queries without affecting production.

## Current Project Phases

- **Phase 1**: Project Setup (Firebase Configs, Local Auth) [COMPLETED]
- **Phase 2**: Data Migration (Scripts, Schema Validation)
- **Phase 3**: Frontend Integration (SDK, Hooks)
- **Phase 4**: Backend Logic (Cloud Functions)
- **Phase 5**: Deployment & Verification
