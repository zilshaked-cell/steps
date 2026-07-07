// Applies existing migrations to the integration test database, without touching
// the dev DATABASE_URL in .env. Safe to run every time before integration tests —
// `prisma migrate deploy` only applies pending migrations, it's a no-op otherwise.
import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

config();
config({ path: ".env.test" });

if (!process.env.TEST_DATABASE_URL) {
  console.error(
    "TEST_DATABASE_URL is not set. Copy .env.test.example to .env.test and fill it in.",
  );
  process.exit(1);
}

if (process.env.DATABASE_URL && process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  console.error(
    "Refusing to migrate: TEST_DATABASE_URL must not match DATABASE_URL.",
  );
  process.exit(1);
}

const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));

const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
});

process.exit(result.status ?? 1);
