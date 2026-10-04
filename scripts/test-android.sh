#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../android"

# Keep synthetic screenshots even when a test fails. No user data or production device is used.
trap 'adb pull /sdcard/Android/data/io.github.juanjpeople.opendomus/files/test-screenshots app/build/reports/native-screenshots || true' EXIT

bash gradlew --no-daemon :app:connectedDebugAndroidTest \
  -Pandroid.injected.androidTest.leaveApksInstalledAfterRun=true \
  -Pandroid.testInstrumentationRunnerArguments.class=io.github.juanjpeople.opendomus.NativeFlowTest

# Same application ID, origin and runner-local debug key; no uninstall or clear-data command.
bash gradlew --no-daemon :app:assembleDebug -PappVersionCode=2
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am instrument -w \
  -e class io.github.juanjpeople.opendomus.UpgradeFlowTest \
  io.github.juanjpeople.opendomus.test/androidx.test.runner.AndroidJUnitRunner \
  | tee app/build/reports/upgrade-test.txt
# am instrument may exit 0 even when JUnit fails. Require an executed, successful test.
grep -Fq 'OK (1 test)' app/build/reports/upgrade-test.txt
