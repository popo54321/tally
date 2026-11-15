package com.bodyandiron.traininglog;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Lets Android's installer read the one downloaded update (cache/update/tally.apk), and nothing else. Not exported:
 * the installer gets read access to this single file only through the permission Updater grants with its intent.
 */
public final class UpdateFiles extends ContentProvider {

    static final String NAME = "tally.apk";
    static final String TYPE = "application/vnd.android.package-archive";

    static String authority(android.content.Context c) { return c.getPackageName() + ".updates"; }
    static Uri uri(android.content.Context c) { return Uri.parse("content://" + authority(c) + "/" + NAME); }
    static File file(android.content.Context c) { File d = new File(c.getCacheDir(), "update"); d.mkdirs(); return new File(d, NAME); }

    private File only(Uri u) throws FileNotFoundException {
        if (u == null || !("/" + NAME).equals(u.getPath())) throw new FileNotFoundException();
        File f = file(getContext());
        if (!f.isFile()) throw new FileNotFoundException();
        return f;
    }

    @Override public boolean onCreate() { return true; }

    @Override
    public ParcelFileDescriptor openFile(Uri u, String mode) throws FileNotFoundException {
        if (mode != null && mode.contains("w")) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(only(u), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public String getType(Uri u) { return TYPE; }

    @Override
    public Cursor query(Uri u, String[] projection, String sel, String[] args, String sort) {
        try {
            File f = only(u);
            MatrixCursor c = new MatrixCursor(new String[]{ OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE });
            c.addRow(new Object[]{ NAME, f.length() });
            return c;
        } catch (FileNotFoundException e) { return null; }
    }

    @Override public Uri insert(Uri u, ContentValues v) { return null; }
    @Override public int delete(Uri u, String s, String[] a) { return 0; }
    @Override public int update(Uri u, ContentValues v, String s, String[] a) { return 0; }
}
