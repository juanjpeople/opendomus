import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const release = process.argv.includes("--release");
const root = fileURLToPath(new URL("../", import.meta.url));
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk || !existsSync(join(sdk, "platforms", "android-36", "android.jar"))) {
  console.error("Android SDK 36 no encontrado. Instalalo desde Android Studio y definí ANDROID_HOME. Ver docs/ANDROID.md.");
  process.exit(1);
}

try {
  execFileSync(process.execPath, [join(root, "scripts", "build.mjs"), "--local"], { cwd: root, stdio: "inherit" });
  execFileSync(process.execPath, [join(root, "node_modules", "@capacitor", "cli", "bin", "capacitor"), "sync", "android"], { cwd: root, stdio: "inherit" });
  // The command and arguments are fixed; no user input is interpolated into the Windows shell.
  const command = process.platform === "win32" ? "cmd.exe" : "bash";
  const task = release ? "bundleRelease" : "assembleDebug";
  const args = process.platform === "win32"
    ? ["/d", "/c", ".\\gradlew.bat", "--no-daemon", task]
    : ["gradlew", "--no-daemon", task];
  execFileSync(command, args, { cwd: join(root, "android"), stdio: "inherit" });
  console.log(release
    ? "Paquete para Play Store: android/app/build/outputs/bundle/release/app-release.aab"
    : "APK de prueba: android/app/build/outputs/apk/debug/app-debug.apk");
} catch {
  console.error("No se completó el APK. Revisá el error anterior y los requisitos en docs/ANDROID.md.");
  process.exitCode = 1;
}
