# Codebase File Audit

Status: in progress.

Last updated: 2026-07-06.

Purpose: repo-wide, file-by-file review documentation only. This audit records
whether each reviewed file is currently OK or needs fixes. It does not implement
fixes.

## Method

Each file is recorded only after two passes:

- Pass 1: read/review the file and compare against current specs, README, and
  recent `AGENT_CONVERSATION.md` entries.
- Pass 2: independently re-check the finding/status before writing it here.

Before every new batch write, the reviewer must re-check recent agent notes and
avoid duplicating findings already recorded in `AGENT_CONVERSATION.md` or
`docs/specs/legacy-cleanup-audit.md`.

Status values:

- `OK`: no new issue found in this audit pass.
- `Needs fix`: actionable issue not already fully covered elsewhere.
- `Covered elsewhere`: relevant issue exists, but it is already documented in
  another agent note/audit and is not duplicated here as a new finding.

## Batch 1 - Root Tooling And Environment

Pass 1 reviewer: Claude as Reviewer + Tester.
Pass 2 verifier: Claude as Reviewer + Tester.

| File | Area | Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `.env.example` | Local env template | OK | Done | Done | Template uses dev DB and empty OAuth/Auth values; no secrets committed. |
| `.env.test.example` | Test env template | OK | Done | Done | Dedicated `steps_test` URL and destructive-test warning are present. Real-Postgres harness is already documented in prior peer notes. |
| `.gitignore` | Git hygiene | OK | Done | Done | Ignores env files, generated Prisma client, build/test artifacts, logs, PEMs, and Google client secret JSONs while allowing `.env*.example`. |
| `.vscode/settings.json` | Local editor performance | Covered elsewhere | Done | Done | Watcher/search excludes match the 2026-07-06 performance-review note. No new app-code issue added here. |
| `docker-compose.yml` | Optional local Postgres | OK | Done | Done | Task D aligned the optional Docker image to `postgres:17-alpine`, matching the README PostgreSQL 17 local setup. |
| `eslint.config.mjs` | Lint config | OK | Done | Done | Ignores generated/build/test artifacts and keeps intentional unused `_name` params as warnings. Prior lint hangs are documented as environment/tooling contention, not a config bug. |
| `next.config.ts` | Next config | OK | Done | Done | Only switches `distDir` when `NEXT_DIST_DIR=next-e2e-build`, matching the existing E2E runner design documented by prior agents. |
| `package-lock.json` | Dependency lock | OK | Done | Done | Node JSON parse confirmed lockfile root matches `package.json` for key dependencies (`next`, Prisma, React, Vitest); lockfileVersion is 3. |
| `package.json` | Scripts/dependencies | OK | Done | Done | Scripts map to existing unit, integration, E2E, Prisma, lint, build flows. Prior runner hangs are already documented as local I/O/contention. |
| `playwright.config.ts` | E2E config | OK | Done | Done | Requires `TEST_DATABASE_URL`, refuses equality with dev DB URL, uses isolated `next-e2e-build`, loopback base URL, serial workers, and E2E auth env. |
| `prisma.config.ts` | Prisma CLI config | OK | Done | Done | Uses `dotenv/config`, schema/migration paths, seed command, and `DATABASE_URL` datasource. No new issue beyond known Prisma CLI hangs in the Dropbox workspace. |
| `tsconfig.json` | TypeScript config | Covered elsewhere | Done | Done | Strict settings and Next plugin are enabled. Includes generated Next/E2E type folders by design; related local slowness/artifact concerns are already covered by performance notes and `.vscode/settings.json`. |
| `vitest.config.ts` | Unit/page test config | OK | Done | Done | Unit/page tests are restricted to `src/**/*.test.ts(x)` and keep DB-free separation from integration tests. |
| `vitest.integration.config.ts` | Real-Postgres integration config | OK | Done | Done | Integration tests are restricted to `tests/integration/**/*.test.ts`, use setup guard, and run serially to avoid DB reset races. |

## Batch 2 - Public And App Assets

Pass 1 reviewer: Claude as Reviewer + Tester.
Pass 2 verifier: Claude as Reviewer + Tester.

| File | Area | Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `public/file.svg` | Default public asset | Covered elsewhere | Done | Done | Default Next template asset. LC-02 in `docs/specs/legacy-cleanup-audit.md` tracked this; removed during LCU-01 after no runtime/source references were found. |
| `public/globe.svg` | Default public asset | Covered elsewhere | Done | Done | Default Next template asset. LC-02 in `docs/specs/legacy-cleanup-audit.md` tracked this; removed during LCU-01 after no runtime/source references were found. |
| `public/next.svg` | Default public asset | Covered elsewhere | Done | Done | Default Next template asset. LC-02 in `docs/specs/legacy-cleanup-audit.md` tracked this; removed during LCU-01 after no runtime/source references were found. |
| `public/vercel.svg` | Default public asset | Covered elsewhere | Done | Done | Default Next template asset. LC-02 in `docs/specs/legacy-cleanup-audit.md` tracked this; removed during LCU-01 after no runtime/source references were found. |
| `public/window.svg` | Default public asset | Covered elsewhere | Done | Done | Default Next template asset. LC-02 in `docs/specs/legacy-cleanup-audit.md` tracked this; removed during LCU-01 after no runtime/source references were found. |
| `src/app/favicon.ico` | App icon asset | OK | Done | Done | Valid ICO header was confirmed; App Router can use this file convention automatically. Not part of LC-02. |

## Batch 3 - Test And E2E Scripts

Pass 1 reviewer: Claude as Reviewer + Tester.
Pass 2 verifier: Claude as Reviewer + Tester.

| File | Area | Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `scripts/test-db-migrate.mjs` | Test DB migration wrapper | OK | Done | Done | Task D added a guard that refuses to run when `TEST_DATABASE_URL` matches `DATABASE_URL`, before spawning Prisma with the test database URL. |
| `scripts/e2e-build.mjs` | E2E build wrapper | OK | Done | Done | Task D now tracks whether the wrapper actually acquired `test-results/e2e-build.lock` and removes it only when owned by the current process. |
| `scripts/e2e-start.mjs` | E2E server wrapper | OK | Done | Done | Starts Next with the isolated E2E dist dir and forwards SIGINT/SIGTERM to the child. Existing E2E coordination notes already cover its purpose; no new issue found in this pass. |

## Batch 4 - Library And Auth Types

Pass 1 reviewer: Claude as Reviewer + Tester.
Pass 2 verifier: Claude as Reviewer + Tester.

