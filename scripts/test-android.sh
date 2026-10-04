#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../android"

# Bound a stalled instrumentation run and retain its log even if Gradle never
# produces JUnit XML. This script targets the Linux CI emulator, with GNU coreutils.
command -v timeout >/dev/null || { echo "GNU timeout is required" >&2; exit 1; }
mkdir -p app/build/reports
adb logcat -v threadtime > app/build/reports/native-logcat.txt 2>&1 &
logcat_pid=$!
cleanup() {
  kill "$logcat_pid" 2>/dev/null || true
  wait "$logcat_pid" 2>/dev/null || true
  # Only synthetic data from the dedicated test emulator is captured.
  timeout 20s adb pull /sdcard/Android/data/io.github.juanjpeople.opendomus/files/test-screenshots app/build/reports/native-screenshots || true
}
trap cleanup EXIT

timeout --signal=TERM --kill-after=15s 8m bash gradlew --no-daemon :app:connectedDebugAndroidTest \
  -Pandroid.injected.androidTest.leaveApksInstalledAfterRun=true \
  -Pandroid.testInstrumentationRunnerArguments.class=io.github.juanjpeople.opendomus.NativeFlowTest

# Same application ID, origin and runner-local debug key; no uninstall or clear-data command.
bash gradlew --no-daemon :app:assembleDebug -PappVersionCode=2
adb install -r app/build/outputs/apk/debug/app-debug.apk
timeout --signal=TERM --kill-after=15s 2m adb shell am instrument -w \
  -e class io.github.juanjpeople.opendomus.UpgradeFlowTest \
  io.github.juanjpeople.opendomus.test/androidx.test.runner.AndroidJUnitRunner \
  | tee app/build/reports/upgrade-test.txt
# am instrument may exit 0 even when JUnit fails. Require an executed, successful test.
grep -Fq 'OK (1 test)' app/build/reports/upgrade-test.txt
