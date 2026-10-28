package com.bodyandiron.traininglog;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;

import java.io.OutputStream;

public final class FileSaver {

    private final Context ctx;

    FileSaver(Context ctx) {
        this.ctx = ctx;
    }

    @JavascriptInterface
    public String save(String name, String text) {
        if (name == null || text == null) return "";
        try {
            ContentResolver cr = ctx.getContentResolver();
            ContentValues v = new ContentValues();
            v.put(MediaStore.Downloads.DISPLAY_NAME, name);
            v.put(MediaStore.Downloads.MIME_TYPE, "application/json");
            v.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) return "";

            OutputStream out = cr.openOutputStream(uri);
            if (out == null) return "";
            out.write(text.getBytes("UTF-8"));
            out.flush();
            out.close();

            v.clear();
            v.put(MediaStore.Downloads.IS_PENDING, 0);
            cr.update(uri, v, null, null);
            return name;
        } catch (Exception e) {
            return "";
        }
    }
}
