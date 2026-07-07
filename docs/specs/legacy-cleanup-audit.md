# Legacy / Obsolete Code Audit

Status: preliminary audit, partially cleaned after peer-board task split.

Last updated: 2026-07-06.

## Ground Rules

- Do not delete application code from this list until another agent reviews the finding.
- Generated/cache artifacts may be cleaned only when no dev server, build, or test runner is using them.
- Schema removals require an explicit migration plan and user/coordinator approval.
- A file that is not connected to the current UI is not automatically obsolete; some code is intentionally future-facing or blocked by open product decisions.

## Reviewed Areas

- Specs and coordination: `README.md`, `docs/specs/implementation-task-map.md`, `AGENT_CONVERSATION.md`.
- App routes and server actions under `src/app`.
- Core services and repositories under `src/services`, `src/repositories`, `src/lib`.
- Prisma schema, migrations, seed, and generated-client usage.
- Test harness scripts/configs: Vitest, Playwright, E2E helper routes, DB migration script.
- Root/generated artifacts and default public assets.

Note: broad text-search tooling was unreliable in this Dropbox workspace during the audit, so findings below are based on targeted reads and narrow checks. Treat this as a high-confidence triage list, not a final deletion order.

## Deletion Candidates Requiring Peer Review

### LC-01 — Generated and Cache Artifacts

Candidate paths:

- `.next/`
- `.next-e2e/`
- `next-e2e-build/`
- `test-results/`
- `tsconfig.tsbuildinfo`
- `next-env.d.ts`

Assessment: safe to regenerate and already gitignored. These are not source code. Deleting them while `next dev`, Playwright, or a build is running can break active processes, so cleanup should be coordinated.

Recommended decision: cleanup allowed after peer confirmation and after stopping relevant processes.

2026-07-06 LCU-01 result: cleanup was attempted only after checking running
Node processes. The broad remove operation timed out in the Dropbox workspace,
and a Vitest process was later observed running against the repo. Treat this
candidate as still open; retry only when the runner lane is clear. `next-env.d.ts`
was intentionally kept because removing it without a successful Next/TypeScript
regeneration can disrupt local type checking even though it is generated and
gitignored.

2026-07-06 LCU-01 follow-up: after a fresh process check showed no active
Vitest/TypeScript/E2E runner, `.next-e2e/`, `test-results/`, and
`tsconfig.tsbuildinfo` were removed as local generated artifacts. `.next/` was
kept because a live `next dev --hostname 127.0.0.1 --port 3000` process was
present and its working directory could not be safely proven unrelated.
`next-env.d.ts` was kept for the regeneration reason above. `next-e2e-build/`
still remains: repeated native PowerShell `Remove-Item -Recurse` attempts timed
out in the Dropbox workspace, and the directory is marked as a Windows
reparse-point/cloud artifact. Do not retry broad recursive deletion there while
live servers are active; a future cleanup should use an idle workspace or
non-Dropbox copy and verify the directory is not being held by sync tooling.

### LC-02 — Default Next Public Assets

Candidate paths:

- `public/file.svg`
- `public/globe.svg`
- `public/next.svg`
- `public/vercel.svg`
- `public/window.svg`

Assessment: likely leftover Next template assets. The reviewed app pages use CSS and no visible references to these assets were found during manual route review. Because broad search was unreliable, another agent should verify there are no references before deletion.

Recommended decision: delete after peer confirms zero references.

2026-07-06 LCU-01 result: targeted runtime/source reference checks found no
references to the exact SVG filenames. Broad Dropbox searches were slow and
timed out, but no positive runtime references were found. The five default
public assets were removed. `src/app/favicon.ico` was kept.

### LC-03 — Legacy Credentials Password Field

Candidate paths:

- `prisma/schema.prisma` model `StaffUser.passwordHash`
- historical migration rows that created the column

Assessment: current auth is Google OAuth via `src/lib/auth.ts`, which maps verified Google email to an active `StaffUser`. `prisma/seed.ts` does not populate `passwordHash`, and no Credentials provider path was found in the reviewed auth files. The field is explicitly commented as legacy.

