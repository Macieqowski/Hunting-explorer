package org.polowanie.app;

import android.content.Context;
import android.location.GnssStatus;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import androidx.annotation.NonNull;
import java.util.List;

/**
 * The phone's position straight from Android's LocationManager, without Google Play services.
 *
 * Phones without Google services have no network location and no assisted GPS (AGPS/SUPL), so
 * every first fix is a cold start that can take one to two minutes. GPS only gets there if the
 * request stays registered the whole time: each removeUpdates() throws away the satellite search.
 * So this listens continuously (GPS every second, plus Android's own "fused" provider and network
 * location where the phone has them) until {@link #stop()}, with no time limit, and reports how many
 * satellites GPS sees and uses meanwhile, so the person knows it is still searching.
 *
 * Used by {@link GpsPlugin} (screen on) and {@link LocationService} (sharing with the screen off).
 * Call on the main thread.
 */
class LocationFeed {

    interface Sink {
        void onFix(Location location);

        /** Satellites GPS receives now, and how many of them it uses for the position. */
        void onSatellites(int visible, int used);
    }

    /** A position from another provider is dropped while GPS gave one within this time. */
    private static final long GPS_PREFERRED_MS = 10_000;

    private final LocationManager manager;
    private final Sink sink;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean running;
    private long lastGpsAt;
    private int lastVisible = -1;
    private int lastUsed = -1;

    LocationFeed(Context context, Sink sink) {
        this.manager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        this.sink = sink;
    }

    private final LocationListener listener = new LocationListener() {
        @Override
        public void onLocationChanged(@NonNull Location location) {
            long now = SystemClock.elapsedRealtime();
            if (LocationManager.GPS_PROVIDER.equals(location.getProvider())) lastGpsAt = now;
            // A network or fused position only adds something while GPS has nothing (e.g. under a roof).
            else if (lastGpsAt != 0 && now - lastGpsAt < GPS_PREFERRED_MS) return;
            sink.onFix(location);
        }

        // Needed on Android 9 and 10, where these are not default methods yet.
        @Override
        public void onStatusChanged(String provider, int status, Bundle extras) {}

        @Override
        public void onProviderEnabled(@NonNull String provider) {}

        @Override
        public void onProviderDisabled(@NonNull String provider) {}
    };

    private final GnssStatus.Callback gnss = new GnssStatus.Callback() {
        @Override
        public void onSatelliteStatusChanged(@NonNull GnssStatus status) {
            int visible = status.getSatelliteCount();
            int used = 0;
            for (int i = 0; i < visible; i++) if (status.usedInFix(i)) used++;
            report(visible, used);
        }

        @Override
        public void onStopped() {
            report(0, 0);
        }
    };

    private void report(int visible, int used) {
        if (visible == lastVisible && used == lastUsed) return;
        lastVisible = visible;
        lastUsed = used;
        sink.onSatellites(visible, used);
    }

    boolean isRunning() {
        return running;
    }

    /** Whether location is switched on in the phone's settings. */
    boolean isLocationEnabled() {
        if (manager == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return manager.isLocationEnabled();
        return manager.isProviderEnabled(LocationManager.GPS_PROVIDER) || manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
    }

    /**
     * Starts listening (or keeps listening: a running feed is left alone, so the satellite search
     * is never restarted). Returns false when the phone has no location provider at all.
     *
     * @param intervalMs how often GPS should report; GPS itself always runs at least every second
     *     while searching, which is what the GNSS chip does anyway.
     */
    @SuppressWarnings("MissingPermission")
    boolean start(long intervalMs) throws SecurityException {
        if (running) return true;
        if (manager == null) return false;
        List<String> all = manager.getAllProviders();
        Looper looper = Looper.getMainLooper();
        boolean any = false;
        if (all.contains(LocationManager.GPS_PROVIDER)) {
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, Math.min(intervalMs, 1000), 0f, listener, looper);
            any = true;
        }
        // Android 12+ has its own fused provider (GPS + network) that works without Google Play services.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && all.contains(LocationManager.FUSED_PROVIDER)) {
            manager.requestLocationUpdates(LocationManager.FUSED_PROVIDER, intervalMs, 0f, listener, looper);
            any = true;
        }
        if (all.contains(LocationManager.NETWORK_PROVIDER)) {
            manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, Math.max(intervalMs, 5000), 0f, listener, looper);
            any = true;
        }
        if (!any) return false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) manager.registerGnssStatusCallback(handler::post, gnss);
            else manager.registerGnssStatusCallback(gnss, handler);
        } catch (RuntimeException e) {
            // No satellite status on this phone: positions still come.
        }
        running = true;
        return true;
    }

    void stop() {
        if (!running) return;
        running = false;
        lastGpsAt = 0;
        lastVisible = -1;
        lastUsed = -1;
        manager.removeUpdates(listener);
        manager.unregisterGnssStatusCallback(gnss);
    }

    /** Milliseconds since Android got this position. */
    static long ageMs(Location l) {
        return Math.max(0, (SystemClock.elapsedRealtimeNanos() - l.getElapsedRealtimeNanos()) / 1_000_000);
    }

    /** The newest position any provider remembers (GPS, fused, network, passive), or null. */
    @SuppressWarnings("MissingPermission")
    Location lastKnown() {
        if (manager == null) return null;
        Location best = null;
        for (String p : manager.getAllProviders()) {
            Location l;
            try {
                l = manager.getLastKnownLocation(p);
            } catch (RuntimeException e) {
                continue;
            }
            if (l == null) continue;
            if (best == null || l.getElapsedRealtimeNanos() > best.getElapsedRealtimeNanos()) best = l;
        }
        return best;
    }
}
