import { config } from "dotenv";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

config({ path: ".env.test" });

const port = process.env.E2E_PORT ?? "3100";
const baseURL = `http://127.0.0.1:${port}`;
const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));

const child = spawn(
  process.execPath,
  [nextCli, "start", "--hostname", "127.0.0.1", "--port", port],
  {
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
      NEXT_DIST_DIR: "next-e2e-build",
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    },
  },
);

let shuttingDown = false;

function stopChild(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (!child.killed) {
    child.kill(signal);
  }

  setTimeout(() => {
    process.exit(0);
  }, 5_000).unref();
}

process.on("SIGINT", () => stopChild("SIGINT"));
process.on("SIGTERM", () => stopChild("SIGTERM"));

child.on("exit", (code, signal) => {
  if (shuttingDown) {
    process.exit(0);
  }

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
