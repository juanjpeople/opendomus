import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

export default defineConfig(config, {
  testMatch: "local-build.spec.ts",
  testIgnore: [],
});
