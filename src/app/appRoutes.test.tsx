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
  getGroupById: vi.fn(),
  getTraineeById: vi.fn(),
  resolvePermission: vi.fn(),
  buildGroupFitReport: vi.fn(),
  buildTraineeFitReport: vi.fn(),
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
  listGroupsByInstitution: mocks.listGroupsByInstitution,
}));

vi.mock("@/repositories/traineeRepository", () => ({
  getTraineeById: mocks.getTraineeById,
}));

vi.mock("@/services/permissions/resolvePermission", () => ({
  resolvePermission: mocks.resolvePermission,
}));

vi.mock("@/services/stagePrograms/fitReport", () => ({
  buildGroupFitReport: mocks.buildGroupFitReport,
  buildTraineeFitReport: mocks.buildTraineeFitReport,
}));

import { AppShell } from "./AppShell";
import Home from "./page";
import GroupReportPage from "./groups/[groupId]/page";
import LoginPage from "./login/page";
import TraineeReportPage from "./trainees/[traineeId]/page";

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

describe("implemented app routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_GOOGLE_ID = "test-google-client-id";
    process.env.AUTH_GOOGLE_SECRET = "test-google-client-secret";
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

    const page = await Home();

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

    const page = await Home();

    expect(mocks.getInstitutionById).toHaveBeenCalledWith("institution-1");
    expect(mocks.listGroupsByInstitution).toHaveBeenCalledWith("institution-1");
    expectText(page, "פנימיית אור");
    expectText(page, "קבוצת ארז");
    expectText(page, "2 קבוצות");
  });

  test("app shell exposes session identity and sign-out affordance", () => {
    const shell = AppShell({ user: staffSession.user, children: <span>תוכן</span> });

    expectText(shell, "רות צוות");
    expectText(shell, "מדריך");
    expectText(shell, "יציאה");
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
    mocks.resolvePermission.mockResolvedValue(true);
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
    mocks.resolvePermission.mockResolvedValue(true);
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
