package io.github.juanjpeople.opendomus;

import static androidx.test.espresso.intent.Intents.intended;
import static androidx.test.espresso.intent.Intents.intending;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasType;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasExtra;
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
import org.junit.Rule;
import org.junit.rules.Timeout;
import org.junit.runner.RunWith;
import org.json.JSONArray;
import org.json.JSONObject;

@RunWith(AndroidJUnit4.class)
public class NativeFlowTest {
    @Rule public final Timeout testTimeout = Timeout.seconds(180);

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
        evaluate(scenario, "window.__tapTarget = " + element + "; window.__tapTarget.scrollIntoView({block:'center',behavior:'instant'})");
        try {
            await(scenario, "(() => { let e=window.__tapTarget; if (!e?.isConnected || e.disabled) return false; for (; e; e=e.parentElement) if (Number(getComputedStyle(e).opacity) < 0.99 || e.getAnimations().some(a => a.playState === 'running')) return false; return true; })()");
        } catch (AssertionError error) {
            // Dice por qué el elemento no se estabiliza: la página se recargó, se reemplazó el nodo o algo sigue animándose.
            String why = evaluate(scenario, "(() => { let e=window.__tapTarget; if (!e) return 'sin __tapTarget: la pagina se recargo'; if (!e.isConnected) return 'el nodo ya no esta en el documento'; if (e.disabled) return 'deshabilitado'; for (; e; e=e.parentElement) { const op=Number(getComputedStyle(e).opacity); const run=e.getAnimations().filter(a => a.playState === 'running'); if (op < 0.99 || run.length) return e.tagName + '.' + String(e.className).slice(0, 60) + ' opacity=' + op + ' animaciones=' + run.map(a => a.constructor.name + ':' + (a.animationName || a.transitionProperty || '')).join(','); } return 'estable'; })()");
            throw new AssertionError(error.getMessage() + "; por que: " + why, error);
        }
        evaluate(scenario, "window.__tap = null; (() => { let previous=null, stable=0; const sample=()=>{const e=window.__tapTarget;if(!e?.isConnected)return;const r=e.getBoundingClientRect(),p={x:r.x+r.width/2,y:r.y+r.height/2};const hit=document.elementFromPoint(p.x,p.y);const valid=hit && (hit===e || e.contains(hit));stable=valid && previous && Math.abs(p.x-previous.x)<0.5 && Math.abs(p.y-previous.y)<0.5?stable+1:0;previous=p;if(stable>=8){window.__tap=p;return;}requestAnimationFrame(sample)};requestAnimationFrame(sample)})()");
        await(scenario, "window.__tap !== null");
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
        System.out.println("ANDROID_TEST_TAP css=" + point + " screen=" + screen[0] + "," + screen[1]);
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
            // Se entra por la tarjeta del recinto y después por su mueble, como lo haría una persona.
            await(scenario, "[...document.querySelectorAll('a[href^=\"/inventario/lugar\"]')].some(e => /Taller de herramientas|Tool workshop/.test(e.textContent))");
            tap(scenario, "[...document.querySelectorAll('a[href^=\"/inventario/lugar\"]')].find(e => /Taller de herramientas|Tool workshop/.test(e.textContent))");
            await(scenario, "location.pathname === '/inventario/lugar' && [...document.querySelectorAll('a[href^=\"/inventario/ver\"]')].some(e => /Estantería de herramientas|Tool shelf/.test(e.textContent))");
            tap(scenario, "[...document.querySelectorAll('a[href^=\"/inventario/ver\"]')].find(e => /Estantería de herramientas|Tool shelf/.test(e.textContent))");
            // El campo para anotar se abre con un botón: "Nueva anotación" lo abre y "Anotar" guarda.
            await(scenario, "location.pathname === '/inventario/ver' && [...document.querySelectorAll('button')].some(b => /^(Nueva anotación|New note)$/.test(b.textContent.trim()))");
            tap(scenario, "[...document.querySelectorAll('button')].find(b => /^(Nueva anotación|New note)$/.test(b.textContent.trim()))");
            await(scenario, "document.querySelector('input[aria-label=\"Stored contents\"],input[aria-label=\"Contenido guardado\"]')");
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
            String previousCode = null;
            for (int i = 0; i < containers.length(); i++) {
                JSONObject container = containers.getJSONObject(i);
                if (container.getString("id").equals(containerId)) previousCode = container.getString("code");
            }
            assertNotNull(previousCode);
            for (int i = 0; i < containers.length(); i++) {
                JSONObject container = containers.getJSONObject(i);
                if (container.getString("id").equals(containerId)) {
                    container.put("name", "Android importado");
                    container.put("code", "K7QM");
                } else if (container.getString("code").equals("K7QM")) {
                    container.put("code", previousCode);
                }
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
            // The initial house is now explicit: create the shelf used by the backup and QR round trips.
            await(scenario, "[...document.querySelectorAll('button')].some(b => /Guardar esta selección|Save this selection/.test(b.textContent))");
            tap(scenario, "[...document.querySelectorAll('[role=checkbox]')].find(e => /^(Taller de herramientas|Tool workshop)$/.test(e.textContent.trim()))");
            tap(scenario, "[...document.querySelectorAll('[role=checkbox]')].find(e => /^(Estantería de herramientas|Tool shelf)$/.test(e.textContent.trim()))");
            tap(scenario, "[...document.querySelectorAll('button')].find(b => /Guardar esta selección|Save this selection/.test(b.textContent))");
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
            verifyOfflineQrThroughScanner(scenario);
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
    public void cameraStreamStartsAndStopsWithRuntimePermission() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        InstrumentationRegistry.getInstrumentation().getUiAutomation()
            .grantRuntimePermission(context.getPackageName(), android.Manifest.permission.CAMERA);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            evaluate(scenario, "window.__cameraResult=null;(async()=>{let stream,video;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});video=document.createElement('video');video.muted=true;video.playsInline=true;document.body.append(video);video.srcObject=stream;await video.play();const track=stream.getVideoTracks()[0];const live=track.readyState==='live'&&video.videoWidth>0;stream.getTracks().forEach(t=>t.stop());window.__cameraResult={live,ended:track.readyState==='ended'};}catch(e){window.__cameraResult={error:e.name};}finally{stream?.getTracks().forEach(t=>t.stop());video?.remove();}})()");
            await(scenario, "window.__cameraResult !== null");
            assertEquals("true", evaluate(scenario, "window.__cameraResult.live && window.__cameraResult.ended"));
        }
    }

    private void verifyOfflineQrThroughScanner(ActivityScenario<MainActivity> scenario) throws Exception {
        byte[] fixture;
        try (java.io.InputStream input = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("offline-qr.png")) {
            fixture = input.readAllBytes();
        }
        String dataUrl = "data:image/png;base64," + android.util.Base64.encodeToString(fixture, android.util.Base64.NO_WRAP);
        scenario.onActivity(activity -> activity.getBridge().getWebView().loadUrl("https://localhost/inventario/escanear"));
        await(scenario, "location.pathname === '/inventario/escanear' && [...document.querySelectorAll('button')].some(b=>/Activar cámara|Turn on camera/.test(b.textContent))");
        // A synthetic camera stream tests the actual shared decoder and route, not a mocked decode result.
        evaluate(scenario, "Object.defineProperty(window,'BarcodeDetector',{value:undefined,configurable:true});navigator.mediaDevices.getUserMedia=async()=>{const image=new Image();image.src=" + JSONObject.quote(dataUrl) + ";await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=320;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const stream=canvas.captureStream(10);window.__qrStream=stream;sessionStorage.removeItem('qrTestStopped');for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{stop();sessionStorage.setItem('qrTestStopped',String(stream.getTracks().every(t=>t.readyState==='ended')))}}window.__qrTimer=setInterval(()=>ctx.drawImage(image,0,0),100);return stream}");
        try {
            tap(scenario, "[...document.querySelectorAll('button')].find(b=>/Activar cámara|Turn on camera/.test(b.textContent))");
            await(scenario, "location.pathname === '/inventario/ver' && document.body.innerText.includes('Android importado') && document.body.innerText.includes('Cables Android') && document.querySelector('.od-photo-tile img')?.naturalWidth === 32");
            await(scenario, "sessionStorage.getItem('qrTestStopped') === 'true'");
            screenshot("qr-decoded-offline");
        } finally {
            evaluate(scenario, "clearInterval(window.__qrTimer);window.__qrStream?.getTracks().forEach(t=>t.stop())");
        }
    }

    @Test
    public void failedBackupRejectsWithoutSecretsAndAllowsRetry() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        File destination = new File(context.getExternalFilesDir(Environment.DIRECTORY_PICTURES), "retry-test.json");
        Uri valid = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", destination);
        Uri missing = Uri.parse("content://io.github.juanjpeople.opendomus.missing/private-destination");
        Intents.init();
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            intending(allOf(hasAction(Intent.ACTION_CREATE_DOCUMENT), hasExtra(Intent.EXTRA_TITLE, "failed.json")))
                .respondWith(new ActivityResult(Activity.RESULT_OK, new Intent().setData(missing)));
            intending(allOf(hasAction(Intent.ACTION_CREATE_DOCUMENT), hasExtra(Intent.EXTRA_TITLE, "retry.json")))
                .respondWith(new ActivityResult(Activity.RESULT_OK, new Intent().setData(valid)));
            evaluate(scenario, "window.__failed=null;window.Capacitor.nativePromise('Backup','save',{filename:'failed.json',data:'private-fixture'}).then(()=>window.__failed='unexpected-success').catch(e=>window.__failed=e.message)");
            await(scenario, "window.__failed === 'Could not save the backup'");
            assertFalse(destination.exists());
            evaluate(scenario, "window.__retried=null;window.Capacitor.nativePromise('Backup','save',{filename:'retry.json',data:'{}'}).then(r=>window.__retried=r.saved).catch(e=>window.__retried=e.message)");
            await(scenario, "window.__retried === true");
            assertEquals("{}", new String(Files.readAllBytes(destination.toPath()), StandardCharsets.UTF_8));
            intended(allOf(hasAction(Intent.ACTION_CREATE_DOCUMENT), hasExtra(Intent.EXTRA_TITLE, "failed.json")));
            intended(allOf(hasAction(Intent.ACTION_CREATE_DOCUMENT), hasExtra(Intent.EXTRA_TITLE, "retry.json")));
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
