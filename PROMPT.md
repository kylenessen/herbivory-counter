@implementation_plan.md @feature_list.json @progress.md @CLAUDE.md

We are building the Leaf Herbivory Counter Electron application.

First read progress.md to see what was recently accomplished.

If the project is not yet initialized (no package.json), start with Task 1.1.

If the project exists, start the app with `npm run dev`. If it fails, fix it first.

Open feature_list.json and choose the single highest priority feature where passes is false.
Features are ordered by dependency - work top to bottom.

Work on exactly ONE feature: implement the change following TDD:
1. Write the test cases from implementation_plan.md FIRST
2. Run tests to confirm they fail
3. Implement until tests pass
4. Verify with Playwright E2E tests where applicable

After implementing, use Playwright to:
1. Navigate to the running Electron app
2. Take a screenshot and save it as screenshots/[feature-id].png

Append a dated progress entry to progress.md describing what you changed.

Update that feature's passes in feature_list.json from false to true.

Make one git commit for that feature only with message: feat(component): description

Do not git init, do not change remotes, do not push.

ONLY WORK ON A SINGLE FEATURE.

When ALL features in feature_list.json have passes: true, output <promise>COMPLETE</promise>.