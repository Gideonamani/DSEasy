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

### The DVCP Protocol

If the Developer requests `dvcp` (Document, Version, Commit, and Push), follow these steps in order:

1. **Document**: Update the `CHANGELOG.md` file and any other relevant documentation (`agent.md`, code comments, etc.).
2. **Version**: Bump the project version in `package.json` appropriately.
3. **Commit**: Stage and commit the project changes with a Conventional Commits message.
4. **Push**: Push the committed changes to the upstream remote branch.

- `feat: [description]` for a new feature.
- `fix: [description]` for a bug fix.
- `chore: [description]` for updating tasks, refactoring, or maintenance (e.g., dependency updates).
- `docs: [description]` for updating documentation like this file.
  _Rule: Keep commits atomic. Focus on a single feature or fix per commit._

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
