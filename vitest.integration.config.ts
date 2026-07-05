import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

// Real-Postgres integration suite. Deliberately separate from vitest.config.ts so
// `npm test` (unit only) never needs a database, and this suite never accidentally
// runs as part of a plain `vitest run`. Requires TEST_DATABASE_URL — see
// .env.test.example. Runs serially: every test file truncates the whole
// database in its setup, so parallel files would race.
export default defineConfig({
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/vitestSetup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    sequence: {
      concurrent: false,
    },
  },
});