| File | Area | Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/lib/auth.ts` | Auth.js Google staff authorization | Needs fix | Done | Done | `signIn` blocks users without an active staff row, but the `jwt` callback only updates claims when `findActiveStaffUserByEmail()` finds a user. If a staff row is later deactivated/deleted, an existing token can keep old `staffUserId`/`role`/`institutionId`, and `session` will continue exposing them. Clear those claims or otherwise invalidate the session when no active staff row is found. |
| `src/lib/dateOnly.test.ts` | Date helper unit coverage | OK | Done | Done | Covers UTC extraction, local-boundary regression, round-trip, floor, and end-of-day behavior for the current UTC-date decision. |
| `src/lib/dateOnly.ts` | Date-only normalization | OK | Done | Done | Centralizes UTC date-only handling and explicitly documents the still-open product question around institution-local days. No new code issue found. |
| `src/lib/prisma.ts` | Prisma singleton | OK | Done | Done | Uses Prisma 7 `PrismaPg` adapter and dev global singleton pattern. Missing/slow DB behavior is already captured in environment/OAuth notes, not a new issue in this file. |
| `src/types/next-auth.d.ts` | Auth/session type augmentation | OK | Done | Done | Session and JWT augmentation matches fields assigned by `src/lib/auth.ts`; no new type issue found. |

## Batch 5 - Reporting And Stage Scoring Read Model

Pass 1 reviewer: Codex Code Audit Reviewer.
Pass 2 verifier: Codex Code Audit Reviewer.

Scope note: static review only. Before this batch write, recent
`AGENT_CONVERSATION.md` entries and `docs/specs/legacy-cleanup-audit.md` were
rechecked. Known peer findings are marked without re-claiming them as new.
Automated tests were not run because local runner/I/O slowness is already
documented by prior agents.

| File | Area | Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/services/reports/reportService.ts` | Reporting mutations | Needs fix | Done | Done | Known peer finding still applies: editing an existing `PUBLISHED` report rebuilds current report context and writes `stageProgramVersionId` / `scoringProfileId`, so historical reports can be silently repinned to newer settings. This is already recorded in `AGENT_CONVERSATION.md` and is not a new duplicate finding. |
| `tests/integration/reportService.integration.test.ts` | Reporting integration tests | Needs fix | Done | Done | Missing the regression requested by the peer finding: editing a published report after a newer stage-program version or scoring profile exists must preserve the original pinned ids. Existing tests cover draft isolation, profile score-scale validation, `EDIT_REPORTS`, audit row creation, and inactive-group blocking. |
| `src/services/stagePrograms/fitReport.ts` | Fit-report read model | Needs fix | Done | Done | New finding: `dataSufficiency.parametersExpected` is always `legacyParameters.length`, while profile-backed report days use `ScoringProfileParameter` ids. If a group/trainee profile adds, disables, or changes parameters, the warning counts can under-report or over-report parameter coverage even though the daily score uses profile parameters. |
| `tests/integration/fitReport.integration.test.ts` | Fit-report integration tests | Needs fix | Done | Done | Missing coverage for profile-backed/local scoring-profile data sufficiency, especially custom added parameters and inactive/inherited parameters. Existing tests cover legacy parameter backfill, `NOT_APPLICABLE`, required day counts, UTC day bucketing, institution scoping, and group membership filtering. |
| `src/services/stagePrograms/scoring.ts` | Pure score calculation | OK | Done | Done | Supports caller-provided `maxRawScore` for non-1-to-10 scales and handles `NOT_SCORED` / `NOT_APPLICABLE` according to spec. Current write paths validate integer/range before persisted scores reach this helper. |
| `src/services/stagePrograms/scoring.test.ts` | Pure score unit tests | Needs fix | Done | Done | Missing a direct unit regression for non-10 `maxRawScore` scoring even though the helper supports it. The behavior has some integration coverage through report profile scale tests, but the pure helper should pin `1-3` and `1-100` math directly. |
| `src/services/stagePrograms/dataSufficiency.ts` | Data sufficiency helper | OK | Done | Done | Pure helper intentionally decides sufficiency by measurement-day count only and passes parameter counts through for warning UI. The profile-count issue is in the caller `fitReport.ts`, not this helper. |
| `src/services/stagePrograms/dataSufficiency.test.ts` | Data sufficiency unit tests | OK | Done | Done | Covers day-based sufficiency and raw count pass-through. Profile-specific count construction belongs to `fitReport` tests. |
| `src/repositories/scoreEntryRepository.ts` | Score entry repository | OK | Done | Done | Draft isolation filter is present for read-model consumers, and direct `upsertScoreEntry()` normalizes date/status/rawScore for legacy parameter-definition writes. The broader future score-entry UI/service-boundary concern is already documented as product-blocked and is not a new issue in this file. |
| `tests/integration/scoreEntry.integration.test.ts` | Score entry integration tests | OK | Done | Done | Covers accepted scores, invalid `SCORED` rejection, `NOT_SCORED` / `NOT_APPLICABLE` raw-score clearing, date normalization, and rejected invalid updates preserving existing rows. |
| `tests/integration/db.ts` | Integration fixture helpers | OK | Done | Done | Fixture/reset helpers match the current schema tables used by the integration suite and include score-scale parameter creation support needed by reporting tests. |

## Batch 6 - Remaining Repositories

Pass 1 reviewer: Claude as Reviewer + Tester.
Pass 2 verifier: Claude as Reviewer + Tester.

Scope note: this batch intentionally excludes repository files already covered
in Batch 5. Recent agent notes were rechecked before writing.

| File | Area | Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/repositories/groupRepository.ts` | Group data access | OK | Done | Done | Thin CRUD/list helper; permission, institution, active-group, and staff-assignment validation live in `groupService`. No new repository-level issue found. |
| `src/repositories/institutionRepository.ts` | Institution reads | OK | Done | Done | Simple `findUnique`/ordered list access. No new issue found. |
| `src/repositories/permissionRepository.ts` | Permission UI summaries | OK | Done | Done | Read-only summaries scoped by institution. Write invariants are handled in services and separately documented where incomplete. No new issue found. |
| `src/repositories/staffUserRepository.ts` | Staff user reads | OK | Done | Done | Active Google staff lookup is case-insensitive and trims email. The stale-JWT issue is in `src/lib/auth.ts`, not this repository. |
| `src/repositories/stageProgramRepository.ts` | Stage-program reads | Covered elsewhere | Done | Done | `getPrimaryStageProgramVersion()` uses the documented single-primary-program assumption. Multi-program selection remains an open product decision already covered in README/spec notes. |
| `src/repositories/traineeRepository.ts` | Trainee data access/history | OK | Done | Done | Thin record helpers normalize membership dates and store transfer history. Permission/active-group/effective-date behavior is service-level; no new repository-only issue found in this pass. |
| `src/repositories/vacationRepository.ts` | Vacation period records | OK | Done | Done | Thin record helpers normalize date-only fields. Scope/date validation is service-level and already covered by vacation service work. No new repository-only issue found. |

## Batch 7 - Permission Backend Services

Pass 1 reviewer: Codex Code Audit Reviewer.
Pass 2 verifier: Codex Code Audit Reviewer.

Scope note: static review only. Before this batch write, recent
`AGENT_CONVERSATION.md`, this ledger, and `docs/specs/legacy-cleanup-audit.md`
were rechecked. The already-fixed malformed-scope UI issue and older
permission-scope hardening notes are not duplicated as new findings here.

| File | Area | Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/services/permissions/actions.ts` | Permission action constants | Covered elsewhere | Done | Done | The file intentionally centralizes all enum actions, but it still includes generic/future actions such as `VIEW`, `EDIT`, `EDIT_SETTINGS`, and `CHANGE_STAGE`; LC-04 in `docs/specs/legacy-cleanup-audit.md` already asks for keep/hide/remove classification, so this is not duplicated as a new finding. |
| `src/services/permissions/rolePermissionDefaults.ts` | Default role matrix | OK | Done | Done | Creates default role/action rows for the centralized action list with ADMIN allowed and other roles denied. No new service-level issue beyond the action-classification note already covered elsewhere. |
| `src/services/permissions/resolvePermission.ts` | Permission resolution | OK | Done | Done | Current code fails closed for missing/foreign group or trainee ids, mismatched group+trainee scope, malformed override rows, and same-specificity conflicts via DENY. The caller contract for group-scoped trainee actions is already covered by prior peer notes/tests. |
| `src/services/permissions/permissionOverrideService.ts` | User override write boundary | OK | Done | Done | Validates staff/group/trainee institution scope, rejects both group and trainee ids, and deduplicates same-scope rows in a transaction. No new issue found in this pass. |
| `src/services/permissions/permissionManagementService.ts` | Permission management mutations | Needs fix | Done | Done | New finding: `setManagedUserPermissionOverride()` writes the override through `upsertUserPermissionOverride()` and then writes `PERMISSION.USER_OVERRIDE_SET` audit in a separate operation. If audit creation fails, the permission change can persist without audit. `setManagedRolePermission()` already keeps mutation+audit in one transaction; user override changes need equivalent atomicity. |
| `tests/integration/permissions.integration.test.ts` | Permission resolution integration tests | OK | Done | Done | Covers admin-only defaults, legacy `EDIT` not bypassing new actions, override precedence, foreign/missing scopes, group-to-trainee scope, mismatched group+trainee denial, DENY tie behavior, and malformed override denial. |
| `tests/integration/permissionOverrideService.integration.test.ts` | Override service integration tests | OK | Done | Done | Covers scoped and institution-wide override writes, malformed scope rejection, staff/group/trainee cross-institution rejection, and deterministic duplicate cleanup. |
| `tests/integration/permissionManagementService.integration.test.ts` | Permission management integration tests | Needs fix | Done | Done | Tests prove successful role audit, unauthorized denial, and successful managed user override audit, but they do not cover atomic rollback for user override + audit. Add coverage when `setManagedUserPermissionOverride()` is made transactional. |

## Batch 8 - Codex Verification Addendum For Previously Covered Files

Pass 1 reviewer: Codex Code Audit Reviewer.
Pass 2 verifier: Codex Code Audit Reviewer.

Scope note: this batch adds only findings that were not already covered by the
earlier batch rows, `AGENT_CONVERSATION.md`, or `docs/specs/legacy-cleanup-audit.md`.
It does not replace previous rows; it records second-pass disagreement or extra
findings discovered after those rows were written.

