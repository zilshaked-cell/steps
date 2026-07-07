import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  redirect: vi.fn((destination: string) => {
    const error = new Error("NEXT_REDIRECT");
    Object.assign(error, { destination });
    throw error;
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  getInstitutionById: vi.fn(),
  listGroupsByInstitution: vi.fn(),
  listGroupStaffIds: vi.fn(),
  listStaffByInstitution: vi.fn(),
  getPrimaryStageProgramVersion: vi.fn(),
  getGroupById: vi.fn(),
  getTraineeById: vi.fn(),
  listTraineesByGroup: vi.fn(),
  listTraineesByInstitution: vi.fn(),
  listRolePermissionsByInstitution: vi.fn(),
  listUserPermissionOverridesByInstitution: vi.fn(),
  resolvePermission: vi.fn(),
  loadInstitutionStageSettings: vi.fn(),
  loadGroupStageSettings: vi.fn(),
  loadTraineeStageSettings: vi.fn(),
  buildGroupFitReport: vi.fn(),
  buildTraineeFitReport: vi.fn(),
  listVacationPeriodsByInstitution: vi.fn(),
  createGroupAction: vi.fn(),
  updateGroupAction: vi.fn(),
  setGroupActiveAction: vi.fn(),
  createTraineeAction: vi.fn(),
  updateTraineeAction: vi.fn(),
  transferTraineeAction: vi.fn(),
  createVacationAction: vi.fn(),
  updateVacationAction: vi.fn(),
  deleteVacationAction: vi.fn(),
  setRolePermissionAction: vi.fn(),
  setUserPermissionOverrideAction: vi.fn(),
  saveInstitutionStageSettingsDraftAction: vi.fn(),
  publishInstitutionStageSettingsAction: vi.fn(),
  saveGroupStageSettingsDraftAction: vi.fn(),
  publishGroupStageSettingsAction: vi.fn(),
  saveTraineeStageSettingsDraftAction: vi.fn(),
  publishTraineeStageSettingsAction: vi.fn(),
  getTraineeReportFormData: vi.fn(),
  saveReportDraftAction: vi.fn(),
  publishReportAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {
    type: string;

    constructor(type = "AuthError") {
      super(type);
      this.type = type;
    }
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
  signIn: mocks.signIn,
  signOut: mocks.signOut,
}));

vi.mock("@/repositories/institutionRepository", () => ({
  getInstitutionById: mocks.getInstitutionById,
}));

vi.mock("@/repositories/groupRepository", () => ({
  getGroupById: mocks.getGroupById,
  listGroupStaffIds: mocks.listGroupStaffIds,
  listGroupsByInstitution: mocks.listGroupsByInstitution,
}));

vi.mock("@/repositories/staffUserRepository", () => ({
  listStaffByInstitution: mocks.listStaffByInstitution,
}));

vi.mock("@/repositories/stageProgramRepository", () => ({
  getPrimaryStageProgramVersion: mocks.getPrimaryStageProgramVersion,
}));

vi.mock("@/repositories/traineeRepository", () => ({
  getTraineeById: mocks.getTraineeById,
  listTraineesByGroup: mocks.listTraineesByGroup,
  listTraineesByInstitution: mocks.listTraineesByInstitution,
}));

vi.mock("@/repositories/permissionRepository", () => ({
  listRolePermissionsByInstitution: mocks.listRolePermissionsByInstitution,
  listUserPermissionOverridesByInstitution: mocks.listUserPermissionOverridesByInstitution,
}));

vi.mock("@/services/permissions/resolvePermission", () => ({
  resolvePermission: mocks.resolvePermission,
}));

vi.mock("@/services/stagePrograms/fitReport", () => ({
  buildGroupFitReport: mocks.buildGroupFitReport,
  buildTraineeFitReport: mocks.buildTraineeFitReport,
}));

vi.mock("@/app/stage-settings/data", () => ({
  loadInstitutionStageSettings: mocks.loadInstitutionStageSettings,
  loadGroupStageSettings: mocks.loadGroupStageSettings,
  loadTraineeStageSettings: mocks.loadTraineeStageSettings,
}));

vi.mock("@/services/vacations/vacationService", () => ({
  listVacationPeriodsByInstitution: mocks.listVacationPeriodsByInstitution,
}));

vi.mock("@/app/groups/actions", () => ({
  createGroupAction: mocks.createGroupAction,
  updateGroupAction: mocks.updateGroupAction,
  setGroupActiveAction: mocks.setGroupActiveAction,
}));

vi.mock("@/app/trainees/actions", () => ({
  createTraineeAction: mocks.createTraineeAction,
  updateTraineeAction: mocks.updateTraineeAction,
  transferTraineeAction: mocks.transferTraineeAction,
}));

vi.mock("@/app/vacations/actions", () => ({
  createVacationAction: mocks.createVacationAction,
  updateVacationAction: mocks.updateVacationAction,
  deleteVacationAction: mocks.deleteVacationAction,
}));

vi.mock("@/app/permissions/actions", () => ({
  setRolePermissionAction: mocks.setRolePermissionAction,
  setUserPermissionOverrideAction: mocks.setUserPermissionOverrideAction,
}));

vi.mock("@/app/stage-settings/actions", () => ({
  saveInstitutionStageSettingsDraftAction: mocks.saveInstitutionStageSettingsDraftAction,
  publishInstitutionStageSettingsAction: mocks.publishInstitutionStageSettingsAction,
  saveGroupStageSettingsDraftAction: mocks.saveGroupStageSettingsDraftAction,
  publishGroupStageSettingsAction: mocks.publishGroupStageSettingsAction,
  saveTraineeStageSettingsDraftAction: mocks.saveTraineeStageSettingsDraftAction,
  publishTraineeStageSettingsAction: mocks.publishTraineeStageSettingsAction,
}));

