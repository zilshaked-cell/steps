# IMP-11 regression plan

Status: baseline/test-planning companion for `docs/specs/implementation-task-map.md`.

This file intentionally avoids future Prisma model or field names until `IMP-01`
lands. It describes the test obligations by behavior so later agents can map
them to the actual schema and service names after generation.

## Baseline before IMP-01

Run these commands before and after schema foundation work when practical:

- `npm test`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

If `IMP-01` is actively changing schema/migrations, record any failure as
"baseline blocked by in-progress schema work" unless the failure is clearly in a
non-schema area.

Baseline result on 2026-07-05 23:38 +03:00:

- `npm test` passed, 29/29.
- `npm run test:integration` passed, 38/38 against `steps_test`.
- `npm run lint` passed.
- `npm run test:e2e` was blocked during the production build type-check step by
  in-progress `IMP-01` schema work: `prisma/seed.ts` references new permission
  actions and trainee group-membership history while the generated Prisma client
  still reflects the previous schema.
- `npx tsc --noEmit` failed for the same in-progress schema/client mismatch.
- `npm run build` failed for the same in-progress schema/client mismatch.

Post-IMP-01/IMP-02 verification on 2026-07-05 23:54 +03:00:

- `npm test` passed, 29/29.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run test:integration` passed, 48/48 against `steps_test` with two
  migrations applied.
- `npm run build` passed.
- `npm run test:e2e` passed, 4/4 Playwright tests, with no leftover listener on
  ports 3100/3101 afterward.

## Post-IMP-01 test additions

### Permissions

- New write actions default to `ADMIN` only.
- Non-admin roles are denied each new write action until explicitly granted.
- Role-level grants allow the action only in the intended institution/scope.
- User overrides still win over role defaults.
- Same-specificity conflicts fail closed: `DENY` beats `ALLOW`.
- Scope checks cover institution, group, and trainee boundaries.

### Groups

- Active groups appear in normal work lists.
- Archived/inactive groups are hidden from normal work lists.
- Archived/inactive groups remain available for historical report viewing.
- Users without the group-management permission cannot create or edit groups.
- Staff assignments are written atomically with group create/edit behavior once
  the service boundary exists.

### Trainees and group transfer

- New trainees require a current group at creation.
- New trainees default to the standard measurement mode.
- Initial/current stage remains optional.
- Transfer requires the transfer permission.
- Transfer records an effective date and keeps historical reports tied to the
  group that was effective on the measurement/reporting date.
- Backdated transfer behavior is covered for at least one date before and one
  date after the effective date.

### Stage parameters and scoring profiles

- Score scale validation covers `1-3`, `1-10`, and `1-100`.
- Scores outside the selected scale are rejected.
- Draft scoring profiles can be saved while weights do not total 100.
- Published/active scoring profiles require a total weight of exactly 100.
- Inactive parameters are excluded from new reporting entry but remain readable
  for historical reports.
- Local group/trainee scoring profiles override inherited scoring behavior only
  where the spec says the local profile is detached.

### Reporting drafts and publishing

- Partial saves create drafts.
- Drafts do not affect report calculations.
- Publishing is atomic for one trainee and one reporting day.
- Published reports create or update the score entries needed by existing report
  builders.
- Editing a published report requires the edit-report permission and writes
  audit evidence.
- Report notes are stored at trainee-and-day level, not per parameter.

### Vacations

- Institution, group, and trainee vacation scopes combine additively.
- Vacation days are marked for reporting but do not block exceptional reporting.
- Published exceptional reports on vacation days count in calculations.
- Users without vacation-management permission cannot create or edit vacation
  records.

### UI/E2E after services exist

- Page flows should cover permission denial, successful create/edit, draft save,
  publish, and vacation-day warning behavior.
- RTL layout and Hebrew labels should be verified in Playwright for the main
  happy paths.
- E2E must keep using isolated test auth and `steps_test`; it must not depend on
  real Google OAuth or seeded `steps_dev` data.

## Regression guardrails

- Do not add mocks for behavior that depends on schema constraints, institution
  ownership, `@db.Date`, or Prisma relation behavior when an integration test can
  cover the real path.
- Do not update existing report-calculation expectations until the schema/service
  change explains whether drafts, inactive parameters, or local profiles should
  be included.
- Do not weaken current Google OAuth page/auth tests while adding test-only auth
  helpers for new flows.