Risk: deleting requires a Prisma migration and can affect local data or old test fixtures if any still depend on the column.

Recommended decision: peer should confirm no runtime/test use, then coordinator/user should approve a migration to remove the column.

2026-07-06 LCU-02 result: targeted review found no active Credentials-provider or bcrypt login path. `src/lib/auth.ts` uses only Google OAuth and active `StaffUser.email` lookup; `src/app/api/auth/[...nextauth]/route.ts` only exports those handlers; `prisma/seed.ts` creates staff users without `passwordHash`; `package.json` and `package-lock.json` do not include bcrypt/Credentials-provider remnants. Targeted source/test searches were slow and timed out in the Dropbox workspace, but the only hits returned before timeout were visible/test wording around Google credentials, not password auth code. Remaining concrete artifact is the nullable `StaffUser.passwordHash` column plus the historical migration that created it. Removal is blocked pending explicit schema-migration approval and any local-data compatibility decision; do not edit historical migrations.

### LC-04 — Generic / Historical Permission Actions

Candidate enum values:

- `VIEW`
- `EDIT`
- `EDIT_SETTINGS`

Related files:

- `prisma/schema.prisma`
- `src/services/permissions/actions.ts`
- `src/app/permissions/page.tsx`

Assessment: current write/read paths use specific actions like `VIEW_REPORTS`, `MANAGE_GROUPS`, `ENTER_REPORTS`, etc. The generic values appear older or overly broad, and they are displayed in the permissions UI because `ALL_PERMISSION_ACTIONS` exposes every enum value.

Risk: removing enum values is a migration and data decision. `CHANGE_STAGE` is also not implemented in this slice, but it maps to a future domain and should not be grouped with clearly generic actions without spec review.

Recommended decision: peer should classify each action as `keep`, `hide until implemented`, or `remove by migration`.

2026-07-06 LCU-03 result: classified `VIEW`, `EDIT`, and `EDIT_SETTINGS` as legacy/generic actions that should be hidden from new UI management until a migration/data cleanup decision removes or redefines them. Classified `CHANGE_STAGE` as future-domain and hidden until the stage-change workflow is specified and implemented. Active/manageable UI actions are `VIEW_REPORTS`, `MANAGE_PERMISSIONS`, `MANAGE_GROUPS`, `MANAGE_TRAINEES`, `TRANSFER_TRAINEES`, `ENTER_REPORTS`, `EDIT_REPORTS`, `MANAGE_STAGE_SETTINGS`, `MANAGE_GROUP_SETTINGS`, `MANAGE_TRAINEE_SETTINGS`, and `MANAGE_VACATIONS`. Code now keeps `ALL_PERMISSION_ACTIONS` for DB/default-role seeding but uses `MANAGEABLE_PERMISSION_ACTIONS` in the permissions page forms and role table. Existing legacy override rows can still be listed if present; enum/schema removal remains blocked pending explicit migration and data cleanup approval.

### LC-05 — Older Per-Trainee Override Models

Candidate schema models:

- `TraineeParameterOverride`
- `TraineeThresholdOverride`

Assessment: current IMP-05/IMP-06 work introduced `ScoringProfile` and `ScoringProfileParameter` for institution/group/trainee scoring profiles, inheritance, drafts, and publishing. The older per-trainee override models are not used in the reviewed runtime services, except as schema relations and test DB reset tables. README still mentions them as an unmerged custom-mode path, so this may be either planned legacy compatibility or superseded architecture.

Risk: schema removal would be invasive and may erase a future product path if the team still wants these models.

Recommended decision: peer/spec guardian should decide whether local scoring profiles fully replace these models. Do not delete without explicit schema-migration approval.

