package org.polowanie.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.app.UiAutomation;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.location.LocationManager;
import android.location.Criteria;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.util.Log;
import androidx.core.content.ContextCompat;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * A beater walking with the phone locked: the location service must keep sending positions to
 * the hunt's database with the screen off and the phone in Doze (Nov 2026: they stopped a few
 * minutes after locking, while the web page sent them).
 *
 * Talks to the Firebase emulators (database with the real rules, and sign-in) started by the CI
 * job on the test machine; it passes their addresses, a signed-in anonymous user and a live hunt
 * where that user is a confirmed beater as instrumentation arguments (fbDb, fbAuth, refreshToken,
 * uid, huntId). Skipped without them.
 */
@RunWith(AndroidJUnit4.class)
public class PositionPublisherTest {

    private static final String TAG = "polowanie-test";

    private static String shell(UiAutomation ui, String cmd) throws IOException {
        ParcelFileDescriptor pfd = ui.executeShellCommand(cmd);
        StringBuilder sb = new StringBuilder();
        try (FileInputStream in = new ParcelFileDescriptor.AutoCloseInputStream(pfd)) {
            byte[] buf = new byte[4096];
            int r;
            while ((r = in.read(buf)) > 0) sb.append(new String(buf, 0, r));
        }
        return sb.toString();
    }

    /** Reads a path from the emulator, bypassing the rules. */
    private static JSONObject read(String db, String path) throws Exception {
        int q = db.indexOf('?');
        String url = db.substring(0, q).replaceAll("/+$", "") + "/" + path + ".json?" + db.substring(q + 1);
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestProperty("Authorization", "Bearer owner");
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            String s = out.toString("UTF-8");
            return "null".equals(s.trim()) ? new JSONObject() : new JSONObject(s);
        } finally {
            c.disconnect();
        }
    }

    @Test
    public void sendsPositionsWithTheScreenOffAndInDoze() throws Exception {
        Bundle args = InstrumentationRegistry.getArguments();
        String db = args.getString("fbDb");
        Assume.assumeTrue("Firebase emulator not given", db != null && !db.isEmpty());
        String uid = args.getString("uid");
        String hunt = args.getString("huntId");

        Context ctx = InstrumentationRegistry.getInstrumentation().getTargetContext();
        UiAutomation ui = InstrumentationRegistry.getInstrumentation().getUiAutomation();
        String pkg = ctx.getPackageName();
        shell(ui, "pm grant " + pkg + " android.permission.ACCESS_FINE_LOCATION");
        shell(ui, "pm grant " + pkg + " android.permission.POST_NOTIFICATIONS");
        shell(ui, "appops set " + pkg + " android:mock_location allow");

        LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        String gps = LocationManager.GPS_PROVIDER;
        try {
            lm.removeTestProvider(gps);
        } catch (RuntimeException ignored) {}
        lm.addTestProvider(gps, false, false, false, false, true, true, true, Criteria.POWER_HIGH, Criteria.ACCURACY_FINE);
        lm.setTestProviderEnabled(gps, true);

        PositionPublisher.Config c = new PositionPublisher.Config();
        c.dbUrl = db;
        c.apiKey = "fake";
        c.tokenUrl = args.getString("fbAuth") + "/securetoken.googleapis.com/v1/token";
        c.refreshToken = args.getString("refreshToken");
        c.uid = uid;
        c.huntId = hunt;
        c.heartbeatMs = 30_000;
        AtomicInteger sent = new AtomicInteger();
        AtomicInteger denied = new AtomicInteger();
        LocationService.onSent = (at) -> sent.incrementAndGet();
        LocationService.onDenied = denied::incrementAndGet;

        // The app on screen first: Android only lets a visible app start a foreground service.
        try (ActivityScenario<MainActivity> ignored = ActivityScenario.launch(MainActivity.class)) {
            LocationService.publisher = new PositionPublisher(ctx, c, LocationService.listener());
            ContextCompat.startForegroundService(ctx, new Intent(ctx, LocationService.class).putExtra(LocationService.EXTRA_TITLE, "Test"));
            Thread.sleep(2000);
            assertTrue("foreground service", shell(ui, "dumpsys activity services " + pkg + "/.LocationService").contains("isForeground=true"));

            // Screen off and Doze, as in a pocket; then walk north 25 m every 5 s for 2.5 minutes.
            shell(ui, "input keyevent KEYCODE_SLEEP");
            Thread.sleep(1000);
            shell(ui, "dumpsys deviceidle force-idle");
            double lat = 52.2, lng = 21.0;
            long t0 = System.currentTimeMillis();
            int steps = 30;
            try {
                for (int i = 0; i < steps; i++) {
                    lat += 25 / 111_320.0;
                    Location l = new Location(gps);
                    l.setLatitude(lat);
                    l.setLongitude(lng);
                    l.setAccuracy(6);
                    l.setTime(System.currentTimeMillis());
                    l.setElapsedRealtimeNanos(SystemClock.elapsedRealtimeNanos());
                    lm.setTestProviderLocation(gps, l);
                    Thread.sleep(5000);
                }
            } finally {
                Log.i(TAG, "deviceidle: " + shell(ui, "dumpsys deviceidle get deep") + " screen: " + shell(ui, "dumpsys power | grep -m1 mWakefulness"));
                shell(ui, "dumpsys deviceidle unforce");
                shell(ui, "input keyevent KEYCODE_WAKEUP");
            }

            JSONObject pos = read(db, "positions/" + hunt + "/" + uid);
            JSONObject track = read(db, "tracks/" + hunt + "/" + uid);
            Log.i(TAG, "position " + pos + ", " + track.length() + " track points, sent " + sent.get() + " times, denied " + denied.get());
            assertEquals(0, denied.get());
            assertEquals("last position", lat, pos.getDouble("lat"), 2e-5);
            assertTrue("server time", pos.getLong("ts") >= t0 - 60_000);
            // Every step was 25 m (more than the 20 m threshold): each should be a track point.
            assertTrue("track points: " + track.length(), track.length() >= steps - 2);

            ctx.startService(new Intent(ctx, LocationService.class).setAction(LocationService.ACTION_STOP));
            Thread.sleep(3000);
            assertEquals("position removed after Stop", 0, read(db, "positions/" + hunt + "/" + uid).length());
        } finally {
            LocationService.onSent = null;
            LocationService.onDenied = null;
            try {
                lm.removeTestProvider(gps);
            } catch (RuntimeException ignored) {}
        }
    }
}
