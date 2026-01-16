# Agent Instructions for Herbivory Counter

> **CRITICAL**: Read this file at the START of every session.

## Session Startup Checklist

Every agent session MUST begin with:

1. `pwd` - Verify working directory
2. `cat progress.txt` - Read what previous sessions accomplished
3. `cat feature_list.json` - See which features pass/fail
4. `git log --oneline -10` - Review recent commits
5. If `init.sh` exists: Run it to start dev server
6. Run basic tests to verify app isn't broken

## Core Rules

### One Feature Per Session
- Pick ONE feature from `feature_list.json` where `passes: false`
- Implement ONLY that feature
- Do not try to implement multiple features

### Test Before Marking Complete
- Write tests FIRST (TDD)
- Run unit tests: `npm test`
- Run E2E tests: `npm run test:e2e`
- For UI features: Use Playwright to verify end-to-end
- **A feature is NOT complete until tests pass**

### Leave Clean State
- Commit after completing feature: `git commit -m "feat(component): description"`
- Update `feature_list.json`: Change `"passes": false` to `"passes": true`
- Update `progress.txt`: Add session summary with date and work done
- Never leave uncommitted changes or broken tests

### Do Not Modify feature_list.json Structure
- Only change `"passes": false` to `"passes": true`
- Do NOT remove tests
- Do NOT edit descriptions or steps
- Do NOT reorder features

## File Reference

| File | Purpose |
|------|---------|
| `implementation_plan.md` | Detailed task specs with acceptance criteria |
| `feature_list.json` | Feature status tracking (passes: true/false) |
| `progress.txt` | Session handoff log |
| `task.md` | High-level task checklist |
| `init.sh` | Bootstrap script (created in Task 1.1) |

## Session End Template

Before ending, append to `progress.txt`:

```
### YYYY-MM-DD - Session Description
- [What you accomplished]
- [Any issues encountered]
- [Commits made]

## Current State
- Features complete: X / 44
- Last feature worked on: [ID]
- Known issues: [Any blockers]

## Next Priority
[What the next session should work on]
```

## Getting Help

If stuck, check:
1. `implementation_plan.md` for detailed specs
2. Test files for expected behavior
3. Git history for context on recent changes
