package org.polowanie.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import java.util.function.Consumer;

/**
 * Keeps receiving the phone's position while the screen is off or another app is open, during
 * location sharing in a group hunt. Android only allows that to a foreground service, which must
 * show a notification ("Polowanie: udostępniasz położenie", with a Stop button).
 *
 * Uses Android's own LocationManager (no Google Play services), so it also works on phones
 * without them. Positions go to {@link BackgroundLocationPlugin} and on to the web code.
 */
public class LocationService extends Service {

    static final String CHANNEL = "location";
    static final int NOTIFICATION_ID = 1001;
    static final String ACTION_STOP = "org.polowanie.app.STOP_LOCATION";
    static final String EXTRA_INTERVAL = "intervalMs";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_TEXT = "text";
    static final String EXTRA_STOP = "stopLabel";

    /** Set by the plugin: receives positions, and null when the service stops itself. */
    static volatile Consumer<Location> sink;
    static volatile Runnable onStoppedByUser;
    static volatile boolean running;

    private LocationManager manager;
    private long lastGpsAt;
    private final LocationListener listener = new LocationListener() {
        @Override
        public void onLocationChanged(@NonNull Location location) {
            boolean gps = LocationManager.GPS_PROVIDER.equals(location.getProvider());
            if (gps) lastGpsAt = System.currentTimeMillis();
            // A network position is only worth sending while GPS has nothing (e.g. under a roof).
            else if (!"fused".equals(location.getProvider()) && System.currentTimeMillis() - lastGpsAt < 30_000) return;
            Consumer<Location> s = sink;
            if (s != null) s.accept(location);
        }

        // Needed on Android 9 and 10, where these are not default methods yet.
        @Override
        public void onStatusChanged(String provider, int status, Bundle extras) {}

        @Override
        public void onProviderEnabled(@NonNull String provider) {}

        @Override
        public void onProviderDisabled(@NonNull String provider) {}
    };

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            Runnable r = onStoppedByUser;
            stopSelf();
            if (r != null) r.run();
            return START_NOT_STICKY;
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopSelf();
            return START_NOT_STICKY;
        }
        String title = intent != null && intent.hasExtra(EXTRA_TITLE) ? intent.getStringExtra(EXTRA_TITLE) : "Polowanie";
        String text = intent != null && intent.hasExtra(EXTRA_TEXT) ? intent.getStringExtra(EXTRA_TEXT) : "";
        String stop = intent != null && intent.hasExtra(EXTRA_STOP) ? intent.getStringExtra(EXTRA_STOP) : "Stop";
        long interval = intent != null ? intent.getLongExtra(EXTRA_INTERVAL, 3000) : 3000;

        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(title, text, stop),
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0
        );
        startUpdates(interval);
        running = true;
        return START_NOT_STICKY;
    }

    private Notification buildNotification(String title, String text, String stopLabel) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Udostępnianie położenia", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Widoczne, gdy aplikacja wysyła Twoje położenie uczestnikom polowania.");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPi = PendingIntent.getActivity(this, 0, open, piFlags);
        PendingIntent stopPi = PendingIntent.getService(this, 1, new Intent(this, LocationService.class).setAction(ACTION_STOP), piFlags);
        return new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_polowanie)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(openPi)
            .addAction(0, stopLabel, stopPi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }

    @SuppressWarnings("MissingPermission")
    private void startUpdates(long interval) {
        if (manager == null) manager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        manager.removeUpdates(listener);
        Looper looper = Looper.getMainLooper();
        try {
            // Android 12+ has its own fused provider (GPS + network) without Google Play services.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && manager.getAllProviders().contains(LocationManager.FUSED_PROVIDER)) {
                manager.requestLocationUpdates(LocationManager.FUSED_PROVIDER, interval, 0f, listener, looper);
                return;
            }
            if (manager.getAllProviders().contains(LocationManager.GPS_PROVIDER))
                manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, interval, 0f, listener, looper);
            if (manager.getAllProviders().contains(LocationManager.NETWORK_PROVIDER))
                manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, Math.max(interval, 10_000), 0f, listener, looper);
        } catch (SecurityException e) {
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        running = false;
        if (manager != null) manager.removeUpdates(listener);
        super.onDestroy();
    }
}