| File | Area | Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/services/reports/reportService.ts` | Reporting mutations | Needs fix | Done | Done | New finding in addition to the already-recorded published-report pinning risk: `writeReport()` deletes existing `ScoreEntry` rows for the same trainee/date/parameter ids before creating draft or published report rows. When `saveTraineeReportDraft()` is used against a day that has legacy/standalone score entries but no `MeasurementReport`, the draft can remove currently visible score data even though draft-linked rows are filtered out of fit reports. Preserve existing visible rows until publish or explicitly model replacement semantics. |
| `src/services/stagePrograms/fitReport.ts` | Fit-report read model | Needs fix | Done | Done | New finding in addition to the existing `parametersExpected` issue: `parametersFromScoringProfile()` falls back to source name and score scale, but not to `sourceParameterDefinition.weightPercent`. Inherited local profile parameters with `weightPercent = null` can be scored as weight `0` even though publish validation uses the source weight. |
| `src/repositories/stageProgramRepository.ts` | Stage-program reads | Needs fix | Done | Done | New finding: `getLatestStageProgramVersion()` chooses the highest `versionNumber` without filtering `status`, `effectiveFrom`, or `effectiveTo`. A future `DRAFT` or `REPLACED` version with a higher number can become the active config used by pages/reports. |

## Batch 9 - App Routes, UI, And Server Actions

Pass 1 reviewer: Codex Code Audit Reviewer.
Pass 2 verifier: Codex Code Audit Reviewer.

Scope note: static review only. Recent agent notes were rechecked before this
batch write. Server Action files were reviewed for validation/authorization shape,
but no code was executed or changed.

| File | Area | Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/app/AppShell.tsx` | Shared app chrome | OK | Done | Done | Displays identity, role label, back link, and sign-out affordance. No new issue found. |
| `src/app/authActions.ts` | Sign-out action | OK | Done | Done | Thin server action calling `signOut({ redirectTo: "/login" })`; no new issue found. |
| `src/app/globals.css` | Global CSS | OK | Done | Done | Basic reset and app background only; no new functional issue found. |
| `src/app/layout.tsx` | Root layout | OK | Done | Done | Hebrew RTL layout and metadata are set; no new issue found. |
| `src/app/login/page.tsx` | Google login page | OK | Done | Done | Handles missing OAuth env and known Auth.js errors. Stale active-staff-session behavior is covered in `src/lib/auth.ts`, not here. |
| `src/app/page.tsx` | Home/groups dashboard | OK | Done | Done | Institution and management lists are scoped to the signed-in user's institution; no new issue found. |
| `src/app/page.module.css` | App UI CSS module | OK | Done | Done | Responsive tables/forms/cards have stable basic layout; no new functional issue found. |
| `src/app/api/auth/[...nextauth]/route.ts` | Auth route | OK | Done | Done | Re-exports Auth.js handlers from `src/lib/auth.ts`; no route-specific issue found. |
| `src/app/api/e2e/fixture/route.ts` | E2E fixture route | OK | Done | Done | Guarded by `E2E_TEST_AUTH=1` plus loopback `AUTH_URL`; destructive reset is test-only. No new issue found. |
| `src/app/api/e2e/session/route.ts` | E2E session route | OK | Done | Done | Guarded by `E2E_TEST_AUTH=1` plus loopback `AUTH_URL`, requires active staff and `AUTH_SECRET`; no new issue found. |
| `src/app/groups/actions.ts` | Group server actions | OK | Done | Done | Delegates authorization and institution validation to `groupService`; no new issue found. |
| `src/app/groups/[groupId]/page.tsx` | Group page | OK | Done | Done | Fails closed for foreign groups and gates report/management/vacation sections by permissions. No new issue found. |
| `src/app/groups/groupActionMessages.ts` | Group action messages | OK | Done | Done | Maps current group error/notice codes; no new issue found. |
| `src/app/permissions/actions.ts` | Permission server actions | OK | Done | Done | The earlier malformed-scope widening bug is fixed; current action rejects missing group/trainee ids. No new issue found. |
| `src/app/permissions/page.tsx` | Permission UI | Covered elsewhere | Done | Done | Raw enum/future/legacy action display is already covered by LC-04 in `docs/specs/legacy-cleanup-audit.md`. No new duplicate finding added. |
| `src/app/permissions/permissionActionMessages.ts` | Permission action messages | OK | Done | Done | Covers current permission-management error/notice codes. No new issue found. |
| `src/app/trainees/actions.ts` | Trainee server actions | Covered elsewhere | Done | Done | Delegates stage validation and transfer effective-date semantics to `traineeService`; the service-level issues are recorded in Batch 9. No separate action-layer issue found. |
| `src/app/trainees/[traineeId]/page.tsx` | Trainee page | OK | Done | Done | Uses local date getters for transfer date input defaults, fails closed for foreign trainees, and gates edit/transfer/vacation/report sections by permissions. No new issue found. |
| `src/app/trainees/traineeActionMessages.ts` | Trainee action messages | OK | Done | Done | Maps current trainee service error/notice codes, including invalid transfer date. No new issue found. |
| `src/app/vacations/actions.ts` | Vacation server actions | OK | Done | Done | Parses date-only inputs as UTC midnight and constrains `returnTo` to local paths. Service-level audit atomicity is recorded in Batch 9. |
| `src/app/vacations/VacationManagement.tsx` | Vacation management UI | OK | Done | Done | Task D changed `dateInputValue()` to local calendar getters, matching the transfer date input approach and avoiding previous-UTC-day defaults near local midnight. |
| `src/app/vacations/vacationActionMessages.ts` | Vacation action messages | OK | Done | Done | Maps current vacation service error/notice codes. No new issue found. |

## Batch 10 - Domain Services Not Fully Covered Above

Pass 1 reviewer: Codex Code Audit Reviewer.
Pass 2 verifier: Codex Code Audit Reviewer.

Scope note: files already covered by Batches 5 and 7 are not repeated unless a
cross-file service invariant needed to be named from the service boundary.

