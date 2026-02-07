# Agent Workflow Guidelines

## Core Principles

1. **One Step at a Time**: Never jump ahead. Finish the current phase completely before moving to the next.
2. **Verify then Commit**:
   - **Verify**: Ensure the code works and passes tests.
   - **Commit**: Stage and commit changes with a clear message.
   - **Document**: Update status in `task.md` and `walkthrough.md`.
3. **Clean Up**: Remove temporary files or logs before committing.

## Migration Phases

- **Phase 1**: Project Setup (Firebase Configs, Local Auth) [COMPLETED]
- **Phase 2**: Data Migration (Scripts, Schema Validation)
- **Phase 3**: Frontend Integration (SDK, Hooks)
- **Phase 4**: Backend Logic (Cloud Functions)
- **Phase 5**: Deployment & Verification

## Deployment Checklist

- [ ] Lint check
- [ ] Build check (`npm run build`)
- [ ] No secrets in git (check `.gitignore`)
