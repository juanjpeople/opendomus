import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.github.juanjpeople.opendomus",
  // Mismo nombre que la web (`src/config/brand.ts`): se define con NEXT_PUBLIC_APP_NAME.
  appName: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "OpenDomus",
  webDir: "out",
  // Native calls can carry the entire backup. Do not log bridge payloads, even in debug APKs.
  loggingBehavior: "none",
  server: { hostname: "localhost", androidScheme: "https", cleartext: false },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
};

export default config;