vi.mock("@/services/reports/reportService", () => ({
  getTraineeReportFormData: mocks.getTraineeReportFormData,
  ReportMutationError: class ReportMutationError extends Error {
    constructor(readonly code: string, message: string) {
      super(message);
      this.name = "ReportMutationError";
    }
  },
}));

vi.mock("@/app/reports/actions", () => ({
  saveReportDraftAction: mocks.saveReportDraftAction,
  publishReportAction: mocks.publishReportAction,
}));

import { AppShell } from "./AppShell";
import Home from "./page";
import GroupReportPage from "./groups/[groupId]/page";
import LoginPage from "./login/page";
import PermissionsPage from "./permissions/page";
import GroupStageSettingsPage from "./stage-settings/groups/[groupId]/page";
import StageSettingsPage from "./stage-settings/page";
import TraineeStageSettingsPage from "./stage-settings/trainees/[traineeId]/page";
import TraineeReportEntryPage from "./trainees/[traineeId]/report/page";
import TraineeReportPage from "./trainees/[traineeId]/page";
import { VacationManagement } from "./vacations/VacationManagement";

const staffSession = {
  user: {
    id: "staff-1",
    institutionId: "institution-1",
    role: "COUNSELOR",
    name: "רות צוות",
    email: "staff@example.test",
  },
};

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (!isValidElement(node)) return "";

  const props = node.props as { children?: ReactNode };
  return textOf(props.children);
}

function expectText(node: ReactNode, expected: string) {
  expect(textOf(node).replace(/\s+/g, " ").trim()).toContain(expected);
}

