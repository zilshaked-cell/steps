import { config } from "dotenv";

// Load the dev .env first (to compare against), then .env.test on top of it.
config({ path: ".env" });
const devDatabaseUrl = process.env.DATABASE_URL;
config({ path: ".env.test", override: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Copy .env.test.example to .env.test and fill it in before running integration tests.",
  );
}

// Hard guard: this harness truncates every app table before each test file. If
// TEST_DATABASE_URL ever resolves to the same database as dev DATABASE_URL (e.g.
// a misconfigured .env.test), refuse to run rather than silently wiping steps_dev.
if (testDatabaseUrl === devDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL must not equal the dev DATABASE_URL — refusing to run to avoid truncating dev data. Point it at a separate database (e.g. steps_test).",
  );
}

// This is what makes the suite exercise real application code: src/lib/prisma.ts
// reads process.env.DATABASE_URL when it's first imported. Overwriting it here,
// before any test file's own imports run, means every repository/service the tests
// import — unmodified — transparently talks to the test database instead of dev.
process.env.DATABASE_URL = testDatabaseUrl;
