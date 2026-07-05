import { defineConfig, devices } from "@playwright/test";
import { parse } from "dotenv";
import { readFileSync } from "node:fs";

function readEnvFile(path: string): Record<string, string> {
  try {
    return parse(readFileSync(path));
  } catch {
    return {};
  }
}

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;
const devEnv = readEnvFile(".env");
const testEnv = readEnvFile(".env.test");
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? testEnv.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for Playwright e2e tests. Copy .env.test.example to .env.test.");
}

if (testDatabaseUrl === devEnv.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must not equal DATABASE_URL; refusing to run Playwright e2e tests.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID ?? "unused-e2e-client-id.apps.googleusercontent.com",
      AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET ?? "unused-e2e-client-secret",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-auth-secret-at-least-32-characters",
      AUTH_TRUST_HOST: "true",
      AUTH_URL: baseURL,
      DATABASE_URL: testDatabaseUrl,
      E2E_TEST_AUTH: "1",
      NEXT_DIST_DIR: "next-e2e-build",
      TEST_DATABASE_URL: testDatabaseUrl,
    },
  },
});