| File | Area | Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/services/audit/auditLogService.ts` | Audit append helper | OK | Done | Done | Validates action format, institution existence, and actor institution before append. No new issue found in the helper itself. |
| `src/services/groups/groupService.ts` | Group management service | OK | Done | Done | Enforces actor institution, `MANAGE_GROUPS`, active staff assignment scope, name normalization, and group ownership. No new issue found. |
| `src/services/permissions/actions.ts` | Permission action constants | Covered elsewhere | Done | Done | Generic historical actions (`VIEW`, `EDIT`, `EDIT_SETTINGS`) and raw UI exposure are already covered by LC-04. Default "only ADMIN allowed" behavior matches the current user decision. |
| `src/services/permissions/permissionManagementService.ts` | Managed permission changes | Needs fix | Done | Done | `setManagedRolePermission()` writes role permission and audit log in one transaction, but `setManagedUserPermissionOverride()` first calls `upsertUserPermissionOverride()` and only then creates audit separately. If the audit write fails, the user override persists without an audit row. Keep the override mutation and audit append atomic. |
| `src/services/permissions/permissionOverrideService.ts` | User override upsert | OK | Done | Done | Validates staff/group/trainee scope and deduplicates same-scope rows inside its own transaction. Manager-level audit atomicity is recorded in `permissionManagementService.ts`. |
| `src/services/permissions/resolvePermission.ts` | Permission resolver | OK | Done | Done | Verifies scope ownership against DB, rejects malformed matching overrides, applies user-override specificity, and denies by default. No new issue found. |
| `src/services/permissions/rolePermissionDefaults.ts` | Default permission seeding | OK | Done | Done | Seeds current action/role matrix using the explicit default posture: only ADMIN allowed unless changed. No new issue found. |
| `src/services/stagePrograms/parameterWeights.ts` | Weight-total validation | Needs fix | Done | Done | The validator requires each exact `stageId` bucket, including `null`, to sum to 100 independently. Runtime scoring applies all-stage (`stageId = null`) parameters together with current-stage parameters, so the service can publish 100% global parameters plus 100% stage-specific parameters for the same stage, producing an effective >100% scoring set. Validate the effective parameter set per stage. |
| `src/services/stagePrograms/recommendation.ts` | Stage recommendation | Covered elsewhere | Done | Done | Intentionally throws because threshold boundary semantics remain an open product question. This is documented in schema/comments/spec notes and is not a fix-now issue. |
| `src/services/stagePrograms/stageSettingsService.ts` | Stage/scoring settings service | Needs fix | Done | Done | Uses `validateParameterWeightTotals()` for institution and local profile publish, so it inherits the global-plus-stage effective-weight bug from `parameterWeights.ts`. Also verify report-read fallback in `fitReport.ts` before relying on inherited local weights at runtime. |
| `src/services/trainees/traineeService.ts` | Trainee management service | Needs fix | Done | Done | `assertStageInInstitution()` accepts any stage from the same institution, including stages from older/replaced/draft stage-program versions, even though the UI lists stages from the current primary version. Also, transfers with a future `effectiveFrom` immediately update `Trainee.groupId`, so "current group" changes before the effective date while history says it should change later. |
| `src/services/vacations/vacationService.ts` | Vacation management service | Needs fix | Done | Done | Create/update/delete write the vacation row through repository helpers and then append audit in a separate write. If audit append fails after the mutation, the sensitive vacation change persists without its audit row. Use one transaction or an audit helper that can participate in the same transaction. |

## Batch 11 - Prisma Schema, Seed, Generated Types, And Migrations

Pass 1 reviewer: Codex Code Audit Reviewer.
Pass 2 verifier: Codex Code Audit Reviewer.

| File | Area | Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `next-env.d.ts` | Generated Next types | Covered elsewhere | Done | Done | Generated/regenerable file already covered by LC-01. No source-code issue duplicated here. |
| `prisma/schema.prisma` | Data model | Covered elsewhere | Done | Done | Legacy `passwordHash`, generic permission actions, and older trainee override models are already covered by LC-03..LC-05. The schema already has status/effective/replacement fields; the active-version bug is in repository/service usage, not the schema definition. |
| `prisma/seed.ts` | Dev seed | OK | Done | Done | Seeds one institution, current staff emails from env, default role permissions, groups, stage program, stages, parameters, thresholds, trainees, membership history, and sample score rows. No new issue found. |
| `prisma/migrations/migration_lock.toml` | Prisma migration lock | OK | Done | Done | Provider lock matches PostgreSQL datasource. No new issue found. |
| `prisma/migrations/20260703112733_init/migration.sql` | Initial migration | OK | Done | Done | Historical migration artifact; no manual-edit issue found in this audit. |
| `prisma/migrations/20260705234500_imp01_schema_foundation/migration.sql` | Schema-foundation migration | OK | Done | Done | Historical migration artifact for the current foundation models/enums; no manual-edit issue found in this audit. |

## Batch 12 - Test Coverage Files

Pass 1 reviewer: Codex Code Audit Reviewer.
Pass 2 verifier: Codex Code Audit Reviewer.

Scope note: this is a static coverage review. Tests were not run because local
runner and Dropbox I/O slowness is already documented by prior agents.

| File | Area | Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/app/appRoutes.test.tsx` | App route unit coverage | Covered elsewhere | Done | Done | Task D added a focused regression for vacation date input defaults using the local calendar day. Automated execution is blocked in the Dropbox workspace and recorded in the Task D result entry. |
| `src/services/stagePrograms/parameterWeights.test.ts` | Weight validation unit coverage | Needs fix | Done | Done | Missing regression for effective per-stage totals where all-stage parameters and stage-specific parameters apply together. Current service behavior can validate each bucket separately while runtime scoring combines them. |
| `tests/e2e/page-auth.spec.ts` | E2E auth/page smoke | OK | Done | Done | Covers logged-out login/guard, authenticated admin group/trainee views, denied report state, and foreign group 404 through E2E fixture/session routes. No new issue found. |
| `tests/integration/auditLogService.integration.test.ts` | Audit helper integration | OK | Done | Done | Covers append, ordering, actor institution guard, and invalid action rejection. No new issue found. |
| `tests/integration/fitReport.integration.test.ts` | Fit-report integration | Needs fix | Done | Done | Missing regressions for inherited local `ScoringProfileParameter.weightPercent = null` fallback to source weight and for profile-backed `parametersExpected` counts. Existing tests cover legacy scoring, `NOT_APPLICABLE`, UTC date bucketing, institution scoping, and group membership history. |
| `tests/integration/groupService.integration.test.ts` | Group service integration | OK | Done | Done | Covers create/update, staff assignment scoping, inactive archive listing, and permission failures. No new issue found. |
| `tests/integration/permissionManagementService.integration.test.ts` | Permission management integration | Needs fix | Done | Done | Covers audit rows after success, but not atomicity when audit append fails after a user override mutation. Add a failure-path regression once the service is made transactional. |
| `tests/integration/permissionOverrideService.integration.test.ts` | User override integration | OK | Done | Done | Covers scoped override validation and dedupe behavior. No new issue found. |
| `tests/integration/permissions.integration.test.ts` | Resolver/default permissions integration | OK | Done | Done | Covers default denial/allow behavior, user override precedence, malformed override fail-closed behavior, and scope ownership. No new issue found. |
| `tests/integration/reportService.integration.test.ts` | Report service integration | Needs fix | Done | Done | In addition to the existing missing published-report pinning regression, add a draft regression proving `saveTraineeReportDraft()` does not remove currently visible standalone/published score data until publish. |
| `tests/integration/scoreEntry.integration.test.ts` | Score entry repository integration | OK | Done | Done | Covers repository's current legacy 1-10 write contract and read filtering. Future scaled report writes are covered through `reportService`, not this repository. |
| `tests/integration/stageSettingsService.integration.test.ts` | Stage settings integration | Needs fix | Done | Done | Missing regression for global-plus-stage effective weight totals on institution/group/trainee scoring-profile publish. Existing tests cover drafts, publish guards, local inheritance/reset, scoped permission checks, and trainee profile ownership after transfer. |
| `tests/integration/traineeService.integration.test.ts` | Trainee service integration | Needs fix | Done | Done | Missing regressions that same-institution but inactive/old/draft-version stages are rejected, and that future-dated transfers do not change the current group before their effective date unless that is explicitly the intended product decision. |
| `tests/integration/vacationService.integration.test.ts` | Vacation service integration | Needs fix | Done | Done | Covers CRUD, audit rows after success, scope validation, permission denial, and effective vacation lookup, but not mutation/audit atomicity failure paths. |
| `tests/integration/vitestSetup.ts` | Integration setup guard | OK | Done | Done | Loads `.env.test`, requires `TEST_DATABASE_URL`, refuses exact equality with dev `DATABASE_URL`, and redirects app Prisma imports to the test DB before test imports. No new issue found. |

## Batch 13 - Documentation And Agent Collaboration Files

Pass 1 reviewer: Codex Code Audit Reviewer.
Pass 2 verifier: Codex Code Audit Reviewer.

Scope note: Claude's 12:52 coverage check intentionally excluded non-runtime
specification and collaboration documents from the application-code ledger. This
batch adds them because the latest user request asked for every file to be
marked. Before writing, recent `AGENT_CONVERSATION.md`, this ledger, and
`docs/specs/legacy-cleanup-audit.md` were rechecked to avoid duplicate findings.

| File | Area | Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `.agents/plugins/marketplace.json` | Local plugin marketplace | OK | Done | Done | Points at the local `plugins/agent-peer-collaboration` source and keeps the plugin available for installation. No new issue found. |
| `.agents/skills/agent-peer-collaboration/SKILL.md` | Repo collaboration skill | OK | Done | Done | Vendor-neutral protocol wording is present and the file correctly frames the skill as a Codex-facing adapter over `AGENTS.md` plus `AGENT_CONVERSATION.md`. No new issue found. |
| `.agents/skills/agent-peer-collaboration/agents/openai.yaml` | Repo skill OpenAI adapter | OK | Done | Done | Default prompt names `$agent-peer-collaboration` as a Codex adapter while explicitly pointing to the vendor-neutral board shared by Codex, Claude, Gemini, Copilot Auto, and other agents. |
| `plugins/agent-peer-collaboration/.codex-plugin/plugin.json` | Codex plugin manifest | OK | Done | Done | Manifest version matches the documented cachebusted plugin source and presents the plugin as a vendor-neutral shared-board adapter. No new issue found. |
| `plugins/agent-peer-collaboration/skills/agent-peer-collaboration/SKILL.md` | Plugin collaboration skill | OK | Done | Done | Mirrors the repo skill behavior and keeps `AGENTS.md` plus `AGENT_CONVERSATION.md` as the source of truth. No new issue found. |
| `plugins/agent-peer-collaboration/skills/agent-peer-collaboration/agents/openai.yaml` | Plugin OpenAI adapter | OK | Done | Done | Matches the repo adapter prompt and keeps the Codex-specific invocation scoped to the adapter. No new issue found. |
| `AGENTS.md` | Repository agent rules | OK | Done | Done | Vendor-neutral collaboration instructions are concise, and the Next.js documentation warning remains visible before coding. No new issue found. |
| `CLAUDE.md` | Claude bootstrap | OK | Done | Done | Minimal pointer back to `AGENTS.md`, which is the intended source of truth. No new issue found. |
| `AGENT_ONBOARDING_PROMPT.md` | Universal agent onboarding | OK | Done | Done | Current prompt is vendor-neutral and routes agents to `AGENTS.md`, `README.md`, the board, and current specs before work. No new issue found. |
| `AGENT_RUN_PROMPTS.md` | Agent run prompts | OK | Done | Done | The active reset prompt is vendor-neutral; older role prompts are explicitly labeled historical context. The stale live-board risk is recorded on `AGENT_CONVERSATION.md`, not duplicated here. |
| `AGENT_CONVERSATION.md` | Shared work board | OK | Done | Done | Task D added a fresh 2026-07-06 active execution board above the preserved 2026-07-05 historical board, so agents entering at the top can see current claims and runner blockers. |
| `README.md` | Project setup and current-state docs | OK | Done | Done | Task D synced the current folder structure, implemented permissions/vacation/group/trainee management surfaces, test DB equality guard, and the current weight-validation debt. |
| `docs/specs/base-data-and-daily-reporting.md` | Base-data/reporting spec | OK | Done | Done | Task D added 2026-07-06 status notes marking outdated group, trainee-history, and score-scale/direct-reporting gap notes as partially obsolete while preserving the historical decisions. |
| `docs/specs/stage-program-parameter-settings.md` | Stage settings spec | OK | Done | Done | Task D added a 2026-07-06 status note that points to the unified app model and clarifies which schema/service gaps are historical versus still open. |
| `docs/specs/implementation-task-map.md` | Implementation readiness map | OK | Done | Done | This file is a readiness/dependency map rather than the live execution ledger; current task status is expected to come from `AGENT_CONVERSATION.md`. No new issue found. |
| `docs/specs/legacy-cleanup-audit.md` | Legacy cleanup audit | OK | Done | Done | Preliminary status, peer-review requirement, and do-not-delete guidance are explicit. Its existing README/default-asset/schema findings are intentionally not duplicated as new issues here. |
| `docs/specs/codebase-file-audit.md` | File audit ledger | OK | Done | Done | Ledger now includes application code plus non-runtime documentation/collaboration files with two-pass rows. No self-ledger issue found after this batch. |
| `tests/IMP-11-regression-plan.md` | Regression planning doc | OK | Done | Done | Kept as a planning companion with baseline/post-IMP-01 verification notes and behavioral test obligations. Newer missing-test findings are tracked in this audit ledger. No new issue found. |

