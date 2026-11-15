package com.bodyandiron.traininglog;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.cert.Certificate;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Checks a downloaded app-files bundle (a signed .jar holding index.html, fonts and page.json) and unpacks it.
 * Every file must be signed with the same certificate as the installed app, so only whoever holds the app's
 * signing key can change what runs in it. Plain Java (no Android classes), so it is tested on a computer too.
 */
public final class PageCheck {

    static final long MAX_TOTAL = 20L * 1024 * 1024;
    private static final Pattern VERSION = Pattern.compile("\"version\"\\s*:\\s*\"([0-9]+(?:\\.[0-9]+){1,3})\"");
    private static final Pattern SHELL = Pattern.compile("\"shell\"\\s*:\\s*([0-9]+)");

    /** Why a bundle was refused. */
    public static final class Refused extends Exception { Refused(String why) { super(why); } }

    /**
     * Verifies the bundle and unpacks it into outDir (which must not exist yet). Returns its version.
     * cert: the installed app's signing certificate (DER). shell: what this app shell supports.
     * current: the version running now; the bundle must be newer.
     */
    public static String unpack(File jar, byte[] cert, int shell, String current, File outDir) throws Refused, IOException {
        if (outDir.exists()) throw new Refused("exists");
        String version = null;
        int needs = -1;
        long total = 0;
        boolean page = false;
        JarFile jf = new JarFile(jar, true);
        try {
            // 1. read every entry fully (that is what checks it) and require our signature on each file
            byte[] buf = new byte[65536];
            Enumeration<JarEntry> en = jf.entries();
            while (en.hasMoreElements()) {
                JarEntry e = en.nextElement();
                String n = e.getName();
                if (e.isDirectory() || n.startsWith("META-INF/")) continue;
                if (!safe(n)) throw new Refused("path");
                ByteArrayOutputStream mem = n.equals("page.json") ? new ByteArrayOutputStream() : null;
                InputStream in = jf.getInputStream(e);
                try {
                    int k;
                    while ((k = in.read(buf)) > 0) {
                        total += k;
                        if (total > MAX_TOTAL) throw new Refused("size");
                        if (mem != null) mem.write(buf, 0, k);
                    }
                } finally { in.close(); }
                if (!signedBy(e.getCertificates(), cert)) throw new Refused("signature");
                if (n.equals("index.html")) page = true;
                if (mem != null) {
                    String json = mem.toString("UTF-8");
                    Matcher v = VERSION.matcher(json), s = SHELL.matcher(json);
                    if (!v.find() || !s.find()) throw new Refused("manifest");
                    version = v.group(1);
                    needs = Integer.parseInt(s.group(1));
                }
            }
            if (!page || version == null) throw new Refused("incomplete");
            if (needs > shell) throw new Refused("shell");
            if (!newer(version, current)) throw new Refused("notnewer");

            // 2. unpack into a fresh folder
            File tmp = new File(outDir.getPath() + ".part");
            deleteTree(tmp);
            if (!tmp.mkdirs()) throw new IOException("mkdir");
            en = jf.entries();
            while (en.hasMoreElements()) {
                JarEntry e = en.nextElement();
                String n = e.getName();
                if (e.isDirectory() || n.startsWith("META-INF/")) continue;
                File f = new File(tmp, n);
                File parent = f.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) throw new IOException("mkdir");
                InputStream in = jf.getInputStream(e);
                OutputStream out = new FileOutputStream(f);
                try { int k; while ((k = in.read(buf)) > 0) out.write(buf, 0, k); }
                finally { out.close(); in.close(); }
            }
            if (!tmp.renameTo(outDir)) { deleteTree(tmp); throw new IOException("rename"); }
            return version;
        } catch (SecurityException e) {
            throw new Refused("signature");   // a file that does not match its signature
        } finally {
            jf.close();
        }
    }

    /** No absolute paths, no "..", only plain names: the bundle cannot write outside its folder. */
    static boolean safe(String n) {
        if (n.isEmpty() || n.startsWith("/") || n.contains("\\") || n.contains(":")) return false;
        for (String part : n.split("/")) if (part.isEmpty() || part.equals(".") || part.equals("..")) return false;
        return true;
    }

    static boolean signedBy(Certificate[] cs, byte[] cert) {
        if (cs == null || cert == null) return false;
        for (Certificate c : cs) {
            try { if (Arrays.equals(c.getEncoded(), cert)) return true; } catch (Exception e) { }
        }
        return false;
    }

    /** True when version a is newer than b ("9.10" is newer than "9.9"). */
    static boolean newer(String a, String b) {
        if (a == null) return false;
        if (b == null || b.isEmpty()) return true;
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p, q;
            try { p = i < x.length ? Integer.parseInt(x[i]) : 0; q = i < y.length ? Integer.parseInt(y[i]) : 0; }
            catch (NumberFormatException e) { return false; }
            if (p != q) return p > q;
        }
        return false;
    }

    static void deleteTree(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteTree(k);
        f.delete();
    }
}
