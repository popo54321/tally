package com.bodyandiron.traininglog;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

public final class AlarmReceiver extends BroadcastReceiver {

    static final String ACTION = "com.bodyandiron.traininglog.TIMER_DONE";
    static final String EXTRA_LABEL = "label";
    static final String CHANNEL = "timer";
    private static final int NOTE_ID = 8124;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (MainActivity.inForeground) return;

        String label = intent == null ? null : intent.getStringExtra(EXTRA_LABEL);
        if (label == null || label.length() == 0) label = "Timer finished";

        vibrate(ctx);
        if (canPost(ctx)) post(ctx, label);
        else ring(ctx);
    }

    private static boolean canPost(Context ctx) {
        if (Build.VERSION.SDK_INT < 33) return true;
        try {
            return ctx.checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                    == PackageManager.PERMISSION_GRANTED;
        } catch (Exception e) { return false; }
    }

    private static int smallIcon(Context ctx) {
        try {
            int id = ctx.getResources().getIdentifier(
                    "ic_tally_mono", "drawable", ctx.getPackageName());
            if (id != 0) return id;
        } catch (Exception e) { }
        return android.R.drawable.ic_lock_idle_alarm;
    }

    private static Uri alertUri() {
        Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (u == null) u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        return u;
    }

    private static AudioAttributes alarmAttrs() {
        return new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
    }

    private static void post(Context ctx, String label) {
        try {
            NotificationManager nm =
                    (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            if (nm.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL, "Timer alerts", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("Sounds when a rest or stretch timer finishes");
                ch.enableVibration(true);
                Uri u = alertUri();
                if (u != null) ch.setSound(u, alarmAttrs());
                nm.createNotificationChannel(ch);
            }

            Intent open = new Intent(ctx, MainActivity.class);
            open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi = PendingIntent.getActivity(ctx, 0, open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Notification n = new Notification.Builder(ctx, CHANNEL)
                    .setSmallIcon(smallIcon(ctx))
                    .setContentTitle(label)
                    .setContentText("Tap to go back")
                    .setCategory(Notification.CATEGORY_ALARM)
                    .setAutoCancel(true)
                    .setContentIntent(pi)
                    .build();
            nm.notify(NOTE_ID, n);
        } catch (Exception e) { ring(ctx); }
    }

    private static void ring(Context ctx) {
        try {
            Uri u = alertUri();
            if (u == null) return;
            Ringtone r = RingtoneManager.getRingtone(ctx, u);
            if (r == null) return;
            r.setAudioAttributes(alarmAttrs());
            r.play();
        } catch (Exception e) { }
    }

    private static void vibrate(Context ctx) {
        try {
            Vibrator v = vibrator(ctx);
            if (v == null || !v.hasVibrator()) return;
            long[] pattern = { 0, 400, 200, 400, 200, 700 };
            v.vibrate(VibrationEffect.createWaveform(pattern, -1));
        } catch (Exception e) { }
    }

    @SuppressWarnings("deprecation")
    private static Vibrator vibrator(Context ctx) {
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return vm == null ? null : vm.getDefaultVibrator();
        }
        return (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
    }
}
