// Builds a clean production app for Playwright.
import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { mkdir, open, readFile, rm } from "node:fs/promises";
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
const nextBuildPath = fileURLToPath(new URL(`../${e2eDistDir}`, import.meta.url));
const nextDevTypesPath = fileURLToPath(new URL("../.next/dev/types", import.meta.url));
let e2eBuildLockAcquired = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireE2eBuildLock() {
  await mkdir(dirname(e2eBuildLockPath), { recursive: true });
  const startedAt = Date.now();
  const timeoutMs = Number(process.env.E2E_BUILD_LOCK_TIMEOUT_MS ?? 180_000);

  while (true) {
    try {
      const handle = await open(e2eBuildLockPath, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
      await handle.close();
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const removedStaleLock = await removeStaleE2eBuildLock();
      if (!removedStaleLock) {
        if (Date.now() - startedAt > timeoutMs) {
          throw new Error("Timed out waiting for another e2e build wrapper to finish.");
        }
        await sleep(1_000);
      }
    }
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function removeStaleE2eBuildLock() {
  try {
    const raw = await readFile(e2eBuildLockPath, "utf8");
    const owner = JSON.parse(raw);
    if (isProcessAlive(owner.pid)) return false;
  } catch {
    // Empty or malformed wrapper lock files are leftovers from interrupted runs.
  }

  await rm(e2eBuildLockPath, { force: true });
  return true;
}

async function rmWithRetry(path, options) {
  const attempts = Number(process.env.E2E_RM_ATTEMPTS ?? 8);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rm(path, options);
      return;
    } catch (error) {
      if (!["EBUSY", "ENOTEMPTY", "EPERM"].includes(error?.code) || attempt === attempts) {
        throw error;
      }
      await sleep(500 * attempt);
    }
  }
}

try {
  await acquireE2eBuildLock();
  e2eBuildLockAcquired = true;
  await rmWithRetry(nextBuildPath, { recursive: true, force: true });
  await rmWithRetry(nextDevTypesPath, { recursive: true, force: true });

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
  if (e2eBuildLockAcquired) {
    await rm(e2eBuildLockPath, { force: true });
  }
}
