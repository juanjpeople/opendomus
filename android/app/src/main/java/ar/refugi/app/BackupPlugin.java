package ar.refugi.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Writes only to a destination explicitly selected by the user. No storage permission or cache copy. */
@CapacitorPlugin(name = "Backup")
public class BackupPlugin extends Plugin {
    private volatile boolean pending;

    @PluginMethod
    public void save(PluginCall call) {
        String filename = call.getString("filename");
        if (filename == null || !filename.matches("[a-zA-Z0-9_-]+\\.json") || call.getString("data") == null) {
            call.reject("Invalid backup");
            return;
        }
        if (pending) {
            call.reject("A backup is already being saved");
            return;
        }
        pending = true;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        try {
            startActivityForResult(call, intent, "destinationSelected");
        } catch (RuntimeException error) {
            pending = false;
            call.reject("Could not open the document picker");
        }
    }

    @ActivityCallback
    private void destinationSelected(PluginCall call, ActivityResult result) {
        if (call == null) {
            pending = false;
            return;
        }
        if (result.getResultCode() != Activity.RESULT_OK) {
            pending = false;
            call.resolve(new JSObject().put("saved", false));
            return;
        }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (uri == null || !"content".equals(uri.getScheme())) {
            pending = false;
            call.reject("Invalid document destination");
            return;
        }
        getBridge().execute(() -> {
            try {
                String data = call.getString("data");
                if (data == null) throw new IllegalStateException("Missing backup");
                try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "w")) {
                    if (stream == null) throw new IllegalStateException("Missing output stream");
                    stream.write(data.getBytes(StandardCharsets.UTF_8));
                }
                call.resolve(new JSObject().put("saved", true));
            } catch (Exception error) {
                // Do not expose the content or provider URI through logs or error messages.
                call.reject("Could not save the backup");
            } finally {
                pending = false;
            }
        });
    }
}
