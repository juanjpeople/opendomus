import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.github.juanjpeople.opendomus",
  appName: "OpenDomus",
  webDir: "out",
  server: { hostname: "localhost", androidScheme: "https", cleartext: false },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
};

export default config;