function propsOfType(node: ReactNode, type: unknown): Array<Record<string, unknown>> {
  if (node == null || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") return [];
  if (Array.isArray(node)) return node.flatMap((child) => propsOfType(child, type));
  if (!isValidElement(node)) return [];

  const props = node.props as { children?: ReactNode };
  const matches = node.type === type ? [props as Record<string, unknown>] : [];
  return [...matches, ...propsOfType(props.children, type)];
}

function propsMatching(
  node: ReactNode,
  predicate: (props: Record<string, unknown>) => boolean,
): Array<Record<string, unknown>> {
  if (node == null || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") return [];
  if (Array.isArray(node)) return node.flatMap((child) => propsMatching(child, predicate));
  if (!isValidElement(node)) return [];

  const props = node.props as { children?: ReactNode };
  const record = props as Record<string, unknown>;
  const matches = predicate(record) ? [record] : [];
  return [...matches, ...propsMatching(props.children, predicate)];
}

describe("implemented app routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_GOOGLE_ID = "test-google-client-id";
    process.env.AUTH_GOOGLE_SECRET = "test-google-client-secret";
    mocks.resolvePermission.mockResolvedValue(false);
    mocks.listGroupStaffIds.mockResolvedValue([]);
    mocks.listStaffByInstitution.mockResolvedValue([]);
    mocks.getPrimaryStageProgramVersion.mockResolvedValue(null);
    mocks.listVacationPeriodsByInstitution.mockResolvedValue([]);
    mocks.listTraineesByGroup.mockResolvedValue([]);
    mocks.listTraineesByInstitution.mockResolvedValue([]);
    mocks.listRolePermissionsByInstitution.mockResolvedValue([]);
    mocks.listUserPermissionOverridesByInstitution.mockResolvedValue([]);
    mocks.loadInstitutionStageSettings.mockResolvedValue({
      version: null,
      draftProfile: null,
      publishedProfile: null,
    });
    mocks.loadGroupStageSettings.mockResolvedValue({
      version: null,
      draftProfile: null,
      publishedProfile: null,
    });
    mocks.loadTraineeStageSettings.mockResolvedValue({
      version: null,
      draftProfile: null,
      publishedProfile: null,
    });
    mocks.getTraineeReportFormData.mockResolvedValue({
      traineeId: "trainee-1",
      groupId: "group-1",
      measurementDate: new Date("2026-07-06T00:00:00.000Z"),
      stageProgramVersionId: "version-1",
      scoringProfileId: null,
      isVacationDay: false,
      existingReport: null,
      parameters: [],
    });
  });

  test("login renders Google staff sign-in and auth errors without real Google credentials", async () => {
    mocks.auth.mockResolvedValue(null);

    const page = await LoginPage({
      searchParams: Promise.resolve({ error: "AccessDenied" }),
    });

    expectText(page, "התחברות");
    expectText(page, "התחברות עם Google");
    expectText(page, "חשבון Google לא מאושר למערכת");
  });

  test("login redirects authenticated staff users to the app home", async () => {
    mocks.auth.mockResolvedValue(staffSession);

    await expect(
      LoginPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ message: "NEXT_REDIRECT", destination: "/" });
  });

  test("home shows login call-to-action when logged out", async () => {
    mocks.auth.mockResolvedValue(null);

    const page = await Home({});

    expectText(page, "תכניות שלבים");
    expectText(page, "התחברות");
  });

  test("home lists only the signed-in user's institution groups", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getInstitutionById.mockResolvedValue({ id: "institution-1", name: "פנימיית אור" });
    mocks.listGroupsByInstitution.mockResolvedValue([
      { id: "group-1", name: "קבוצת ארז" },
      { id: "group-2", name: "קבוצת אלון" },
    ]);

    const page = await Home({});

    expect(mocks.getInstitutionById).toHaveBeenCalledWith("institution-1");
    expect(mocks.listGroupsByInstitution).toHaveBeenCalledWith("institution-1");
    expectText(page, "פנימיית אור");
    expectText(page, "קבוצת ארז");
    expectText(page, "2 קבוצות");
  });

  test("home exposes group creation and archive view only when MANAGE_GROUPS is allowed", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getInstitutionById.mockResolvedValue({ id: "institution-1", name: "פנימיית אור" });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "MANAGE_GROUPS"),
    );
    mocks.listStaffByInstitution.mockResolvedValue([
      { id: "staff-2", name: "דנה מדריכה", email: "dana@example.test" },
    ]);
    mocks.listGroupsByInstitution.mockResolvedValue([
      { id: "group-1", name: "קבוצת ארז", description: "שכבת ט", active: true },
      { id: "group-2", name: "קבוצת עבר", description: null, active: false },
    ]);

    const page = await Home({
      searchParams: Promise.resolve({ archive: "1" }),
    });

    expect(mocks.listGroupsByInstitution).toHaveBeenCalledWith("institution-1", {
      includeInactive: true,
    });
    expect(mocks.listStaffByInstitution).toHaveBeenCalledWith("institution-1");
    expectText(page, "הוספת קבוצה");
    expectText(page, "דנה מדריכה");
    expectText(page, "ארכיון קבוצות");
    expectText(page, "קבוצת עבר");
  });

  test("home renders institution vacation management when MANAGE_VACATIONS is allowed", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getInstitutionById.mockResolvedValue({ id: "institution-1", name: "פנימיית אור" });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "MANAGE_VACATIONS"),
    );
    mocks.listGroupsByInstitution.mockResolvedValue([]);
    mocks.listVacationPeriodsByInstitution.mockResolvedValue([
      {
        id: "vacation-1",
        title: "חופשת קיץ",
        note: "סגור",
        startsOn: new Date("2026-07-01T00:00:00.000Z"),
        endsOn: new Date("2026-07-03T00:00:00.000Z"),
        groupId: null,
        traineeId: null,
      },
      {
        id: "vacation-2",
        title: "חופשת קבוצה",
        note: null,
        startsOn: new Date("2026-07-04T00:00:00.000Z"),
        endsOn: new Date("2026-07-04T00:00:00.000Z"),
        groupId: "group-1",
        traineeId: null,
      },
    ]);

    const page = await Home({
      searchParams: Promise.resolve({ vacationNotice: "created" }),
    });
    const [vacationSection] = propsOfType(page, VacationManagement);

    expect(mocks.listVacationPeriodsByInstitution).toHaveBeenCalledWith("institution-1");
    expectText(page, "החופשה נוספה");
    expect(vacationSection).toMatchObject({ heading: "חופשות מוסד", returnTo: "/" });
    expect((vacationSection?.vacations as Array<{ title: string }>).map((vacation) => vacation.title)).toEqual([
      "חופשת קיץ",
    ]);
  });

  test("home exposes stage settings link when MANAGE_STAGE_SETTINGS is allowed", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getInstitutionById.mockResolvedValue({ id: "institution-1", name: "פנימיית אור" });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "MANAGE_STAGE_SETTINGS"),
    );
    mocks.listGroupsByInstitution.mockResolvedValue([]);

    const page = await Home({});

    expectText(page, "הגדרות שלבים");
  });

  test("vacation management defaults new vacation dates to the local calendar day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 6, 0, 30));

    try {
      const section = VacationManagement({
        heading: "חופשות",
        vacations: [],
        returnTo: "/",
      });
      const dateInputs = propsOfType(section, "input").filter(
        (props) => props.type === "date" && ["startsOn", "endsOn"].includes(String(props.name)),
      );

      expect(dateInputs.map((props) => props.defaultValue)).toEqual([
        "2026-07-06",
        "2026-07-06",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  test("app shell exposes session identity and sign-out affordance", () => {
    const shell = AppShell({ user: staffSession.user, children: <span>תוכן</span> });

    expectText(shell, "רות צוות");
    expectText(shell, "מדריך");
    expectText(shell, "יציאה");
  });

  test("permissions page denies users without MANAGE_PERMISSIONS", async () => {
    mocks.auth.mockResolvedValue(staffSession);

    const page = await PermissionsPage({ searchParams: Promise.resolve({}) });

    expect(mocks.listRolePermissionsByInstitution).not.toHaveBeenCalled();
    expectText(page, "אין הרשאה");
  });

  test("permissions page renders role and user override controls for managers", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "MANAGE_PERMISSIONS"),
    );
    mocks.getInstitutionById.mockResolvedValue({ id: "institution-1", name: "פנימיית אור" });
    mocks.listRolePermissionsByInstitution.mockResolvedValue([
      { role: "COUNSELOR", action: "MANAGE_GROUPS", allowed: true },
    ]);
    mocks.listUserPermissionOverridesByInstitution.mockResolvedValue([
      {
        id: "override-1",
        staff: { name: "דנה מדריכה" },
        action: "ENTER_REPORTS",
        effect: "ALLOW",
        group: { name: "קבוצת ארז" },
        trainee: null,
      },
    ]);
    mocks.listStaffByInstitution.mockResolvedValue([
      { id: "staff-2", name: "דנה מדריכה", email: "dana@example.test" },
    ]);
    mocks.listGroupsByInstitution.mockResolvedValue([{ id: "group-1", name: "קבוצת ארז" }]);
    mocks.listTraineesByInstitution.mockResolvedValue([
      { id: "trainee-1", firstName: "נועה", lastName: "כהן" },
    ]);

    const page = await PermissionsPage({
      searchParams: Promise.resolve({ permissionNotice: "role-updated" }),
    });

    expect(mocks.listRolePermissionsByInstitution).toHaveBeenCalledWith("institution-1");
    expect(mocks.listUserPermissionOverridesByInstitution).toHaveBeenCalledWith("institution-1");
    expectText(page, "הרשאת התפקיד נשמרה");
    expectText(page, "הרשאת תפקיד");
    expectText(page, "חריגת משתמש");
    expectText(page, "ניהול קבוצות");
    expectText(page, "11 פעולות");
    expectText(page, "דנה מדריכה");
    expectText(page, "מאושר");
    expectText(page, "טווח הרשאה");
    expectText(page, "קבוצה: קבוצת ארז");

    const renderedText = textOf(page).replace(/\s+/g, " ").trim();
    expect(renderedText).not.toContain("צפייה כללית");
    expect(renderedText).not.toContain("עריכה כללית");
    expect(renderedText).not.toContain("שינוי שלב");
    expect(renderedText).not.toContain("הגדרות כלליות");
  });

  test("stage settings page denies users without MANAGE_STAGE_SETTINGS", async () => {
    mocks.auth.mockResolvedValue(staffSession);

    const page = await StageSettingsPage({ searchParams: Promise.resolve({}) });

    expect(mocks.loadInstitutionStageSettings).not.toHaveBeenCalled();
    expectText(page, "אין הרשאה");
  });

  test("stage settings page renders institutional draft, publish action, and past parameters", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "MANAGE_STAGE_SETTINGS"),
    );
    mocks.getInstitutionById.mockResolvedValue({ id: "institution-1", name: "פנימיית אור" });
    mocks.loadInstitutionStageSettings.mockResolvedValue({
      version: {
        id: "version-1",
        versionNumber: 3,
        requiredMeasurementDays: 14,
        stages: [{ id: "stage-1", name: "שלב א", order: 1 }],
        parameters: [],
      },
      draftProfile: {
        id: "profile-draft",
        name: "ברירת מחדל",
        status: "DRAFT",
        effectiveFrom: null,
        publishedAt: null,
        updatedAt: new Date("2026-07-06T09:00:00.000Z"),
        parameters: [
          {
            id: "profile-param-1",
            sourceParameterDefinitionId: "parameter-1",
            stageId: null,
            name: "אחריות",
            verbalDefinition: "עמידה בהתחייבויות",
            scoreScale: "ONE_TO_TEN",
            weightPercent: 60,
            active: true,
            displayOrder: 1,
            sourceParameterDefinition: {
              id: "parameter-1",
              stageId: null,
              name: "אחריות מקור",
              verbalDefinition: null,
              scoreScale: "ONE_TO_TEN",
              weightPercent: 50,
              active: true,
              displayOrder: 1,
            },
          },
          {
            id: "profile-param-2",
            sourceParameterDefinitionId: null,
            stageId: "stage-1",
            name: "פרמטר עבר",
            verbalDefinition: null,
            scoreScale: "ONE_TO_THREE",
            weightPercent: 40,
            active: false,
            displayOrder: 2,
            sourceParameterDefinition: null,
          },
        ],
      },
      publishedProfile: null,
    });

    const page = await StageSettingsPage({
      searchParams: Promise.resolve({ settingsNotice: "draft-saved" }),
    });
    const inputs = propsOfType(page, "input");
    const parameterRows = propsMatching(
      page,
      (props) => Array.isArray(props.parameters) && Array.isArray(props.stages),
    );

    expect(mocks.loadInstitutionStageSettings).toHaveBeenCalledWith("institution-1");
    expectText(page, "טיוטת ההגדרות נשמרה");
    expectText(page, "פרופיל ניקוד מוסדי");
    expectText(page, "פרסום פרופיל");
    expectText(page, "פרמטרי עבר");
    expectText(page, "פרמטר עבר");
    expect(inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "profileId", value: "profile-draft" }),
      ]),
    );
    expect(parameterRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parameters: expect.arrayContaining([
            expect.objectContaining({ name: "אחריות", weightPercent: 60, active: true }),
            expect.objectContaining({ name: "פרמטר עבר", weightPercent: 40, active: false }),
          ]),
          stages: expect.arrayContaining([expect.objectContaining({ id: "stage-1" })]),
        }),
      ]),
    );
  });

  test("group page exposes local stage settings when MANAGE_GROUP_SETTINGS is allowed", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getGroupById.mockResolvedValue({
      id: "group-1",
      institutionId: "institution-1",
      name: "קבוצת ארז",
      active: true,
    });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "MANAGE_GROUP_SETTINGS"),
    );

    const page = await GroupReportPage({ params: Promise.resolve({ groupId: "group-1" }) });

    expectText(page, "הגדרות פרופיל ניקוד");
    expectText(page, "ניהול הגדרות קבוצה");
    expectText(page, "אין הרשאה לדוח");
  });

  test("group page exposes report entry links when ENTER_REPORTS is allowed", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getGroupById.mockResolvedValue({
      id: "group-1",
      institutionId: "institution-1",
      name: "קבוצת ארז",
      active: true,
    });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "ENTER_REPORTS"),
    );
    mocks.listTraineesByGroup.mockResolvedValue([
      {
        id: "trainee-1",
        institutionId: "institution-1",
        groupId: "group-1",
        firstName: "נועה",
        lastName: "כהן",
      },
    ]);

    const page = await GroupReportPage({ params: Promise.resolve({ groupId: "group-1" }) });

    expect(mocks.buildGroupFitReport).not.toHaveBeenCalled();
    expect(mocks.listTraineesByGroup).toHaveBeenCalledWith("group-1", "institution-1");
    expectText(page, "בחירת חניך למילוי דיווח");
    expectText(page, "1 חניכים");
    expectText(page, "נועה כהן");
    expectText(page, "אין הרשאה לדוח");
  });

  test("group stage settings route renders inherited local fields", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getGroupById.mockResolvedValue({
      id: "group-1",
      institutionId: "institution-1",
      name: "קבוצת ארז",
      active: true,
    });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "MANAGE_GROUP_SETTINGS"),
    );
    mocks.loadGroupStageSettings.mockResolvedValue({
      version: {
        id: "version-1",
        versionNumber: 3,
        requiredMeasurementDays: 14,
        stages: [],
        parameters: [
          {
            id: "parameter-1",
            stageId: null,
            name: "אחריות",
            verbalDefinition: "עמידה בהתחייבויות",
            scoreScale: "ONE_TO_TEN",
            weightPercent: 100,
            active: true,
            displayOrder: 1,
          },
        ],
      },
      draftProfile: null,
      publishedProfile: null,
    });

    const page = await GroupStageSettingsPage({
      params: Promise.resolve({ groupId: "group-1" }),
      searchParams: Promise.resolve({ settingsNotice: "draft-saved" }),
    });
    const scopedPages = propsMatching(page, (props) => props.scopeId === "group-1");

    expect(mocks.loadGroupStageSettings).toHaveBeenCalledWith("institution-1", "group-1");
    expect(scopedPages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "קבוצת ארז",
          kicker: "הגדרות קבוצה",
          scopeFieldName: "groupId",
          settingsNotice: "draft-saved",
          settingsData: expect.objectContaining({
            version: expect.objectContaining({
              parameters: expect.arrayContaining([
                expect.objectContaining({ id: "parameter-1", name: "אחריות" }),
              ]),
            }),
          }),
        }),
      ]),
    );
  });

  test("trainee page exposes local stage settings when MANAGE_TRAINEE_SETTINGS is allowed", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getTraineeById.mockResolvedValue({
      id: "trainee-1",
      institutionId: "institution-1",
      groupId: "group-1",
      firstName: "נועה",
      lastName: "כהן",
      currentStageId: null,
      currentStage: null,
    });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "MANAGE_TRAINEE_SETTINGS"),
    );

    const page = await TraineeReportPage({
      params: Promise.resolve({ traineeId: "trainee-1" }),
    });

    expectText(page, "הגדרות פרופיל ניקוד");
    expectText(page, "ניהול הגדרות חניך");
    expectText(page, "אין הרשאה לדוח");
  });

  test("trainee page exposes report entry when ENTER_REPORTS is allowed", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getTraineeById.mockResolvedValue({
      id: "trainee-1",
      institutionId: "institution-1",
      groupId: "group-1",
      firstName: "נועה",
      lastName: "כהן",
      currentStageId: null,
      currentStage: null,
    });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "ENTER_REPORTS"),
    );

    const page = await TraineeReportPage({
      params: Promise.resolve({ traineeId: "trainee-1" }),
    });

    expect(mocks.buildTraineeFitReport).not.toHaveBeenCalled();
    expectText(page, "דיווח");
    expectText(page, "מילוי דיווח");
    expectText(page, "אין הרשאה לדוח");
  });

  test("trainee stage settings route renders inherited local fields", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getTraineeById.mockResolvedValue({
      id: "trainee-1",
      institutionId: "institution-1",
      groupId: "group-1",
      firstName: "נועה",
      lastName: "כהן",
      currentStageId: null,
      currentStage: null,
    });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "MANAGE_TRAINEE_SETTINGS"),
    );
    mocks.loadTraineeStageSettings.mockResolvedValue({
      version: {
        id: "version-1",
        versionNumber: 3,
        requiredMeasurementDays: 14,
        stages: [],
        parameters: [
          {
            id: "parameter-1",
            stageId: null,
            name: "אחריות",
            verbalDefinition: null,
            scoreScale: "ONE_TO_TEN",
            weightPercent: 100,
            active: true,
            displayOrder: 1,
          },
        ],
      },
      draftProfile: null,
      publishedProfile: null,
    });

    const page = await TraineeStageSettingsPage({
      params: Promise.resolve({ traineeId: "trainee-1" }),
      searchParams: Promise.resolve({}),
    });
    const scopedPages = propsMatching(page, (props) => props.scopeId === "trainee-1");

    expect(mocks.loadTraineeStageSettings).toHaveBeenCalledWith("institution-1", "trainee-1");
    expect(scopedPages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "נועה כהן",
          kicker: "הגדרות חניך",
          scopeFieldName: "traineeId",
          settingsData: expect.objectContaining({
            version: expect.objectContaining({
              parameters: expect.arrayContaining([
                expect.objectContaining({ id: "parameter-1", weightPercent: 100 }),
              ]),
            }),
          }),
        }),
      ]),
    );
  });

  test("trainee report entry route renders draft form parameters and vacation warning", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getTraineeById.mockResolvedValue({
      id: "trainee-1",
      institutionId: "institution-1",
      groupId: "group-1",
      firstName: "נועה",
      lastName: "כהן",
      currentStageId: null,
      currentStage: null,
    });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "ENTER_REPORTS"),
    );
    mocks.getTraineeReportFormData.mockResolvedValue({
      traineeId: "trainee-1",
      groupId: "group-1",
      measurementDate: new Date("2026-07-06T00:00:00.000Z"),
      stageProgramVersionId: "version-1",
      scoringProfileId: null,
      isVacationDay: true,
      existingReport: {
        id: "report-1",
        status: "DRAFT",
        note: "צריך להשלים",
        isVacationOverride: false,
      },
      parameters: [
        {
          key: "parameter-1",
          parameterDefinitionId: "parameter-1",
          scoringProfileParameterId: null,
          name: "אחריות",
          scoreScale: "ONE_TO_TEN",
          maxRawScore: 10,
          status: "SCORED",
          rawScore: 8,
        },
      ],
    });

    const page = await TraineeReportEntryPage({
      params: Promise.resolve({ traineeId: "trainee-1" }),
      searchParams: Promise.resolve({ date: "2026-07-06", reportNotice: "draft-saved" }),
    });
    const inputs = propsOfType(page, "input");
    const textareas = propsOfType(page, "textarea");
    const parameterRows = propsMatching(page, (props) => Array.isArray(props.parameters));

    expect(mocks.getTraineeReportFormData).toHaveBeenCalledWith({
      institutionId: "institution-1",
      traineeId: "trainee-1",
      measurementDate: new Date("2026-07-06T00:00:00.000Z"),
    });
    expectText(page, "טיוטת הדיווח נשמרה");
    expectText(page, "טיוטה להמשך");
    expectText(page, "המועד מסומן כחופשה");
    expectText(page, "שמירת טיוטה");
    expectText(page, "פרסום דיווח");
    expect(inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "traineeId", value: "trainee-1" }),
        expect.objectContaining({ name: "measurementDate", value: "2026-07-06" }),
      ]),
    );
    expect(textareas).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "note", defaultValue: "צריך להשלים" })]),
    );
    expect(parameterRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parameters: expect.arrayContaining([
            expect.objectContaining({ name: "אחריות", status: "SCORED", rawScore: 8 }),
          ]),
        }),
      ]),
    );
  });

  test("trainee report entry authorizes against the selected-date report group", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getTraineeById.mockResolvedValue({
      id: "trainee-1",
      institutionId: "institution-1",
      groupId: "current-group",
      firstName: "נועה",
      lastName: "כהן",
      currentStageId: null,
      currentStage: null,
    });
    mocks.resolvePermission.mockImplementation((_, action, scope) =>
      Promise.resolve(action === "ENTER_REPORTS" && scope?.groupId === "historical-group"),
    );
    mocks.getTraineeReportFormData.mockResolvedValue({
      traineeId: "trainee-1",
      groupId: "historical-group",
      measurementDate: new Date("2026-07-01T00:00:00.000Z"),
      stageProgramVersionId: "version-1",
      scoringProfileId: null,
      isVacationDay: false,
      existingReport: null,
      parameters: [
        {
          key: "parameter-1",
          parameterDefinitionId: "parameter-1",
          scoringProfileParameterId: null,
          name: "אחריות",
          scoreScale: "ONE_TO_TEN",
          maxRawScore: 10,
          status: "NOT_SCORED",
          rawScore: null,
        },
      ],
    });

    const page = await TraineeReportEntryPage({
      params: Promise.resolve({ traineeId: "trainee-1" }),
      searchParams: Promise.resolve({ date: "2026-07-01" }),
    });
    const parameterRows = propsMatching(page, (props) => Array.isArray(props.parameters));

    expect(mocks.resolvePermission).toHaveBeenCalledWith(
      expect.objectContaining({ id: "staff-1" }),
      "ENTER_REPORTS",
      { traineeId: "trainee-1", groupId: "historical-group" },
    );
    expectText(page, "פנוי לדיווח");
    expect(parameterRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parameters: expect.arrayContaining([expect.objectContaining({ name: "אחריות" })]),
        }),
      ]),
    );
  });

  test("trainee report entry does not render historical-group data when date-specific permission is denied", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getTraineeById.mockResolvedValue({
      id: "trainee-1",
      institutionId: "institution-1",
      groupId: "current-group",
      firstName: "נועה",
      lastName: "כהן",
      currentStageId: null,
      currentStage: null,
    });
    mocks.resolvePermission.mockImplementation((_, action, scope) =>
      Promise.resolve(action === "ENTER_REPORTS" && scope?.groupId === "current-group"),
    );
    mocks.getTraineeReportFormData.mockResolvedValue({
      traineeId: "trainee-1",
      groupId: "historical-group",
      measurementDate: new Date("2026-07-01T00:00:00.000Z"),
      stageProgramVersionId: "version-1",
      scoringProfileId: null,
      isVacationDay: false,
      existingReport: {
        id: "report-1",
        status: "DRAFT",
        note: "הערה סודית",
        isVacationOverride: false,
      },
      parameters: [
        {
          key: "secret-parameter",
          parameterDefinitionId: "secret-parameter",
          scoringProfileParameterId: null,
          name: "פרמטר סודי",
          scoreScale: "ONE_TO_TEN",
          maxRawScore: 10,
          status: "SCORED",
          rawScore: 7,
        },
      ],
    });

    const page = await TraineeReportEntryPage({
      params: Promise.resolve({ traineeId: "trainee-1" }),
      searchParams: Promise.resolve({ date: "2026-07-01" }),
    });

    expect(mocks.resolvePermission).toHaveBeenCalledWith(
      expect.objectContaining({ id: "staff-1" }),
      "ENTER_REPORTS",
      { traineeId: "trainee-1", groupId: "historical-group" },
    );
    expectText(page, "אין הרשאה");
    expect(propsOfType(page, "textarea")).toEqual([]);
    expect(propsMatching(page, (props) => Array.isArray(props.parameters))).toEqual([]);
  });

  test("group report prompts logged-out users to sign in", async () => {
    mocks.auth.mockResolvedValue(null);

    const page = await GroupReportPage({ params: Promise.resolve({ groupId: "group-1" }) });

    expectText(page, "נדרשת התחברות");
    expectText(page, "התחברות");
  });

  test("group report fails closed for a foreign institution group", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getGroupById.mockResolvedValue({ id: "group-1", institutionId: "other", name: "זר" });

    await expect(
      GroupReportPage({ params: Promise.resolve({ groupId: "group-1" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("group report renders allowed trainee rows and sufficiency state", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getGroupById.mockResolvedValue({
      id: "group-1",
      institutionId: "institution-1",
      name: "קבוצת ארז",
    });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "VIEW_REPORTS"),
    );
    mocks.buildGroupFitReport.mockResolvedValue([
      {
        traineeId: "trainee-1",
        firstName: "נועה",
        lastName: "כהן",
        currentStageName: "שלב ב",
        mostRecentScore: { totalScore: 8.2 },
        dataSufficiency: {
          isSufficient: true,
          measurementDaysIncluded: 3,
          measurementDaysRequired: 3,
          parametersIncluded: 4,
          parametersExpected: 4,
        },
      },
      {
        traineeId: "trainee-2",
        firstName: "דניאל",
        lastName: "לוי",
        currentStageName: null,
        mostRecentScore: null,
        dataSufficiency: {
          isSufficient: false,
          measurementDaysIncluded: 1,
          measurementDaysRequired: 3,
          parametersIncluded: 2,
          parametersExpected: 4,
        },
      },
    ]);

    const page = await GroupReportPage({ params: Promise.resolve({ groupId: "group-1" }) });

    expect(mocks.resolvePermission).toHaveBeenCalledWith(
      { id: "staff-1", institutionId: "institution-1", role: "COUNSELOR" },
      "VIEW_REPORTS",
      { groupId: "group-1" },
    );
    expectText(page, "קבוצת ארז");
    expectText(page, "נועה כהן");
    expectText(page, "מספיק נתונים");
    expectText(page, "מיעוט נתונים");
  });

  test("group page renders management controls when MANAGE_GROUPS is allowed", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getGroupById.mockResolvedValue({
      id: "group-1",
      institutionId: "institution-1",
      name: "קבוצת ארז",
      description: "שכבת ט",
      active: true,
    });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "MANAGE_GROUPS"),
    );
    mocks.listStaffByInstitution.mockResolvedValue([
      { id: "staff-2", name: "דנה מדריכה", email: "dana@example.test" },
    ]);
    mocks.listGroupStaffIds.mockResolvedValue(["staff-2"]);

    const page = await GroupReportPage({
      params: Promise.resolve({ groupId: "group-1" }),
      searchParams: Promise.resolve({ groupNotice: "updated" }),
    });

    expect(mocks.buildGroupFitReport).not.toHaveBeenCalled();
    expect(mocks.listGroupStaffIds).toHaveBeenCalledWith("group-1");
    expectText(page, "עריכת קבוצה");
    expectText(page, "העברה לארכיון");
    expectText(page, "דנה מדריכה");
    expectText(page, "הקבוצה נשמרה");
    expectText(page, "אין הרשאה לדוח");
  });

  test("group page renders trainee creation when MANAGE_TRAINEES is allowed", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getGroupById.mockResolvedValue({
      id: "group-1",
      institutionId: "institution-1",
      name: "קבוצת ארז",
      active: true,
    });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "MANAGE_TRAINEES"),
    );
    mocks.getPrimaryStageProgramVersion.mockResolvedValue({
      stages: [{ id: "stage-1", name: "שלב א" }],
    });

    const page = await GroupReportPage({ params: Promise.resolve({ groupId: "group-1" }) });

    expect(mocks.buildGroupFitReport).not.toHaveBeenCalled();
    expect(mocks.getPrimaryStageProgramVersion).toHaveBeenCalledWith("institution-1");
    expectText(page, "הוספת חניך");
    expectText(page, "שם פרטי");
    expectText(page, "שלב א");
    expectText(page, "אין הרשאה לדוח");
  });

  test("group page renders group-scoped vacation management when MANAGE_VACATIONS is allowed", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getGroupById.mockResolvedValue({
      id: "group-1",
      institutionId: "institution-1",
      name: "קבוצת ארז",
      active: true,
    });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "MANAGE_VACATIONS"),
    );
    mocks.listVacationPeriodsByInstitution.mockResolvedValue([
      {
        id: "vacation-1",
        title: "טיול קבוצה",
        note: null,
        startsOn: new Date("2026-07-04T00:00:00.000Z"),
        endsOn: new Date("2026-07-04T00:00:00.000Z"),
        groupId: "group-1",
        traineeId: null,
      },
      {
        id: "vacation-2",
        title: "חופשת מוסד",
        note: null,
        startsOn: new Date("2026-07-01T00:00:00.000Z"),
        endsOn: new Date("2026-07-01T00:00:00.000Z"),
        groupId: null,
        traineeId: null,
      },
    ]);

    const page = await GroupReportPage({
      params: Promise.resolve({ groupId: "group-1" }),
      searchParams: Promise.resolve({ vacationNotice: "updated" }),
    });
    const [vacationSection] = propsOfType(page, VacationManagement);

    expect(mocks.buildGroupFitReport).not.toHaveBeenCalled();
    expectText(page, "החופשה נשמרה");
    expect(vacationSection).toMatchObject({
      heading: "חופשות קבוצה",
      returnTo: "/groups/group-1",
      groupId: "group-1",
    });
    expect((vacationSection?.vacations as Array<{ title: string }>).map((vacation) => vacation.title)).toEqual([
      "טיול קבוצה",
    ]);
  });

  test("group report shows a permission denial without report data", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getGroupById.mockResolvedValue({
      id: "group-1",
      institutionId: "institution-1",
      name: "קבוצת ארז",
    });
    mocks.resolvePermission.mockResolvedValue(false);

    const page = await GroupReportPage({ params: Promise.resolve({ groupId: "group-1" }) });

    expect(mocks.buildGroupFitReport).not.toHaveBeenCalled();
    expectText(page, "אין הרשאה");
  });

  test("trainee report renders allowed daily scores and latest parameter details", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getTraineeById.mockResolvedValue({
      id: "trainee-1",
      institutionId: "institution-1",
      groupId: "group-1",
    });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "VIEW_REPORTS"),
    );
    mocks.buildTraineeFitReport.mockResolvedValue({
      traineeId: "trainee-1",
      firstName: "נועה",
      lastName: "כהן",
      currentStageName: "שלב ב",
      dailyScores: [
        {
          date: new Date("2026-07-04T00:00:00.000Z"),
          totalScore: 7.4,
          parameterDetails: [],
        },
        {
          date: new Date("2026-07-05T00:00:00.000Z"),
          totalScore: 8.2,
          parameterDetails: [
            {
              parameterDefinitionId: "parameter-1",
              name: "אחריות",
              weightPercent: 50,
              status: "SCORED",
              rawScore: 8,
            },
            {
              parameterDefinitionId: "parameter-2",
              name: "השתתפות",
              weightPercent: 50,
              status: "NOT_APPLICABLE",
              rawScore: null,
            },
          ],
        },
      ],
      dataSufficiency: {
        isSufficient: true,
        measurementDaysIncluded: 2,
        measurementDaysRequired: 2,
        parametersIncluded: 2,
        parametersExpected: 2,
      },
    });

    const page = await TraineeReportPage({
      params: Promise.resolve({ traineeId: "trainee-1" }),
    });

    expect(mocks.resolvePermission).toHaveBeenCalledWith(
      { id: "staff-1", institutionId: "institution-1", role: "COUNSELOR" },
      "VIEW_REPORTS",
      { traineeId: "trainee-1", groupId: "group-1" },
    );
    expectText(page, "נועה כהן");
    expectText(page, "ציון אחרון");
    expectText(page, "8.2");
    expectText(page, "אחריות");
    expectText(page, "לא רלוונטי");
  });

  test("trainee page renders edit and transfer controls without report data when management is allowed", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getTraineeById.mockResolvedValue({
      id: "trainee-1",
      institutionId: "institution-1",
      groupId: "group-1",
      firstName: "נועה",
      lastName: "כהן",
      currentStageId: "stage-1",
      currentStage: { id: "stage-1", name: "שלב א" },
    });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "MANAGE_TRAINEES" || action === "TRANSFER_TRAINEES"),
    );
    mocks.getPrimaryStageProgramVersion.mockResolvedValue({
      stages: [
        { id: "stage-1", name: "שלב א" },
        { id: "stage-2", name: "שלב ב" },
      ],
    });
    mocks.listGroupsByInstitution.mockResolvedValue([
      { id: "group-1", name: "קבוצת ארז", active: true },
      { id: "group-2", name: "קבוצת אלון", active: true },
    ]);

    const page = await TraineeReportPage({
      params: Promise.resolve({ traineeId: "trainee-1" }),
      searchParams: Promise.resolve({ traineeNotice: "transferred" }),
    });

    expect(mocks.buildTraineeFitReport).not.toHaveBeenCalled();
    expect(mocks.listGroupsByInstitution).toHaveBeenCalledWith("institution-1");
    expectText(page, "עריכת חניך");
    expectText(page, "העברת קבוצה");
    expectText(page, "קבוצת אלון");
    expectText(page, "החניך הועבר קבוצה");
    expectText(page, "אין הרשאה לדוח");
  });

  test("trainee page renders trainee-scoped vacation management when MANAGE_VACATIONS is allowed", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getTraineeById.mockResolvedValue({
      id: "trainee-1",
      institutionId: "institution-1",
      groupId: "group-1",
      firstName: "נועה",
      lastName: "כהן",
      currentStageId: null,
      currentStage: null,
    });
    mocks.resolvePermission.mockImplementation((_, action) =>
      Promise.resolve(action === "MANAGE_VACATIONS"),
    );
    mocks.listVacationPeriodsByInstitution.mockResolvedValue([
      {
        id: "vacation-1",
        title: "חופשה אישית",
        note: null,
        startsOn: new Date("2026-07-06T00:00:00.000Z"),
        endsOn: new Date("2026-07-06T00:00:00.000Z"),
        groupId: null,
        traineeId: "trainee-1",
      },
      {
        id: "vacation-2",
        title: "חופשת קבוצה",
        note: null,
        startsOn: new Date("2026-07-04T00:00:00.000Z"),
        endsOn: new Date("2026-07-04T00:00:00.000Z"),
        groupId: "group-1",
        traineeId: null,
      },
    ]);

    const page = await TraineeReportPage({
      params: Promise.resolve({ traineeId: "trainee-1" }),
      searchParams: Promise.resolve({ vacationNotice: "deleted" }),
    });
    const [vacationSection] = propsOfType(page, VacationManagement);

    expect(mocks.buildTraineeFitReport).not.toHaveBeenCalled();
    expectText(page, "החופשה נמחקה");
    expect(vacationSection).toMatchObject({
      heading: "חופשות חניך",
      returnTo: "/trainees/trainee-1",
      traineeId: "trainee-1",
    });
    expect((vacationSection?.vacations as Array<{ title: string }>).map((vacation) => vacation.title)).toEqual([
      "חופשה אישית",
    ]);
  });

  test("trainee report fails closed for foreign institution trainees", async () => {
    mocks.auth.mockResolvedValue(staffSession);
    mocks.getTraineeById.mockResolvedValue({
      id: "trainee-1",
      institutionId: "other",
      groupId: "group-1",
    });

    await expect(
      TraineeReportPage({ params: Promise.resolve({ traineeId: "trainee-1" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
