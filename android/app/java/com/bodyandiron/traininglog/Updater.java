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
    /**
     * What this app shell offers the page (its native bridges). A release's app-files bundle says which shell
     * it needs (tally-page-VERSION-shellN.jar); a newer shell means a full install. Kept equal to
     * android/app/shell-version (checked by build/check-shell.mjs).
     */
    static final int SHELL = 2;
    private static final java.util.regex.Pattern PAGE_ASSET = java.util.regex.Pattern.compile("^tally-page-[0-9.]+-shell([0-9]+)\\.jar$");

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

    /** What this shell offers; pages from before 9.8 do not ask. */
    @JavascriptInterface
    public int shell() { return SHELL; }

    /** The version of the app files running now (a downloaded bundle, or the app's own). */
    @JavascriptInterface
    public String running() { return PageStore.running(act); }

    /** The page started properly: keep the new app files (see PageStore). */
    @JavascriptInterface
    public void started() { PageStore.started(act); }

    /** Starts the page again from the newest app files. */
    @JavascriptInterface
    public void restart() { act.runOnUiThread(new Runnable() { public void run() { act.restartPage(); } }); }

    /** Downloads and checks a release's app-files bundle; it runs from the next start (or restart()). */
    @JavascriptInterface
    public boolean installPage(final String url) {
        if (busy || url == null || !url.startsWith(FROM) || !url.endsWith(".jar")) return false;
        busy = true;
        new Thread(new Runnable() { public void run() { try { doInstallPage(url); } finally { busy = false; } } }).start();
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
            String url = "", page = "";
            long size = 0;
            int pageShell = 0;
            JSONArray as = o.optJSONArray("assets");
            if (as != null) for (int i = 0; i < as.length(); i++) {
                JSONObject a = as.optJSONObject(i);
                if (a == null) continue;
                String name = a.optString("name", ""), dl = a.optString("browser_download_url", "");
                java.util.regex.Matcher m = PAGE_ASSET.matcher(name);
                if (name.endsWith(".apk") && url.isEmpty()) { url = dl; size = a.optLong("size", 0); }
                else if (m.matches() && page.isEmpty()) { page = dl; pageShell = Integer.parseInt(m.group(1)); }
            }
            r.put("ok", true);
            r.put("version", tag.startsWith("v") ? tag.substring(1) : tag);
            r.put("url", url.startsWith(FROM) ? url : "");
            r.put("size", size);
            if (page.startsWith(FROM)) { r.put("page", page); r.put("pageShell", pageShell); }
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

    private void doInstallPage(String url) {
        File jar = new File(new File(act.getCacheDir(), "update"), "page.jar");
        jar.getParentFile().mkdirs();
        try {
            HttpURLConnection c = open(url, "application/octet-stream");
            if (c.getResponseCode() != 200) { fail("net"); return; }
            long total = c.getContentLengthLong();
            InputStream in = c.getInputStream();
            OutputStream out = new FileOutputStream(jar);
            byte[] b = new byte[65536];
            long got = 0;
            int last = -1, n;
            try {
                while ((n = in.read(b)) > 0) {
                    out.write(b, 0, n);
                    got += n;
                    if (got > PageCheck.MAX_TOTAL) { fail("verify"); return; }
                    int pct = total > 0 ? (int) (got * 100 / total) : -1;
                    if (pct >= 0 && pct / 10 != last) { last = pct / 10; progress(pct); }
                }
            } finally { out.close(); in.close(); }
        } catch (Exception e) { jar.delete(); fail("net"); return; }
        try {
            byte[] cert = null;
            PackageInfo mine = act.getPackageManager().getPackageInfo(act.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
            if (mine.signingInfo != null && mine.signingInfo.getApkContentsSigners().length > 0) cert = mine.signingInfo.getApkContentsSigners()[0].toByteArray();
            String running = PageStore.running(act);
            String version;
            try {
                PageStore.root(act).mkdirs();
                // the version is only known once page.json is read: check and unpack into "incoming", then rename
                File tmpOut = new File(PageStore.root(act), "incoming");
                PageCheck.deleteTree(tmpOut);
                version = PageCheck.unpack(jar, cert, SHELL, running, tmpOut);
                if (PageStore.isBad(act, version)) { PageCheck.deleteTree(tmpOut); fail("bad"); return; }
                File dest = new File(PageStore.root(act), version);
                PageCheck.deleteTree(dest);
                if (!tmpOut.renameTo(dest)) { PageCheck.deleteTree(tmpOut); fail("install"); return; }
            } catch (PageCheck.Refused r) {
                String why = r.getMessage();
                fail("notnewer".equals(why) ? "notnewer" : "shell".equals(why) ? "shell" : "verify");
                return;
            }
            PageStore.activate(act, version);
            JSONObject r = new JSONObject();
            r.put("type", "pageReady");
            r.put("version", version);
            MainActivity.event(r.toString());
        } catch (Exception e) { fail("install"); }
        finally { jar.delete(); }
    }

    private static boolean sameSigners(Signature[] a, Signature[] b) {
        if (a.length != b.length) return false;
        for (int i = 0; i < a.length; i++) if (!Arrays.equals(a[i].toByteArray(), b[i].toByteArray())) return false;
        return true;
    }
}
