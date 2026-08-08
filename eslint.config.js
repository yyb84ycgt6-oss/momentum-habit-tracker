import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  eslintPluginPrettier,
  {
    // Code ported verbatim from Jackie's PC.
    //
    // These files were written against a looser tsconfig and carry that
    // house style: ~276 `any`s, empty catch blocks used as deliberate
    // best-effort guards, and over-escaped regexes. They all type-check
    // under this project's `strict: true`, and Prettier is still enforced.
    // Rewriting them for style would mean touching 90+ working app files
    // and risking behaviour changes to win nothing, so these four rules are
    // relaxed *here only* — code we author still gets the full rule set.
    //
    // Anything genuinely broken should be fixed in the file, not muted here.
    files: [
      "src/pc/apps/ported/**",
      "src/pc/jackie-core/**",
      "src/pc/sas-pod-system/**",
      "src/pc/lib/**",
      "src/pc/router/**",
      "src/pc/supervision/**",
      "src/pc/storage/**",
      "src/pc/knowledge/**",
      "src/pc/fleet/**",
      "src/pc/github/**",
      "src/pc/generative/**",
      "src/pc/provenance/**",
      "src/pc/codes/**",
      "src/pc/whole-desktop/**",
      "src/pc/desktop/**",
    ],
    // Modules written for this project rather than ported keep the full rule
    // set, even though they sit in the same directories as ported code.
    ignores: [
      "src/pc/lib/bus.ts",
      "src/pc/lib/sync.ts",
      "src/pc/lib/notes.ts",
      "src/pc/lib/persist.ts",
      "src/pc/lib/gemini.ts",
      "src/pc/lib/authContext.tsx",
      "src/pc/lib/firestore-compat.ts",
      "src/pc/lib/auth-compat.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-empty": "off",
      "no-useless-escape": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
);