2026-07-06 LCU-04 result: reviewed current app-model open gaps, schema relations, test reset helper, and the live reporting/settings/trainee services. Runtime write/read paths now use `ScoringProfile` / `ScoringProfileParameter` for local scoring profiles, and `createTraineeRecord()` sets new trainees to `measurementMode: "STANDARD"`. The remaining concrete uses of `TraineeParameterOverride` / `TraineeThresholdOverride` are schema relations, generated DB surface, test reset truncation, README/spec notes, and an explicit `fitReport.ts` comment saying legacy `CUSTOM` overrides are not merged yet. Because `docs/specs/app-model/06-open-spec-gaps.md` still asks whether `measurementMode = CUSTOM` and these models remain a product path, classify them as reserved/blocked, not safe-delete. Schema removal requires a Product Spec Owner answer plus explicit forward-migration approval; do not edit historical migrations.

## Reviewed And Not Obsolete

- `src/app/api/e2e/fixture/route.ts` and `src/app/api/e2e/session/route.ts`: needed for Playwright; guarded by `E2E_TEST_AUTH=1` and loopback `AUTH_URL`.
- `scripts/e2e-build.mjs`, `scripts/e2e-start.mjs`, `next.config.ts`: used by `npm run test:e2e` and Playwright `webServer`.
- `src/services/stagePrograms/parameterWeights.ts`: used by `stageSettingsService.ts` publish validation.
- `src/services/stagePrograms/recommendation.ts`: intentionally throws because recommendation threshold semantics are still an open product decision.
- `src/generated/prisma/**`: generated but actively imported. Do not delete unless `prisma generate` is run immediately afterward and no active process depends on it.
- `.agents/**` and `plugins/agent-peer-collaboration/**`: intentional mixed-agent collaboration infrastructure.
- `docker-compose.yml`: documented as an optional Postgres alternative.

## Non-Deletion Risks Found During Audit

- Tooling/search was unusually slow in the Dropbox workspace. Do not make deletion decisions from a single timed-out search result.

## Resolved Or Stale Audit Notes

- `src/services/reports/reportService.ts`: the previous published-report
  pinning risk is no longer active. Current `publishTraineeReport()` reloads
  an existing published report with its pinned `stageProgramVersionId` and
  `scoringProfileId`, `writeReport()` preserves those ids when
  `existingReport.status === "PUBLISHED"`, and
  `tests/integration/reportService.integration.test.ts` includes the regression
  `keeps published report pins when editing after newer settings exist`. This
  is also closed in `docs/specs/codebase-file-audit.md` Batch 14. On
  2026-07-07, the focused non-Dropbox `reportService.integration` suite passed
  7/7 again. Separate
  `reportService` mentions related to trainee -> group -> institution scoring
  profile merge remain blocked under the stage-settings model/service contract,
  not as a legacy cleanup deletion item.
- `README.md` / `src/domain/`: the previous folder-structure drift note is no
  longer active. `src/domain/stagePrograms/` was an empty directory with no
  files, and it was removed so the README statement that there is no separate
  domain folder in current use is accurate.
- `src/app/permissions/page.tsx`: the earlier raw/future/legacy permission UI
  exposure is mitigated. The page now uses Hebrew labels and
  `MANAGEABLE_PERMISSION_ACTIONS` for new management forms and the role table.
  `LC-04` schema/data cleanup remains blocked above, and existing legacy
  override rows can still be listed if present.

## Remaining Follow-up Requests

Before deleting anything else, another agent should:

1. Retry only the remaining `LC-01` artifacts when the workspace is idle: `.next/`
   needs no live Next server, `next-e2e-build/` needs the Dropbox
   reparse-point/sync lock cleared or a non-Dropbox cleanup lane, and
   `next-env.d.ts` should be removed only with successful Next/TypeScript
   regeneration.
2. Remove `LC-03`'s `StaffUser.passwordHash` only after explicit
   migration/local-data compatibility approval and a forward migration plan.
3. Remove or redefine `LC-04` enum values only after explicit migration/data
   cleanup approval. The permissions UI already hides the legacy/future actions
   from new management.
4. Decide whether `LC-05` is superseded by `ScoringProfile` or still reserved
   for future custom-mode behavior before any schema removal.
5. Prefer broad cleanup/search verification from an idle or non-Dropbox lane,
   because this workspace has repeatedly timed out on broad search, Git status,
   and recursive artifact deletion.
