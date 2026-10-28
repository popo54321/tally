package com.bodyandiron.traininglog;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;

public class MainActivity extends Activity {

    static final String HOST  = "traininglog.local";
    static final String START = "https://" + HOST + "/index.html";
    private static final int REQ_PICK = 4711;
    private static final int REQ_NOTIF = 4712;

    static volatile boolean inForeground = false;

    private WebView web;
    private ValueCallback<Uri[]> pendingPick;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(true);

        web.setWebViewClient(new AssetClient(getAssets()));
        web.setWebChromeClient(new FileChooserClient(this));
        web.addJavascriptInterface(new FileSaver(this), "AndroidFile");
        web.addJavascriptInterface(new AlarmBridge(this), "AndroidAlarm");

        setContentView(web, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        if (state == null || web.restoreState(state) == null) web.loadUrl(START);

        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                   != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{ "android.permission.POST_NOTIFICATIONS" }, REQ_NOTIF);
        }
    }

    @Override
    protected void onResume() { super.onResume(); inForeground = true; }

    @Override
    protected void onPause() { inForeground = false; super.onPause(); }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.getRepeatCount() == 0) {
                web.evaluateJavascript("(window.tallyBack && window.tallyBack()) === true", new BackResult(this));
            }
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    boolean startPick(ValueCallback<Uri[]> cb) {
        if (pendingPick != null) pendingPick.onReceiveValue(null);
        pendingPick = cb;
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        try {
            startActivityForResult(i, REQ_PICK);
            return true;
        } catch (Exception e) {
            pendingPick = null;
            return false;
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_PICK || pendingPick == null) return;
        Uri[] out = null;
        if (res == RESULT_OK && data != null && data.getData() != null) {
            out = new Uri[]{ data.getData() };
        }
        pendingPick.onReceiveValue(out);
        pendingPick = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }
}
