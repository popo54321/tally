package com.bodyandiron.traininglog;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;

/**
 * Checks GitHub for a newer Tally and installs it. The only part of the app that goes online: one request
 * for the latest release's details, then the .apk itself. Nothing about the user or their data is sent.
 * The page itself cannot reach the internet (its security policy and AssetClient block it).
 * Results go back to the page as window.tallyUpdateEvent({type: ...}). Installing uses Android's standard install
 * screen (ACTION_INSTALL_PACKAGE), which works on every phone; one tap on Update there per update.
 */
public final class Updater {

    static final String LATEST = "https://api.github.com/repos/popo54321/tally/releases/latest";
    static final String FROM = "https://github.com/popo54321/tally/releases/download/";
    private static final long MAX_APK = 100L * 1024 * 1024;

    private final MainActivity act;
    private volatile boolean busy = false;

    Updater(MainActivity a) {
        act = a;
        File old = apkFile();
        if (old.exists()) old.delete();   // left over from an earlier update
    }

    private File apkFile() { return UpdateFiles.file(act); }

    /** The installed version name, e.g. "9.7". */
    @JavascriptInterface
    public String current() {
        try { return act.getPackageManager().getPackageInfo(act.getPackageName(), 0).versionName; }
        catch (Exception e) { return ""; }
    }

    @JavascriptInterface
    public boolean check() {
        if (busy) return false;
        busy = true;
        new Thread(new Runnable() { public void run() { try { doCheck(); } finally { busy = false; } } }).start();
        return true;
    }

    /** Whether Android lets Tally install apps (the one-time "Install unknown apps" setting). */
    @JavascriptInterface
    public boolean canInstall() {
        try { return act.getPackageManager().canRequestPackageInstalls(); } catch (Exception e) { return false; }
    }

    @JavascriptInterface
    public void allowInstalls() {
        try {
            act.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + act.getPackageName())));
        } catch (Exception e) { }
    }

    @JavascriptInterface
    public boolean install(final String url) {
        if (busy || url == null || !url.startsWith(FROM) || !url.endsWith(".apk")) return false;
        busy = true;
        new Thread(new Runnable() { public void run() { try { doInstall(url); } finally { busy = false; } } }).start();
        return true;
    }

    // ---- work, off the main thread ----

    private static HttpURLConnection open(String u, String accept) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("User-Agent", "Tally-Android");
        c.setRequestProperty("Accept", accept);
        return c;
    }

    private void doCheck() {
        JSONObject r = new JSONObject();
        try {
            r.put("type", "check");
            HttpURLConnection c = open(LATEST, "application/vnd.github+json");
            int code = c.getResponseCode();
            if (code != 200) throw new IOException("http " + code);
            InputStream in = c.getInputStream();
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] b = new byte[8192];
            int n;
            while ((n = in.read(b)) > 0) { buf.write(b, 0, n); if (buf.size() > 1024 * 1024) throw new IOException("too big"); }
            in.close();
            JSONObject o = new JSONObject(buf.toString("UTF-8"));
            String tag = o.optString("tag_name", "");
            String url = "";
            long size = 0;
            JSONArray as = o.optJSONArray("assets");
            if (as != null) for (int i = 0; i < as.length(); i++) {
                JSONObject a = as.optJSONObject(i);
                if (a != null && a.optString("name", "").endsWith(".apk")) {
                    url = a.optString("browser_download_url", "");
                    size = a.optLong("size", 0);
                    break;
                }
            }
            r.put("ok", true);
            r.put("version", tag.startsWith("v") ? tag.substring(1) : tag);
            r.put("url", url.startsWith(FROM) ? url : "");
            r.put("size", size);
        } catch (Exception e) {
            try { r.put("ok", false); r.put("why", (e instanceof IOException) ? "net" : "other"); } catch (Exception e2) { }
        }
        MainActivity.event(r.toString());
    }

    private void fail(String why) {
        try { JSONObject r = new JSONObject(); r.put("type", "error"); r.put("why", why); MainActivity.event(r.toString()); }
        catch (Exception e) { }
    }

    private void progress(int pct) {
        try { JSONObject r = new JSONObject(); r.put("type", "progress"); r.put("pct", pct); MainActivity.event(r.toString()); }
        catch (Exception e) { }
    }

    private void doInstall(String url) {
        File f = apkFile();
        // 1. download
        try {
            HttpURLConnection c = open(url, "application/octet-stream");
            int code = c.getResponseCode();
            if (code != 200) { fail("net"); return; }
            long total = c.getContentLengthLong();
            InputStream in = c.getInputStream();
            OutputStream out = new FileOutputStream(f);
            byte[] b = new byte[65536];
            long got = 0;
            int last = -1, n;
            try {
                while ((n = in.read(b)) > 0) {
                    out.write(b, 0, n);
                    got += n;
                    if (got > MAX_APK) { fail("verify"); return; }
                    int pct = total > 0 ? (int) (got * 100 / total) : -1;
                    if (pct >= 0 && pct / 5 != last) { last = pct / 5; progress(pct); }
                }
            } finally { out.close(); in.close(); }
        } catch (Exception e) { f.delete(); fail("net"); return; }

        // 2. make sure it is Tally, newer, and signed with the same key (Android checks the key again when installing)
        try {
            PackageManager pm = act.getPackageManager();
            String pkg = act.getPackageName();
            int flags = PackageManager.GET_SIGNING_CERTIFICATES;
            PackageInfo mine = pm.getPackageInfo(pkg, flags);
            PackageInfo apk = pm.getPackageArchiveInfo(f.getPath(), flags);
            if (apk == null || !pkg.equals(apk.packageName)) { f.delete(); fail("verify"); return; }
            if (apk.getLongVersionCode() <= mine.getLongVersionCode()) { f.delete(); fail("notnewer"); return; }
            Signature[] a = mine.signingInfo != null ? mine.signingInfo.getApkContentsSigners() : null;
            Signature[] s = apk.signingInfo != null ? apk.signingInfo.getApkContentsSigners() : null;
            if (a != null && s != null && !sameSigners(a, s)) { f.delete(); fail("verify"); return; }
        } catch (Exception e) { f.delete(); fail("verify"); return; }

        if (!canInstall()) { fail("allow"); return; }

        // 3. hand it to Android's own install screen (the same one as opening an .apk). The installer reads the file
        //    through UpdateFiles; MainActivity hears back if it is cancelled or fails.
        try {
            JSONObject r = new JSONObject();
            r.put("type", "installing");
            MainActivity.event(r.toString());
        } catch (Exception e) { }
        act.runOnUiThread(new Runnable() { public void run() { act.openInstaller(); } });
    }

    private static boolean sameSigners(Signature[] a, Signature[] b) {
        if (a.length != b.length) return false;
        for (int i = 0; i < a.length; i++) if (!Arrays.equals(a[i].toByteArray(), b[i].toByteArray())) return false;
        return true;
    }
}
