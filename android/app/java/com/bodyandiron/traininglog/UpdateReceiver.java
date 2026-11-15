package com.bodyandiron.traininglog;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Once Tally has been replaced by an update, posts a notification to open it again (Android closes the app
 * to update it).
 */
public final class UpdateReceiver extends BroadcastReceiver {

    static final String CHANNEL = "updates";
    private static final int NOTE_ID = 2;

    @Override
    public void onReceive(Context ctx, Intent in) {
        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(in.getAction())) updated(ctx);
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
