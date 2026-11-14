package com.bodyandiron.traininglog;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

import org.json.JSONObject;

/**
 * Hears back from Android's installer while an update is installed: asks the user to confirm when Android
 * wants that, reports a failure to the page, and once Tally has been replaced, posts a notification to open it
 * again (Android closes the app to update it).
 */
public final class UpdateReceiver extends BroadcastReceiver {

    static final String ACTION = "com.bodyandiron.traininglog.UPDATE_STATUS";
    static final String CHANNEL = "updates";
    private static final int NOTE_ID = 2;

    @Override
    @SuppressWarnings("deprecation")
    public void onReceive(Context ctx, Intent in) {
        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(in.getAction())) { updated(ctx); return; }
        if (!ACTION.equals(in.getAction())) return;
        int st = in.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = (Intent) in.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try { ctx.startActivity(confirm); } catch (Exception e) { }
            }
            send("confirm", null);
        } else if (st != PackageInstaller.STATUS_SUCCESS) {
            send(st == PackageInstaller.STATUS_FAILURE_ABORTED ? "cancelled" : "error", "install");
        }
    }

    private static void send(String type, String why) {
        try {
            JSONObject r = new JSONObject();
            r.put("type", type);
            if (why != null) r.put("why", why);
            MainActivity.event(r.toString());
        } catch (Exception e) { }
    }

    private static void updated(Context ctx) {
        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            if (nm.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "Updates", NotificationManager.IMPORTANCE_DEFAULT);
                ch.setDescription("When Tally has updated itself");
                nm.createNotificationChannel(ch);
            }
            String v = "";
            try { v = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0).versionName; } catch (Exception e) { }
            Intent open = new Intent(ctx, MainActivity.class);
            open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi = PendingIntent.getActivity(ctx, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification n = new Notification.Builder(ctx, CHANNEL)
                    .setSmallIcon(AlarmReceiver.smallIcon(ctx))
                    .setContentTitle(v.isEmpty() ? "Tally is updated" : "Tally " + v + " is installed")
                    .setContentText("Tap to open it")
                    .setAutoCancel(true)
                    .setContentIntent(pi)
                    .build();
            nm.notify(NOTE_ID, n);
        } catch (Exception e) { }
    }
}
