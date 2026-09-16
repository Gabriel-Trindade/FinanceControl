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
    // Worktrees ficam dentro do repositório (.gitignore reserva .worktrees/), cada uma com o
    // próprio .next/**: sem isto, "npm run lint" no checkout principal também varreria elas.
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
