package io.github.juanjpeople.opendomus;

import static androidx.test.espresso.intent.Intents.intended;
import static androidx.test.espresso.intent.Intents.intending;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;
import static org.junit.Assert.*;

import android.app.Activity;
import android.app.Instrumentation.ActivityResult;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import android.os.SystemClock;
import androidx.core.content.FileProvider;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.espresso.intent.Intents;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class NativeFlowTest {
    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> value = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(script, result -> {
            value.set(result);
            done.countDown();
        }));
        assertTrue("WebView did not answer", done.await(10, TimeUnit.SECONDS));
        return value.get();
    }

    private void await(ActivityScenario<MainActivity> scenario, String condition) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + 45000;
        do {
            if ("true".equals(evaluate(scenario, "Boolean(" + condition + ")"))) return;
            SystemClock.sleep(150);
        } while (SystemClock.elapsedRealtime() < deadline);
        fail("Condition did not become true: " + condition + "; page: " + evaluate(scenario, "location.pathname + ': ' + document.body.innerText.slice(0, 1000)"));
    }

    private void ready(ActivityScenario<MainActivity> scenario) throws Exception {
        await(scenario, "window.Capacitor && window.Capacitor.isNativePlatform() && document.body.innerText.length > 20");
    }

    @Test
    public void offlineOnboardingAndReloadKeepTheHouse() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            scenario.onActivity(activity -> activity.getBridge().getWebView().loadUrl("https://localhost/empezar"));
            await(scenario, "[...document.querySelectorAll('button')].some(b => b.textContent.includes('Empezar acá'))");
            evaluate(scenario, "[...document.querySelectorAll('button')].find(b => b.textContent.includes('Empezar acá')).click()");
            await(scenario, "document.body.innerText.includes('¿Quién está en casa?') && document.body.innerText.includes('Administrador')");
            scenario.recreate();
            ready(scenario);
            await(scenario, "document.body.innerText.includes('Administrador')");
            scenario.onActivity(activity -> activity.getBridge().getWebView().loadUrl("https://localhost/cuenta?modo=crear"));
            await(scenario, "location.pathname === '/cuenta' && document.body.innerText.includes('Esta instalación funciona sin servidor')");
            evaluate(scenario, "window.__swCount = -1; navigator.serviceWorker.getRegistrations().then(r => window.__swCount = r.length)");
            await(scenario, "window.__swCount === 0");
        }
    }

    @Test
    public void nativeBackupWritesUtf8OnlyToSelectedDocument() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        File destination = new File(context.getExternalFilesDir(Environment.DIRECTORY_PICTURES), "backup-test.json");
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", destination);
        Intents.init();
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new ActivityResult(Activity.RESULT_OK, new Intent().setData(uri)));
            evaluate(scenario, "window.__saved = null; window.Capacitor.nativePromise('Backup', 'save', {filename:'backup-test.json',data:'{\"nombre\":\"Taller • café\"}'}).then(r => window.__saved = r.saved).catch(() => window.__saved = 'error')");
            await(scenario, "window.__saved === true");
            intended(hasAction(Intent.ACTION_CREATE_DOCUMENT));
            assertEquals("{\"nombre\":\"Taller • café\"}", new String(Files.readAllBytes(destination.toPath()), StandardCharsets.UTF_8));
        } finally {
            Intents.release();
            Files.deleteIfExists(destination.toPath());
        }
    }

    @Test
    public void cancelledBackupDoesNotReportSuccess() throws Exception {
        Intents.init();
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new ActivityResult(Activity.RESULT_CANCELED, null));
            evaluate(scenario, "window.__saved = null; window.Capacitor.nativePromise('Backup', 'save', {filename:'cancelled.json',data:'{}'}).then(r => window.__saved = r.saved).catch(() => window.__saved = 'error')");
            await(scenario, "window.__saved === false");
            intended(hasAction(Intent.ACTION_CREATE_DOCUMENT));
        } finally {
            Intents.release();
        }
    }
}
