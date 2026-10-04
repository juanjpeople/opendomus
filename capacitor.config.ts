import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.github.juanjpeople.opendomus",
  appName: "OpenDomus",
  webDir: "out",
  // Native calls can carry the entire backup. Do not log bridge payloads, even in debug APKs.
  loggingBehavior: "none",
  server: { hostname: "localhost", androidScheme: "https", cleartext: false },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
};

export default config;
