package com.bodyandiron.traininglog;

import android.content.res.AssetManager;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

final class AssetClient extends WebViewClient {

    private final AssetManager assets;

    AssetClient(AssetManager assets) {
        this.assets = assets;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
        Uri u = req.getUrl();
        if (u == null || !MainActivity.HOST.equals(u.getHost())) return null;

        String path = u.getPath();
        if (path == null || path.equals("/")) path = "/index.html";
        String asset = path.startsWith("/") ? path.substring(1) : path;
        if (asset.contains("..")) return notFound();

        try {
            InputStream in = assets.open(asset);
            Map<String, String> headers = new HashMap<String, String>();
            headers.put("Cache-Control", "no-store");
            return new WebResourceResponse(mimeOf(asset), encodingOf(asset), 200, "OK", headers, in);
        } catch (IOException e) {
            return notFound();
        }
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
        Uri u = req.getUrl();
        return u == null || !MainActivity.HOST.equals(u.getHost());
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
    }

    private static String mimeOf(String p) {
        if (p.endsWith(".html"))  return "text/html";
        if (p.endsWith(".css"))   return "text/css";
        if (p.endsWith(".js"))    return "application/javascript";
        if (p.endsWith(".json"))  return "application/json";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".ttf"))   return "font/ttf";
        if (p.endsWith(".svg"))   return "image/svg+xml";
        if (p.endsWith(".png"))   return "image/png";
        return "application/octet-stream";
    }

    private static String encodingOf(String p) {
        return (p.endsWith(".html") || p.endsWith(".css") || p.endsWith(".js") || p.endsWith(".json"))
                ? "utf-8" : null;
    }
}
