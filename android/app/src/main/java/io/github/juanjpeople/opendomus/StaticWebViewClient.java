package io.github.juanjpeople.opendomus;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

/** Next exports one HTML per route; Capacitor's default fallback always serves the home HTML. */
final class StaticWebViewClient extends BridgeWebViewClient {
    private final Bridge bridge;

    StaticWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        String path = url.getPath();
        if (request.isForMainFrame() && "GET".equals(request.getMethod()) &&
            "https".equals(url.getScheme()) && "localhost".equals(url.getHost()) && url.getPort() == -1 &&
            path != null && path.matches("/(?:[a-zA-Z0-9_-]+/?)*") && !"/".equals(path)) {
            String html = path.replaceAll("/+$", "") + ".html";
            try (InputStream ignored = bridge.getContext().getAssets().open("public" + html)) {
                // Packaged assets are immutable. Only known static routes receive their own HTML.
            } catch (IOException missing) {
                html = "/404.html";
            }
            Uri destination = url.buildUpon().path(html).build();
            return super.shouldInterceptRequest(view, new WebResourceRequest() {
                public Uri getUrl() { return destination; }
                public boolean isForMainFrame() { return request.isForMainFrame(); }
                public boolean isRedirect() { return request.isRedirect(); }
                public boolean hasGesture() { return request.hasGesture(); }
                public String getMethod() { return request.getMethod(); }
                public Map<String, String> getRequestHeaders() { return request.getRequestHeaders(); }
            });
        }
        return super.shouldInterceptRequest(view, request);
    }
}
