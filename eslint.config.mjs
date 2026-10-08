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
    "operator-dist/**",
    "demo-dist/**",
    "dist/**",
    "build/**",
    "android/app/src/main/assets/**",
    "android/**/build/**",
    "android/capacitor-cordova-android-plugins/**",
    "next-env.d.ts",
    // Generados: Wrangler (Cloudflare local) y los reportes de Playwright.
    ".wrangler/**",
    "playwright-report/**",
    "test-results/**",
    // Evidencias locales de revisión (capturas, trazas, informes del CI descargados).
    ".playwright-mcp/**",
  ]),
]);

export default eslintConfig;
