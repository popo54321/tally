package com.bodyandiron.traininglog;

import android.content.Context;
import android.content.SharedPreferences;

import java.io.File;

/**
 * Which app files run: the ones built into the app, or a newer downloaded bundle (see PageCheck, Updater).
 * A new bundle is tried at the next start; if it fails to report back twice, Tally goes back to the built-in
 * files and never tries that version again.
 */
final class PageStore {

    private static final String PREFS = "pages", ACTIVE = "active", TRYING = "trying", TRIES = "tries", BAD = "bad";
    /** The folder the running app files come from, or null for the built-in ones. Read by AssetClient. */
    static volatile File current = null;

    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    static File root(Context c) { return new File(c.getFilesDir(), "page"); }

    static String builtIn(Context c) {
        try { return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
    }

    /** At start-up: pick which files run. */
    static void atStart(Context c) {
        SharedPreferences p = prefs(c);
        String v = p.getString(ACTIVE, null);
        current = null;
        if (v == null) { cleanUp(c, null); return; }
        File dir = new File(root(c), v);
        // a newer app installed since (its own files are at least as new), or the folder is gone: use the built-in files
        if (!PageCheck.newer(v, builtIn(c)) || !new File(dir, "index.html").isFile()) { drop(c); return; }
        if (v.equals(p.getString(TRYING, null))) {
            int tries = p.getInt(TRIES, 0) + 1;
            if (tries > 2) { p.edit().putString(BAD, v).apply(); drop(c); return; }   // started twice without saying it was fine
            p.edit().putInt(TRIES, tries).apply();
        }
        current = dir;
        cleanUp(c, v);
    }

    /** The page started properly: keep it. */
    static void started(Context c) {
        SharedPreferences p = prefs(c);
        if (p.getString(TRYING, null) != null) p.edit().remove(TRYING).remove(TRIES).apply();
    }

    /** A bundle was unpacked into root/version: run it from the next start (or a restart). */
    static void activate(Context c, String version) {
        prefs(c).edit().putString(ACTIVE, version).putString(TRYING, version).putInt(TRIES, 0).apply();
    }

    static boolean isBad(Context c, String version) { return version != null && version.equals(prefs(c).getString(BAD, null)); }

    /** The version of the running app files: the downloaded one, or the app's own. */
    static String running(Context c) {
        File d = current;
        return d != null ? d.getName() : builtIn(c);
    }

    private static void drop(Context c) {
        prefs(c).edit().remove(ACTIVE).remove(TRYING).remove(TRIES).apply();
        current = null;
        cleanUp(c, null);
    }

    /** Removes downloaded folders other than keep. */
    private static void cleanUp(Context c, String keep) {
        File[] kids = root(c).listFiles();
        if (kids == null) return;
        for (File k : kids) if (keep == null || !k.getName().equals(keep)) PageCheck.deleteTree(k);
    }
}