## Batch 14 - Post-Fix Status Sync For Earlier Findings

Pass 1 reviewer: Claude as Tester + Builder.
Pass 2 verifier: Claude as Tester + Builder.

Scope note: source/docs recheck only. Before this batch write, recent
`AGENT_CONVERSATION.md` entries, this ledger, and the relevant current files
were rechecked. This batch does not rewrite historical rows; it supersedes the
older `Needs fix` rows below where completed Task A/B/C/LCU-03 work already
changed the implementation. Automated Vitest/typecheck/integration confirmation
is still blocked in the Dropbox workspace and is owned by the active
non-Dropbox verification lane.

| File | Area | Current Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/lib/auth.ts` | Auth.js Google staff authorization | OK | Done | Done | `syncStaffClaims()` now clears app authorization claims when no active staff row is found, and `syncSessionStaffUser()` removes `session.user` when required token claims are missing. This closes the stale JWT/session finding from Batch 4 at the source level. |
| `src/lib/auth.test.ts` | Auth claim/session unit coverage | OK | Done | Done | New focused tests cover clearing stale staff claims, replacing claims from an active staff row, removing session user when claims are absent, and copying valid claims into the session. Runner confirmation remains blocked elsewhere. |
| `src/services/permissions/permissionManagementService.ts` | Managed permission changes | OK | Done | Done | `setManagedUserPermissionOverride()` now runs override upsert plus `PERMISSION.USER_OVERRIDE_SET` audit inside one Prisma transaction, matching the role-permission path and closing the audit atomicity finding. |
| `tests/integration/permissionManagementService.integration.test.ts` | Permission management integration | OK | Done | Done | Added rollback coverage for managed user override when audit cannot be written. Execution is still pending in the verification lane. |
| `src/services/vacations/vacationService.ts` | Vacation management service | OK | Done | Done | Create/update/delete now wrap the vacation mutation and audit append in one transaction. This closes the mutation-without-audit finding at the source level. |
| `tests/integration/vacationService.integration.test.ts` | Vacation service integration | OK | Done | Done | Added failure-path rollback coverage for create, update, and delete when audit cannot be written. Execution is still pending in the verification lane. |
| `src/services/audit/auditLogService.ts` | Audit append helper | OK | Done | Done | `appendAuditLogEntry()` now accepts an optional transaction-compatible DB client while preserving the previous validation behavior. |
| `src/repositories/vacationRepository.ts` | Vacation period records | OK | Done | Done | Repository mutation helpers now accept a transaction-compatible client for service-level atomic writes. No repository-only issue found. |
| `src/services/reports/reportService.ts` | Reporting mutations | OK | Done | Done | Published-report edits preserve existing pinned `stageProgramVersionId` / `scoringProfileId`; new draft saves reject conflicts with visible standalone score rows, and draft deletes are limited to rows already linked to the draft report. |
| `tests/integration/reportService.integration.test.ts` | Reporting integration tests | OK | Done | Done | Added regressions for visible-standalone draft conflict and published-report pin preservation after newer settings exist. Execution is still pending in the verification lane. |
| `src/services/stagePrograms/fitReport.ts` | Fit-report read model | OK | Done | Done | Profile-backed reports now build expected parameter counts from the active report parameter set, fall back to source `weightPercent` for inherited local parameters, and pass each parameter's max raw score into scoring. |
| `tests/integration/fitReport.integration.test.ts` | Fit-report integration tests | OK | Done | Done | Added coverage for inherited local source weights and profile-backed `parametersExpected` counts. Execution is still pending in the verification lane. |
| `src/services/stagePrograms/scoring.test.ts` | Pure score unit tests | OK | Done | Done | Added direct non-10 max raw score coverage for 1-3 / 1-100 style scoring math and out-of-range validation. |
| `src/repositories/stageProgramRepository.ts` | Stage-program reads | OK | Done | Done | Active version lookup now filters to published, currently effective, unreplaced versions and accepts an optional `asOf` date. Multi-program selection remains an open product assumption covered elsewhere. |
| `src/services/stagePrograms/parameterWeights.ts` | Weight-total validation | OK | Done | Done | Weight validation now checks effective per-stage totals by combining all-stage and stage-specific parameters, including stage ids supplied by the active version. |
| `src/services/stagePrograms/parameterWeights.test.ts` | Weight validation unit coverage | OK | Done | Done | Added regressions for all-stage plus stage-specific effective totals and stage ids without explicit overrides. Execution is still pending in the verification lane. |
| `src/services/stagePrograms/stageSettingsService.ts` | Stage/scoring settings service | OK | Done | Done | Institution, group, and trainee profile publish now use effective-weight validation against the profile's stage-program version and inherited local source weights. |
| `tests/integration/stageSettingsService.integration.test.ts` | Stage settings integration | OK | Done | Done | Added active-version and effective global-plus-stage publish regressions for institution, group, and trainee profiles. Execution is still pending in the verification lane. |
| `src/services/trainees/traineeService.ts` | Trainee management service | OK | Done | Done | Current-stage validation now uses the active primary stage-program version, and future-dated transfers are rejected with `INVALID_DATE` before changing current group/history. |
| `tests/integration/traineeService.integration.test.ts` | Trainee service integration | OK | Done | Done | Added regressions for same-institution draft/replaced stages and future-dated transfer rollback. Execution is still pending in the verification lane. |
| `src/services/permissions/actions.ts` | Permission action constants | OK | Done | Done | `MANAGEABLE_PERMISSION_ACTIONS` now exposes only currently implemented/admin-manageable actions to UI surfaces while `ALL_PERMISSION_ACTIONS` remains for DB/default-role compatibility. Enum/schema removal remains blocked in `legacy-cleanup-audit.md`. |
| `src/app/permissions/page.tsx` | Permission UI | OK | Done | Done | Forms and the role table now use `MANAGEABLE_PERMISSION_ACTIONS`, hiding legacy/future generic actions from new UI management while preserving labels for existing rows. |
| `src/app/permissions/actions.test.ts` | Permission action unit coverage | OK | Done | Done | New tests cover malformed direct POST scope handling before service calls. Runner confirmation remains blocked elsewhere. |
| `src/app/appRoutes.test.tsx` | App route unit coverage | OK | Done | Done | Route coverage now asserts the 11 manageable permission actions and absence of hidden legacy/future Hebrew labels. Broader execution remains blocked in the verification lane. |

## Batch 15 - Stage Settings UI After Task F

Pass 1 reviewer: Codex Code Audit Reviewer.
Pass 2 verifier: Codex Code Audit Reviewer.

Scope note: static review only, after the Task F result entry. Recent
`AGENT_CONVERSATION.md`, current app-model specs, the Task F files, and the
existing audit ledger were rechecked before this batch. No app code was changed
and no tests were run because the non-Dropbox verification lane is already
claimed elsewhere.

| File | Area | Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/app/page.tsx` | Home link to institutional settings | OK | Done | Done | The `/stage-settings` entry is gated by `MANAGE_STAGE_SETTINGS`; no new home-page issue found. |
| `src/app/groups/[groupId]/page.tsx` | Group link to local settings | OK | Done | Done | The group settings link is gated by `MANAGE_GROUP_SETTINGS` scoped to the group after the group is loaded and institution-checked. No new link-level issue found. |
| `src/app/trainees/[traineeId]/page.tsx` | Trainee link to local settings | OK | Done | Done | The trainee settings link is gated by `MANAGE_TRAINEE_SETTINGS` with the trainee and current group scope after the trainee is loaded and institution-checked. No new link-level issue found. |
| `src/app/page.module.css` | Shared stage-settings form/table styles | OK | Done | Done | `settingsTable` uses horizontal overflow, stable table width, visible focus styles, and compact inheritance checkbox styling. No new CSS-only issue found. |
| `src/app/stage-settings/page.tsx` | Institutional stage-settings route | Needs fix | Done | Done | The footer displays one flat active-weight total across all active rows. With all-stage plus stage-specific parameters, the service validates effective totals per stage, so this single total can show a misleading value even when publish validation is correct. Show per-stage effective totals or remove the aggregate. |
| `src/app/stage-settings/actions.ts` | Stage-settings server actions | Needs fix | Done | Done | Local group/trainee saves can reset name, definition, score scale, and weight to inherited `null`, but they always submit concrete `active` and `stageId` values. That prevents active state and stage applicability from inheriting future source changes and can silently convert inherited stage applicability into an override on save. |
| `src/app/stage-settings/data.ts` | Stage-settings read model for routes | Needs fix | Done | Done | `loadTraineeStageSettings()` loads only the trainee-scoped draft/published profile and the institutional source version. It does not include the current group profile as the parent baseline, even though the documented chain and report resolution are trainee -> group -> institution. The trainee settings UI can therefore display/reset inheritance against the wrong parent. |
| `src/app/stage-settings/ScopedStageSettingsPage.tsx` | Shared group/trainee settings UI | Needs fix | Done | Done | The "בירושה"/"מותאם" badge only considers name, definition, score scale, and weight. Because active state and stage applicability are always concrete form values with no inheritance toggle, a row can be labeled fully inherited while those fields are not actually inheriting. |
| `src/app/stage-settings/stageSettingsActionMessages.ts` | Stage-settings notices/errors | OK | Done | Done | Covers the current service error codes used by institutional, group, and trainee settings actions with Hebrew messages. No new issue found. |
| `src/app/stage-settings/groups/[groupId]/page.tsx` | Group stage-settings route | OK | Done | Done | Fails closed for missing/foreign groups, checks `MANAGE_GROUP_SETTINGS` with group scope, and passes group-scoped actions/data into the shared UI. No new route-shell issue found. |
| `src/app/stage-settings/trainees/[traineeId]/page.tsx` | Trainee stage-settings route | Covered elsewhere | Done | Done | Route shell fails closed for missing/foreign trainees and checks `MANAGE_TRAINEE_SETTINGS` with trainee/current-group scope. The parent-inheritance bug is recorded against `src/app/stage-settings/data.ts`, because this route currently has no way to load the group baseline. |
| `src/app/appRoutes.test.tsx` | Stage-settings route coverage | Needs fix | Done | Done | Current route tests cover permission gates, links, and basic inherited-field rendering, but they do not cover trainee settings inheriting from a group profile or preserving/resetting inheritance for active state and stage applicability. Add focused coverage when the UI/data behavior is fixed. |

