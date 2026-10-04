package io.github.juanjpeople.opendomus;

import static org.junit.Assert.*;

import android.content.Context;
import android.os.SystemClock;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Second phase only: scripts/test-android.sh installs version 2 over the populated version 1. */
@RunWith(AndroidJUnit4.class)
public class UpgradeFlowTest {
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
        fail("Upgrade did not preserve the expected state: " + condition);
    }

    @Test
    public void installedUpdatePreservesSessionContainerAndPhoto() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        assertEquals(2, context.getPackageManager().getPackageInfo(context.getPackageName(), 0).getLongVersionCode());
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            await(scenario, "window.Capacitor && JSON.parse(localStorage.getItem('opendomus-session') || '{}').state?.currentProfileId");
            scenario.onActivity(activity -> activity.getBridge().getWebView().loadUrl("https://localhost/inventario"));
            await(scenario, "document.body.innerText.includes('Android importado')");
            evaluate(scenario, "[...document.querySelectorAll('span,h3,h4,h5')].find(e => e.textContent === 'Android importado').click()");
            await(scenario, "location.pathname === '/inventario/ver' && document.body.innerText.includes('Cables Android') && document.querySelector('.od-photo-tile img')?.naturalWidth === 32");
        }
    }
}
