package io.github.juanjpeople.opendomus;

import static androidx.test.espresso.intent.Intents.intended;
import static androidx.test.espresso.intent.Intents.intending;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasType;
import static org.hamcrest.Matchers.allOf;
import static org.junit.Assert.*;

import android.app.Activity;
import android.app.Instrumentation.ActivityResult;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Environment;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.InputDevice;
import androidx.core.content.FileProvider;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.espresso.intent.Intents;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONArray;
import org.json.JSONObject;

@RunWith(AndroidJUnit4.class)
public class NativeFlowTest {
    private void screenshot(String name) throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        File folder = new File(context.getExternalFilesDir(null), "test-screenshots");
        assertTrue(folder.isDirectory() || folder.mkdirs());
        Bitmap bitmap = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(bitmap);
        try (FileOutputStream output = new FileOutputStream(new File(folder, name + ".png"))) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, output);
        } finally {
            bitmap.recycle();
        }
    }

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
        screenshot("failure");
        fail("Condition did not become true: " + condition + "; page: " + evaluate(scenario, "location.pathname + ': ' + document.body.innerText.slice(0, 1000)"));
    }

    private void ready(ActivityScenario<MainActivity> scenario) throws Exception {
        await(scenario, "window.Capacitor && window.Capacitor.isNativePlatform() && document.body.innerText.length > 20");
    }

    /** A real touch supplies the user activation required by the WebView file picker. */
    private void tap(ActivityScenario<MainActivity> scenario, String element) throws Exception {
        evaluate(scenario, "window.__tapTarget = " + element + "; window.__tapTarget.scrollIntoView({block:'center'})");
        await(scenario, "(() => { let e=window.__tapTarget; if (!e?.isConnected || e.disabled) return false; for (; e; e=e.parentElement) if (Number(getComputedStyle(e).opacity) < 0.99 || e.getAnimations().some(a => a.playState === 'running')) return false; return true; })()");
        evaluate(scenario, "(() => {const r=window.__tapTarget.getBoundingClientRect(); window.__tap={x:r.x+r.width/2,y:r.y+r.height/2};})()");
        JSONObject point = new JSONObject(evaluate(scenario, "window.__tap"));
        float[] screen = new float[2];
        float x = (float) point.getDouble("x"), y = (float) point.getDouble("y");
        scenario.onActivity(activity -> {
            int[] offset = new int[2];
            activity.getBridge().getWebView().getLocationOnScreen(offset);
            float scale = activity.getBridge().getWebView().getScale();
            screen[0] = offset[0] + x * scale;
            screen[1] = offset[1] + y * scale;
        });
        long time = SystemClock.uptimeMillis();
        MotionEvent down = MotionEvent.obtain(time, time, MotionEvent.ACTION_DOWN, screen[0], screen[1], 0);
        MotionEvent up = MotionEvent.obtain(time, time + 60, MotionEvent.ACTION_UP, screen[0], screen[1], 0);
        down.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        up.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        try {
            assertTrue(InstrumentationRegistry.getInstrumentation().getUiAutomation().injectInputEvent(down, true));
            SystemClock.sleep(60);
            assertTrue(InstrumentationRegistry.getInstrumentation().getUiAutomation().injectInputEvent(up, true));
        } finally {
            down.recycle();
            up.recycle();
        }
    }

    private void verifySettingsRoundTrip(ActivityScenario<MainActivity> scenario) throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        File photo = new File(context.getExternalFilesDir(Environment.DIRECTORY_PICTURES), "fixture.png");
        File backup = new File(context.getExternalFilesDir(Environment.DIRECTORY_PICTURES), "house.json");
        Bitmap fixture = Bitmap.createBitmap(32, 24, Bitmap.Config.ARGB_8888);
        fixture.eraseColor(0xff1677ff);
        try (FileOutputStream output = new FileOutputStream(photo)) {
            fixture.compress(Bitmap.CompressFormat.PNG, 100, output);
        } finally { fixture.recycle(); }
        Uri photoUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", photo);
        Uri backupUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", backup);
        Intents.init();
        try {
            scenario.onActivity(activity -> activity.getBridge().getWebView().loadUrl("https://localhost/"));
            await(scenario, "[...document.querySelectorAll('h5')].some(e => e.textContent === 'Administrador')");
            evaluate(scenario, "[...document.querySelectorAll('h5')].find(e => e.textContent === 'Administrador').click()");
            await(scenario, "JSON.parse(localStorage.getItem('opendomus-session') || '{}').state?.currentProfileId");
            scenario.onActivity(activity -> activity.getBridge().getWebView().loadUrl("https://localhost/inventario"));
            await(scenario, "document.body.innerText.includes('Estantería')");
            evaluate(scenario, "[...document.querySelectorAll('span,h3,h4,h5')].find(e => e.textContent === 'Estantería').click()");
            await(scenario, "location.pathname === '/inventario/ver' && document.querySelector('input[aria-label=\"Stored contents\"],input[aria-label=\"Contenido guardado\"]')");
            evaluate(scenario, "(() => {const e=document.querySelector('input[aria-label=\"Stored contents\"],input[aria-label=\"Contenido guardado\"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Cables Android'); e.dispatchEvent(new Event('input',{bubbles:true}));})()");
            evaluate(scenario, "[...document.querySelectorAll('button')].find(b => /^(Anotar|Add note)$/.test(b.textContent.trim())).click()");
            await(scenario, "document.body.innerText.includes('Cables Android')");
            intending(allOf(hasAction(Intent.ACTION_GET_CONTENT), hasType("image/*"))).respondWith(new ActivityResult(Activity.RESULT_OK, new Intent().setData(photoUri)));
            tap(scenario, "[...document.querySelectorAll('button')].find(b => /^(Agregar fotos|Add photos)$/.test(b.textContent.trim()))");
            await(scenario, "document.querySelector('.od-photo-tile img')?.naturalWidth === 32");
            screenshot("container-with-photo");
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new ActivityResult(Activity.RESULT_OK, new Intent().setData(backupUri)));
            scenario.onActivity(activity -> activity.getBridge().getWebView().loadUrl("https://localhost/ajustes"));
            await(scenario, "[...document.querySelectorAll('button')].some(b => /^(Exportar|Export)$/.test(b.textContent.trim()) && !b.disabled)");
            tap(scenario, "[...document.querySelectorAll('button')].find(b => /^(Exportar|Export)$/.test(b.textContent.trim()))");
            await(scenario, "/Exportación lista|Export ready/.test(document.body.innerText)");
            JSONObject data = new JSONObject(new String(Files.readAllBytes(backup.toPath()), StandardCharsets.UTF_8));
            assertEquals("OpenDomus", data.getString("app"));
            JSONObject tables = data.getJSONObject("tables");
            assertTrue(tables.getJSONArray("photos").length() > 0);
            assertTrue(tables.getJSONArray("containerContents").toString().contains("Cables Android"));
            String containerId = tables.getJSONArray("photos").getJSONObject(0).getString("ownerId");
            JSONArray containers = tables.getJSONArray("containers");
            for (int i = 0; i < containers.length(); i++) {
                JSONObject container = containers.getJSONObject(i);
                if (container.getString("id").equals(containerId)) container.put("name", "Android importado");
            }
            Files.write(backup.toPath(), data.toString().getBytes(StandardCharsets.UTF_8));
            intending(allOf(hasAction(Intent.ACTION_GET_CONTENT), hasType("application/json"))).respondWith(new ActivityResult(Activity.RESULT_OK, new Intent().setData(backupUri)));
            tap(scenario, "[...document.querySelectorAll('button')].find(b => /^(Importar|Import)$/.test(b.textContent.trim()))");
            await(scenario, "document.querySelector('[role=dialog]') && /Reemplazar e importar|Replace and import/.test(document.querySelector('[role=dialog]').textContent)");
            tap(scenario, "[...document.querySelectorAll('[role=dialog] button')].find(b => /Reemplazar e importar|Replace and import/.test(b.textContent))");
            await(scenario, "/Datos importados|Data imported/.test(document.body.innerText)");
            scenario.recreate();
            ready(scenario);
            scenario.onActivity(activity -> activity.getBridge().getWebView().loadUrl("https://localhost/inventario/ver?id=" + containerId));
            await(scenario, "document.body.innerText.includes('Android importado') && document.body.innerText.includes('Cables Android') && document.querySelector('.od-photo-tile img')?.naturalWidth === 32");
            screenshot("restored-container");
            System.out.println("ANDROID_WEBVIEW_CAPABILITIES " + evaluate(scenario, "({userAgent:navigator.userAgent,barcodeDetector:typeof window.BarcodeDetector,camera:!!navigator.mediaDevices?.getUserMedia})"));
        } finally {
            Intents.release();
            Files.deleteIfExists(photo.toPath());
            Files.deleteIfExists(backup.toPath());
        }
    }

    @Test
    public void offlineOnboardingAndReloadKeepTheHouse() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            scenario.onActivity(activity -> activity.getBridge().getWebView().loadUrl("https://localhost/empezar"));
            await(scenario, "location.pathname === '/empezar' && document.title.startsWith('Empezar')");
            await(scenario, "[...document.querySelectorAll('button')].some(b => /Empezar acá|Start here/.test(b.textContent))");
            await(scenario, "[...document.querySelectorAll('svg path[pathLength=\"1\"]')].every(p => parseFloat(getComputedStyle(p).strokeDasharray) >= 0.99)");
            screenshot("onboarding");
            tap(scenario, "[...document.querySelectorAll('button')].find(b => /Empezar acá|Start here/.test(b.textContent))");
            await(scenario, "/Who.s home|Quién está en casa/.test(document.body.innerText) && /Administrador|Administrator/.test(document.body.innerText)");
            scenario.recreate();
            ready(scenario);
            await(scenario, "/Administrador|Administrator/.test(document.body.innerText)");
            await(scenario, "(() => { let e=[...document.querySelectorAll('h5')].find(e => e.textContent === 'Administrador'); if (!e) return false; for (; e; e=e.parentElement) if (Number(getComputedStyle(e).opacity) < 0.99) return false; return true; })()");
            await(scenario, "[...document.querySelectorAll('svg path[pathLength=\"1\"]')].every(p => parseFloat(getComputedStyle(p).strokeDasharray) >= 0.99)");
            screenshot("persisted-house");
            scenario.onActivity(activity -> activity.getBridge().getWebView().loadUrl("https://localhost/cuenta?modo=crear"));
            await(scenario, "location.pathname === '/cuenta' && /Esta instalación funciona sin servidor|This installation works without a server/.test(document.body.innerText)");
            evaluate(scenario, "window.__swCount = -1; navigator.serviceWorker.getRegistrations().then(r => window.__swCount = r.length)");
            await(scenario, "window.__swCount === 0");
            verifySettingsRoundTrip(scenario);
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
