import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Lets intentionally-unimplemented params (e.g. deliberate not-yet-decided
      // stubs) be named _foo without a lint error, instead of needing `void foo;`
      // filler statements at every call site.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local generated/test artifacts:
    ".next-e2e/**",
    "coverage/**",
    "next-e2e-build/**",
    "playwright-report/**",
    "test-results/**",
    "src/generated/prisma/**",
  ]),
]);

export default eslintConfig;
