package com.bodyandiron.traininglog;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

public final class AlarmBridge {

    private static final int REQ = 8123;
    private final Activity act;

    AlarmBridge(Activity a) { this.act = a; }

    private PendingIntent pending(String label) {
        Intent i = new Intent(act, AlarmReceiver.class);
        i.setAction(AlarmReceiver.ACTION);
        i.putExtra(AlarmReceiver.EXTRA_LABEL, label == null ? "" : label);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(act, REQ, i, flags);
    }

    @JavascriptInterface
    public boolean schedule(long millis, String label) {
        if (millis < 0) return false;
        AlarmManager am = (AlarmManager) act.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return false;
        long at = System.currentTimeMillis() + millis;
        PendingIntent p = pending(label);
        try {
            boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
            if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
            return true;
        } catch (Exception e) {
            try { am.set(AlarmManager.RTC_WAKEUP, at, p); return true; }
            catch (Exception e2) { return false; }
        }
    }

    @JavascriptInterface
    public boolean exactAllowed() {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = (AlarmManager) act.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    @JavascriptInterface
    public boolean openExactSettings() {
        if (Build.VERSION.SDK_INT < 31) return false;
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:" + act.getPackageName()));
            act.startActivity(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public void cancel() {
        AlarmManager am = (AlarmManager) act.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try { am.cancel(pending("")); } catch (Exception e) { }
    }
}