## Batch 16 - Stage Settings Verification Addendum

Pass 1 reviewer: Codex Verification Runner.
Pass 2 verifier: Codex Code Audit Reviewer.

Scope note: addendum only. This records the targeted non-Dropbox verification
result from `C:\Users\Still\AppData\Local\steps-verify-20260706-143621` without
rewriting Batch 15's static findings.

| File | Area | Current Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/app/stage-settings/page.tsx` | Institutional stage-settings route | Needs fix | Done | Done | In addition to Batch 15's display concern, `tsc --noEmit --pretty false` fails at line 407 because `settingsData.version` is possibly `null` inside the inactive-parameter callback. Narrow once after the null guard, for example `const version = settingsData.version`, and use that const inside nested callbacks and props. |
| `src/app/appRoutes.test.tsx` | Stage-settings route coverage | Needs fix | Done | Done | Targeted Vitest now executes from the non-Dropbox copy and fails 3 stage-settings assertions. The failing expectations inspect raw React element trees; `textOf()` and `propsOfType()` recurse into `props.children` but do not render child function components, so they cannot see inputs/text nested inside `ParameterRows` or `ScopedStageSettingsPage`. Update these tests to inspect child component props where appropriate or render/call the child component directly. |

## Batch 17 - Stage Settings Verification Blockers Closed

Pass 1 reviewer: Codex Stage Settings Tester.
Pass 2 verifier: Codex Stage Settings Tester.

Scope note: source verification only for the concrete Batch 16 runner blockers.
This does not close Batch 15's broader stage-settings product/source findings
around effective-weight display, local inheritance for active/stage fields, or
trainee inheritance from a group profile.

| File | Area | Current Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/app/stage-settings/page.tsx` | Institutional stage-settings route | OK for Batch 16 blocker; still Needs fix for Batch 15 display issue | Done | Done | Current source narrows `settingsData.version` into `const version = settingsData.version` after the null guard and uses `version.stages` inside nested callbacks. Non-Dropbox `tsc --noEmit --pretty false` now passes. |
| `src/app/appRoutes.test.tsx` | Stage-settings route coverage | OK for Batch 16 blocker; still Needs fix for Batch 15 missing scenarios | Done | Done | Current tests use `propsMatching()` to assert props passed to stage-settings child components instead of expecting nested child component output in the raw page element tree. Non-Dropbox `vitest run src/app/appRoutes.test.tsx --reporter=verbose` now passes 28/28. |

## Batch 18 - Stage Settings Flat Weight Display Closed

Pass 1 reviewer: Codex Stage Settings Tester.
Pass 2 verifier: Codex Stage Settings Tester.

Scope note: closes only the Batch 15 display finding for the institutional
stage-settings form. It does not change scoring validation or local inheritance
semantics.

| File | Area | Current Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/app/stage-settings/page.tsx` | Institutional stage-settings route | OK for flat-weight display; still affected only by separate local-inheritance findings elsewhere | Done | Done | Removed the flat active-weight total from the form footer so the UI no longer implies that one global sum is the publish criterion. The service remains responsible for effective per-stage 100% validation. Non-Dropbox `src/app/appRoutes.test.tsx` passed 28/28 and `tsc --noEmit --pretty false` passed. |

## Batch 19 - Reporting UI After Task H

Pass 1 reviewer: Codex Code Audit Reviewer.
Pass 2 verifier: Codex Code Audit Reviewer.

Scope note: static source/spec/test review only, after the Task H result entry.
Recent `AGENT_CONVERSATION.md`, the app-model reporting/page specs, the Task H
files, and this audit ledger were rechecked before this batch. No runtime code
was changed and no tests were run in this audit task; Task H's targeted
verification is recorded on the board.

| File | Area | Current Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/services/reports/reportService.ts` | Report form read model | Needs fix | Done | Done | `getTraineeReportFormData()` builds the selected-date report context, including historical group membership, and returns existing report note/score-entry defaults, but it accepts no actor or permission subject. Current callers must therefore perform date-specific authorization themselves. The new route currently authorizes against the trainee's current group before calling this helper, so transferred-trainee historical dates can expose form data for a group scope the actor may not have. Add read authorization to the helper or authorize against the returned date-specific context before displaying form data. |
| `src/app/reports/actions.ts` | Report server actions | OK | Done | Done | Parses date-only input, bounded row counts, valid statuses, local-only `returnTo`, and delegates institution/permission/score validation to `reportService`. No action-only issue found in static review. |
| `src/app/reports/reportActionMessages.ts` | Report notices/errors | OK | Done | Done | Covers the current `ReportMutationErrorCode` values plus action-level invalid date/entry cases with Hebrew messages. No new issue found. |
| `src/app/trainees/[traineeId]/report/page.tsx` | Single-trainee report entry route | Needs fix | Done | Done | The route checks `ENTER_REPORTS` / `EDIT_REPORTS` using `{ traineeId, groupId: trainee.groupId }` before loading the selected measurement date. `getTraineeReportFormData()` may resolve a different historical group for that date, so users scoped only to the current group can see old-group draft/published report form data, and users scoped only to the historical group can be incorrectly denied. Recheck permission against `formData.groupId` or move the date-specific read authorization into the service. |
| `src/app/groups/[groupId]/page.tsx` | Group report entry links | Needs fix | Done | Done | When a user has `ENTER_REPORTS`/`EDIT_REPORTS` but not `VIEW_REPORTS`, the page correctly skips `buildGroupFitReport()` and loads active trainees for entry links, but the title badge still uses `report.length` and can show `0 חניכים` while the report-entry list contains trainees. Count the entry-list trainees or avoid the count when report viewing is denied. |
| `src/app/trainees/[traineeId]/page.tsx` | Trainee report entry link | OK | Done | Done | The entry link is gated by `ENTER_REPORTS` or `EDIT_REPORTS`, and the page does not fetch fit-report data when `VIEW_REPORTS` is denied. The selected-date authorization issue is recorded against the report-entry route/service helper. |
| `src/app/appRoutes.test.tsx` | Reporting route coverage | Needs fix | Done | Done | Task H tests cover report entry links, the trainee report form, draft/vacation labels, and the non-Dropbox run passed 31/31. Missing regressions: transferred trainee where selected report date resolves to a different historical group than `trainee.groupId`, and the group title count for entry-only users without `VIEW_REPORTS`. |
| `tests/integration/reportService.integration.test.ts` | Report form read-model integration | OK | Done | Done | Task H added coverage for `getTraineeReportFormData()` loading existing draft entries and vacation marking, and the non-Dropbox integration run passed 7/7. The remaining authorization gap is route/helper contract coverage, not a failing service mutation regression. |

