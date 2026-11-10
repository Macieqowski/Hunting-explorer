package org.polowanie.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;

/**
 * Hunt alerts that reach the hunter with the screen off: vibration patterns (the WebView's
 * navigator.vibrate needs a recent tap and stops in the background) and notifications.
 * Used by src/native.ts.
 */
@CapacitorPlugin(name = "Alerts")
public class AlertsPlugin extends Plugin {

    static final String CHANNEL = "alerts";
    private int nextId = 2000;

    /** pattern: [on, off, on, ...] in ms; alarm: also vibrate when the phone is set to silent. */
    @PluginMethod
    public void vibrate(PluginCall call) {
        JSArray arr = call.getArray("pattern", new JSArray());
        boolean alarm = call.getBoolean("alarm", false);
        long[] timings = new long[arr.length() + 1];
        try {
            for (int i = 0; i < arr.length(); i++) timings[i + 1] = Math.max(0, Math.min(5000, arr.getLong(i)));
        } catch (JSONException e) {
            call.reject("Bad pattern");
            return;
        }
        if (arr.length() == 0) {
            call.resolve();
            return;
        }
        Vibrator v = vibrator();
        if (v == null || !v.hasVibrator()) {
            call.resolve();
            return;
        }
        // createWaveform starts with a pause, so the pattern is shifted by one (leading 0).
        VibrationEffect effect = VibrationEffect.createWaveform(timings, -1);
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(alarm ? AudioAttributes.USAGE_ALARM : AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        v.vibrate(effect, attrs);
        call.resolve();
    }

    /** Shows a notification (title, text); tapping it opens the app. */
    @PluginMethod
    public void notify(PluginCall call) {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            call.resolve();
            return;
        }
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Alarmy polowania", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Wiadomości od prowadzącego, początek i koniec pędzenia, zwierzyna idąca w Twoją stronę.");
            // No sound in the field; the app vibrates with its own pattern.
            ch.setSound(null, null);
            ch.enableVibration(false);
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String text = call.getString("text", "");
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_polowanie)
            .setContentTitle(call.getString("title", "Polowanie"))
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE);
        try {
            NotificationManagerCompat.from(ctx).notify(nextId++, b.build());
        } catch (SecurityException e) {
            // Permission withdrawn meanwhile.
        }
        call.resolve();
    }

    /** Clears the alert notifications (when the app comes back to the screen). */
    @PluginMethod
    public void clear(PluginCall call) {
        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        for (android.service.notification.StatusBarNotification n : nm.getActiveNotifications())
            if (n.getId() >= 2000) nm.cancel(n.getId());
        call.resolve();
    }

    private Vibrator vibrator() {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return vm != null ? vm.getDefaultVibrator() : null;
        }
        return (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
    }
}
