// Builds the production app for Playwright. In Next 16, `next dev` writes to
// `.next/dev`, so a production build in `.next` can coexist with a running dev
// server on another port.
import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, open, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: ".env.test" });

if (!process.env.TEST_DATABASE_URL) {
  console.error(
    "TEST_DATABASE_URL is not set. Copy .env.test.example to .env.test and fill it in.",
  );
  process.exit(1);
}

const port = process.env.E2E_PORT ?? "3100";
const baseURL = `http://127.0.0.1:${port}`;
const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const e2eDistDir = "next-e2e-build";
const e2eBuildLockPath = fileURLToPath(
  new URL("../test-results/e2e-build.lock", import.meta.url),
);
const nextBuildLockPath = fileURLToPath(new URL(`../${e2eDistDir}/lock`, import.meta.url));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(description, isReady) {
  const startedAt = Date.now();
  const timeoutMs = Number(process.env.E2E_BUILD_LOCK_TIMEOUT_MS ?? 180_000);

  while (!isReady()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for ${description}.`);
    }
    await sleep(1_000);
  }
}

async function acquireE2eBuildLock() {
  await mkdir(dirname(e2eBuildLockPath), { recursive: true });

  while (true) {
    try {
      const handle = await open(e2eBuildLockPath, "wx");
      await handle.close();
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      await waitUntil("another e2e build wrapper to finish", () => !existsSync(e2eBuildLockPath));
    }
  }
}

try {
  await acquireE2eBuildLock();
  await waitUntil("the active Next build lock to clear", () => !existsSync(nextBuildLockPath));

  const result = spawnSync(process.execPath, [nextCli, "build"], {
    stdio: "inherit",
    env: {
      ...process.env,
      AUTH_GOOGLE_ID:
        process.env.AUTH_GOOGLE_ID ?? "unused-e2e-client-id.apps.googleusercontent.com",
      AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET ?? "unused-e2e-client-secret",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-auth-secret-at-least-32-characters",
      AUTH_TRUST_HOST: "true",
      AUTH_URL: baseURL,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      E2E_TEST_AUTH: "1",
      NEXT_DIST_DIR: e2eDistDir,
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    },
  });

  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await rm(e2eBuildLockPath, { force: true });
}
