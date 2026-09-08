import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // k6 load scripts. They run in k6's own runtime, not the app bundle,
    // and its API requires the default-exported function this rule warns
    // about.
    "tools/load/**",
  ]),
]);

export default eslintConfig;
