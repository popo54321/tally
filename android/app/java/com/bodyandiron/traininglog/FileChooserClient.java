package com.bodyandiron.traininglog;

import android.net.Uri;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

public final class FileChooserClient extends WebChromeClient {

    private final MainActivity host;

    FileChooserClient(MainActivity host) {
        this.host = host;
    }

    @Override
    public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
        return host.startPick(cb);
    }
}