## Batch 20 - Reporting UI Batch 19 Findings Closed

Pass 1 reviewer: Codex Reporting UI Builder.
Pass 2 verifier: Codex Reporting UI Builder.

Scope note: closes only the two concrete Reporting UI findings from Batch 19.
No schema, reporting aggregation, recommendation, stage-change, multi-program,
bulk grid, or stage-settings inheritance behavior was changed.

| File | Area | Current Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/services/reports/reportService.ts` | Report form read model | OK for current route contract | Done | Done | The helper remains a permission-neutral read model, but the current report-entry route now authorizes against the helper's selected-date `groupId` before rendering returned report notes, entries, or parameter rows. This closes the Batch 19 current-caller leak without expanding the service API. |
| `src/app/trainees/[traineeId]/report/page.tsx` | Single-trainee report entry route | OK | Done | Done | The route now loads selected-date form context, then checks `ENTER_REPORTS` and `EDIT_REPORTS` against `{ traineeId, groupId: formData.groupId }` before rendering the form. Users scoped only to the current group no longer see historical-group report data when the selected date belongs to another group. |
| `src/app/groups/[groupId]/page.tsx` | Group report entry links | OK | Done | Done | The page now builds `reportEntryLinks` once and uses it both for the entry list and active-group title count. Entry-only users without `VIEW_REPORTS` see the count from `listTraineesByGroup()` instead of a misleading `0 חניכים`. |
| `src/app/appRoutes.test.tsx` | Reporting route coverage | OK | Done | Done | Added regressions for selected-date historical-group authorization, denial without rendering form props, and entry-only group count. In non-Dropbox copy `C:\Users\Still\AppData\Local\steps-verify-20260706-143621`, `appRoutes` passed 33/33 and `tsc --noEmit --pretty false` passed. |

## Batch 21 - Stage Settings Trainee Group-Parent Inheritance Blocker

Pass 1 reviewer: Codex Stage Settings UI Builder.
Pass 2 verifier: Codex Stage Settings UI Builder.

Scope note: investigation/classification only after the Batch 15 trainee
inheritance finding became unclaimed again. No runtime code was changed because
the current data model/service contract cannot safely express the intended
field-level trainee -> group -> institution inheritance without a product/schema
or service-contract decision.

| File | Area | Current Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `src/app/stage-settings/data.ts` | Trainee settings read model | Blocked | Done | Done | A UI-only change could display the group profile as the trainee parent, but saving a trainee draft would still persist `sourceParameterDefinitionId` values that point to base `ParameterDefinition` rows. That would make inherited null fields fall back to institution parameters at runtime instead of the displayed group overrides. Do not patch the display until the service/model inheritance contract is fixed. |
| `src/services/stagePrograms/stageSettingsService.ts` | Local profile persistence | Blocked | Done | Done | `LocalScoringProfileParameterInput` and `normalizeLocalParameters()` validate sources against base version `ParameterDefinition` ids, and `saveTraineeScoringProfileDraft()` persists trainee profiles with `groupId: null`. There is no parent profile parameter reference or merge step that lets a trainee profile field inherit from a group profile override. |
| `src/services/reports/reportService.ts` | Effective scoring profile resolution | Blocked | Done | Done | Report context chooses one effective profile by specificity: trainee, else group, else institution. If a trainee profile exists, group profile overrides are not merged underneath it, so field-level null inheritance from group to trainee is not currently represented in report scoring. |
| `src/app/stage-settings/ScopedStageSettingsPage.tsx` | Shared local settings UI | Covered by blocker | Done | Done | The UI can show inherited/customized labels for nullable fields, but the correctness issue is the missing service/model parent chain. Changing labels or source rows alone would risk misleading staff about what will happen after save/publish. |
| `src/app/appRoutes.test.tsx` | Stage-settings inheritance coverage | Blocked | Done | Done | Add trainee-inherits-from-group route/service regressions only after the service/model contract defines how trainee profile rows inherit group overrides. The existing Batch 15 missing-test finding remains open, but it is blocked by this contract gap. |

## Batch 22 - Stage Settings Active/Stage Applicability Inheritance Blocker

Pass 1 reviewer: Codex Stage Settings UI Builder.
Pass 2 verifier: Codex Stage Settings UI Builder.

Scope note: investigation/classification only for the remaining Batch 15 local
inheritance finding. No runtime code was changed because the current schema and
service contract do not have distinct persisted states for inherited `active`
or inherited stage applicability.

| File | Area | Current Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `prisma/schema.prisma` | Scoring profile parameter fields | Blocked | Done | Done | `ScoringProfileParameter.active` is non-null `Boolean @default(true)`, so it cannot distinguish inherited active state from an explicit local override. `stageId` is nullable, but `null` already means all-stage applicability, so it cannot also mean "inherit source stage applicability" without a separate representation. |
| `src/app/stage-settings/actions.ts` | Local settings form parsing | Blocked | Done | Done | `readLocalParameters()` always submits concrete `active` and `stageId` values because those are the only represented states. Adding checkboxes alone would not help until the service/schema can persist inherited active/stage applicability distinctly from explicit false/all-stage values. |
| `src/services/stagePrograms/stageSettingsService.ts` | Local profile normalization/persistence | Blocked | Done | Done | `normalizeLocalParameters()` normalizes `stageId` to `null` and `active` to `parameter.active ?? true`, then persists those concrete values. The inherited-field count also tracks only nullable name, scoreScale, and weight fields, confirming active/stage applicability are not modeled as nullable inherited fields. |
| `src/app/stage-settings/ScopedStageSettingsPage.tsx` | Shared local settings UI | Covered by blocker | Done | Done | The inherited/customized badge cannot be made correct for active/stage applicability until the persisted contract can express those inherited states. UI-only changes would make the label look better while saving the same concrete overrides. |
| `src/app/appRoutes.test.tsx` | Stage-settings active/stage inheritance coverage | Blocked | Done | Done | Add route/service regressions for active/stage reset-to-inherit only after the model/service contract defines how those states are represented. Current missing coverage remains blocked by the representation gap. |

## Batch 23 - App-Model Specification Documents

Pass 1 reviewer: Codex Spec Reviewer.
Pass 2 verifier: Codex Spec Reviewer.

Scope note: documentation audit only. Recent `AGENT_CONVERSATION.md` entries,
this ledger, and the app-model spec files were rechecked before writing. No
runtime code, schema, migrations, README, or product-open decisions were changed.

| File | Area | Current Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `docs/specs/README.md` | Spec folder index | OK | Done | Done | Correctly points agents to the unified app model as the entry point while preserving older spec files as historical context. No new issue found. |
| `docs/specs/app-model/README.md` | Unified app-model index | OK | Done | Done | Clearly routes agents to the six app-model docs, defines status labels, and keeps open product decisions separate from implementable work. No new issue found. |
| `docs/specs/app-model/01-pages-and-surfaces.md` | Page/UI surface specification | Needs sync | Done | Done | Several status bullets still describe already-closed work as future or pending: AppShell still says stage-settings/reporting navigation needs a decision if those screens are added, the vacation component still calls the Task D local-date fix open, and the permissions section still frames Task G closeout as pending. Sync with the latest implementation-status and board results before using this as a task source. |
| `docs/specs/app-model/02-domain-model.md` | Domain model specification | Needs sync | Done | Done | The reporting correctness gaps still list published-report pin preservation and draft-visible-row deletion as open even though Task B/Batch 14 closed them and `reportService.integration` has the regression coverage. Some Task C/B verification language also predates the current non-Dropbox targeted verification results. |
| `docs/specs/app-model/03-permissions-audit-and-security.md` | Permissions, audit, and security specification | Needs sync | Done | Done | The document still says Task A/G work is active or pending verification in places, while Batch 14 and later verification notes mark stale-session clearing, permission action malformed-scope handling, managed override audit atomicity, and vacation audit transactions as source-closed or verified in targeted lanes. |
| `docs/specs/app-model/04-stage-programs-reporting-and-scoring.md` | Stage/reporting/scoring specification | Needs sync | Done | Done | Claude's 2026-07-07 sync removed the stale "UI does not exist" and "ready to fix" reporting language, but the fit-report section still lists `parametersExpected` and inherited local profile weight fallback as open gaps even though Batch 14 closes them at the source/test level. Aggregation, thresholds, bulk reporting, and stage-change gaps remain legitimately open. |
| `docs/specs/app-model/05-implementation-status.md` | Implementation status snapshot | Needs sync | Done | Done | This remains useful as the current status table, but a few rows still lag later closeouts: permissions and vacation date UI are described as verification/pending in places after Task G/Task D closeouts, and the document should absorb the latest 2026-07-07 targeted verification result once the active tester claim completes. |
| `docs/specs/app-model/06-open-spec-gaps.md` | Product blocker list | OK | Done | Done | Open questions are still product blockers rather than implementable tasks, and the document keeps annual/token/day-summary domains out of scope. No new issue found. |

## Batch 24 - Reporting/Fit App-Model Spec Sync Closeout

Pass 1 reviewer: Codex Spec Reviewer.
Pass 2 verifier: Codex Spec Reviewer.

Scope note: docs-only closeout for two Batch 23 findings. This does not change
runtime code, tests, schema/migrations, README, or open product decisions.

| File | Area | Current Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `docs/specs/app-model/02-domain-model.md` | Domain model specification | OK for Task B/Task C closed-status wording | Done | Done | Updated stale correctness language so published-report pin preservation, draft-visible-row protection, inherited local weight fallback, active-version stage validation, future transfer rejection, and vacation marking are described as implemented/source-covered where applicable. Remaining multi-program, period aggregation, custom override, and broad Dropbox runner caveats remain intact. |
| `docs/specs/app-model/04-stage-programs-reporting-and-scoring.md` | Stage/reporting/scoring specification | OK for Reporting/Fit closed-fix wording | Done | Done | Moved `parametersExpected` profile awareness and inherited local weight fallback from open gaps to closed Task B fixes. Aggregation formula, period boundaries/snapshots, thresholds, bulk reporting, richer day selection, and stage-change workflow remain open or outside MVP as before. |

## Batch 25 - Pages/Permissions App-Model Spec Sync Follow-up

Pass 1 reviewer: Codex Spec Reviewer.
Pass 2 verifier: Codex Spec Reviewer.

Scope note: docs/audit closeout after Claude's 2026-07-07 app-model spec sync
entries. This records what is closed and what remains stale; no runtime code,
tests, schema/migrations, README, or product-open decisions were changed.

| File | Area | Current Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `docs/specs/app-model/01-pages-and-surfaces.md` | Page/UI surface specification | OK for Batch 23 stale-status wording | Done | Done | Claude's sync removed the stale navigation, Task D date-default, Task G pending-closeout, and LCU-03 UI wording. Current remaining gaps are the intended open items: full fixed navigation, dashboards, bulk reporting, broad runner caveats, and product-blocked trainee/period/stage-change areas. |
| `docs/specs/app-model/03-permissions-audit-and-security.md` | Permissions, audit, and security specification | Partially synced; still Needs sync for Task G verification wording | Done | Done | Claude's sync closes the stale Task A status for managed override/vacation audit transactions and stale-session claim clearing. The file still says the `src/app/permissions/actions.test.ts` regression should be run from a non-synced workspace even though later board notes indicate targeted DB-free Vitest coverage had passed; refresh that Task G verification wording after reconciling with the active tester lane. |

## Batch 26 - Permissions Spec Task G Verification Wording Closeout

Pass 1 reviewer: Codex Spec Reviewer.
Pass 2 verifier: Codex Spec Reviewer.

Scope note: docs-only closeout for the remaining app-model `03` wording issue
from Batch 25. This does not change runtime code, tests, schema/migrations,
README, or active verification work.

| File | Area | Current Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `docs/specs/app-model/03-permissions-audit-and-security.md` | Permissions, audit, and security specification | OK for Task G/Task A stale-status wording | Done | Done | Updated Task G wording so `src/app/permissions/actions.test.ts` is described as an added regression that passed targeted DB-free Vitest per the board, while broad verification remains tracked separately in the non-Dropbox lane. Together with Claude's Task A sync, the Batch 23/25 stale status issues for this file are closed. |

## Batch 27 - Implementation Status Targeted Verification Wording Sync

Pass 1 reviewer: Claude as Tester + Builder.
Pass 2 verifier: Claude as Tester + Builder.

Scope note: docs-only closeout for stale app-model `05` verification/status
wording. This records targeted non-Dropbox closeouts already present on the
board and does not claim the active 2026-07-07 broad verification lane result.

| File | Area | Current Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `docs/specs/app-model/05-implementation-status.md` | Implementation status snapshot | OK for known targeted-verification wording | Done | Done | Updated stale `חסום אימות` wording for permissions, trainee management, vacation UI/service, stage-settings backend/UI, and fit reports where the board already records targeted DB-free/real-Postgres/non-Dropbox verification. Kept broad runner caveats and model/product blockers intact, and did not absorb the active broad verification claim before its owner posts a result. |

## Batch 28 - Implementation Status Broad Verification Result Sync

Pass 1 reviewer: Claude as Tester + Builder.
Pass 2 verifier: Claude as Tester + Builder.

Scope note: docs-only sync after the 2026-07-07 08:48 non-Dropbox verification
and page-build result entries. This does not change runtime code, tests,
schema/migrations, README, or product-open decisions.

| File | Area | Current Status | Pass 1 | Pass 2 | Notes |
| --- | --- | --- | --- | --- | --- |
| `docs/specs/app-model/05-implementation-status.md` | Implementation status snapshot | OK for 2026-07-07 broad non-Dropbox verification result | Done | Done | Added the latest non-Dropbox verification summary: direct Node `tsc`, Vitest unit/page 60/60, real-Postgres integration 89/89, direct ESLint, and Next webpack build passed. Preserved the remaining environment caveats for `npm run lint` PATH lookup and plain Turbopack build against the verification copy's `node_modules` junction. |

## Remaining Coverage

Application code, Prisma files, runtime configs, scripts, public assets, tests,
specification documents, agent prompts, and local collaboration plugin files
discovered by the hidden-file `rg --files` pass are represented in completed
batch tables above, with Batch 14 recording post-fix status for earlier findings
that have since changed and Batch 15 covering the stage-settings UI files added
by Task E/F. Batch 16 adds the targeted verification blockers for the same route
area, Batch 17 records that those two runner blockers are now closed, and Batch
18 closes the flat-weight display finding. Batch 19 covers the Reporting UI MVP
files added by Task H and records the read-scope/UI-count findings; Batch 20
records that those two Reporting UI findings are closed in current source and
focused route/type verification. Batch 21 records that the remaining trainee
group-parent stage-settings inheritance finding is blocked by the current
profile source/merge contract and should not be fixed as a UI-only patch. Batch
22 records that local `active` and stage applicability inheritance are blocked
by missing persisted inherited states and should not be fixed as UI-only toggles.
Batch 23 covers the unified app-model spec documents and identifies the narrow
docs-sync work needed before those files should be used as fresh task sources.
Batch 24 closes the stale Reporting/Fit wording for app-model `02` and `04`.
Batch 25 closes the app-model `01` stale-status wording and narrows the
remaining app-model `03` issue to Task G verification wording.
Batch 26 closes that remaining app-model `03` Task G verification wording issue.
Batch 27 closes the known stale targeted-verification wording in app-model `05`
before the broad verification result landed.
Batch 28 syncs app-model `05` with the 2026-07-07 broad non-Dropbox
verification/build results and records the remaining environment caveats.
Generated/heavy folders remain
intentionally excluded from source review and are covered as cleanup candidates
in `docs/specs/legacy-cleanup-audit.md`.
