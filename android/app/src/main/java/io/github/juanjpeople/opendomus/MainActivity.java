package io.github.juanjpeople.opendomus;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackupPlugin.class);
        super.onCreate(savedInstanceState);
        getBridge().setWebViewClient(new StaticWebViewClient(getBridge()));
    }
}
