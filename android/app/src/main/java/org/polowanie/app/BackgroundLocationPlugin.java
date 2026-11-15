package org.polowanie.app;

import android.Manifest;
import android.content.Intent;
import android.location.Location;
import android.os.Build;
import android.webkit.WebView;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Location sharing that keeps working with the screen off: start() starts {@link LocationService}
 * and positions arrive as "location" events, satellites GPS sees as "satellites" { visible, used }; "stopped" when the user taps Stop in the notification.
 * With a "publish" option the service also sends them to the hunt's database itself: "sent" { at }
 * when one got there, "denied" when the database refused it (the service has stopped then).
 * Used by src/native.ts.
 */
@CapacitorPlugin(
    name = "BackgroundLocation",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }),
    }
)
public class BackgroundLocationPlugin extends Plugin {

    @Override
    public void load() {
        LocationService.sink = this::send;
        LocationService.satellitesSink = new LocationFeed.Sink() {
            @Override
            public void onFix(Location location) {}

            @Override
            public void onSatellites(int visible, int used) {
                JSObject o = new JSObject();
                o.put("visible", visible);
                o.put("used", used);
                notifyListeners("satellites", o);
            }
        };
        LocationService.onSent = (at) -> {
            JSObject o = new JSObject();
            o.put("at", at);
            notifyListeners("sent", o);
        };
        LocationService.onDenied = () -> {
            keepRendererImportant(false);
            notifyListeners("denied", new JSObject());
        };
        LocationService.onStoppedByUser = () -> {
            keepRendererImportant(false);
            notifyListeners("stopped", new JSObject());
        };
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "afterLocation");
            return;
        }
        afterLocation(call);
    }

    @PermissionCallback
    private void afterLocation(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Location permission denied", "DENIED");
            return;
        }
        // Without this permission (Android 13+) the service still runs; only its notification is hidden.
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED && !call.getBoolean("askedNotifications", false)) {
            call.getData().put("askedNotifications", true);
            requestPermissionForAlias("notifications", call, "afterLocation");
            return;
        }
        // In a group hunt the service itself sends my position to the database (see PositionPublisher).
        boolean publishing = false;
        JSObject pub = call.getObject("publish");
        PositionPublisher old = LocationService.publisher;
        if (pub != null && pub.getString("dbUrl") != null && pub.getString("refreshToken") != null && pub.getString("uid") != null && pub.getString("huntId") != null) {
            PositionPublisher.Config c = new PositionPublisher.Config();
            c.dbUrl = pub.getString("dbUrl");
            c.apiKey = pub.getString("apiKey", "");
            c.refreshToken = pub.getString("refreshToken");
            c.idToken = pub.getString("idToken");
            c.idTokenExpiresAt = pub.optLong("idTokenExpiresAt", 0);
            c.uid = pub.getString("uid");
            c.huntId = pub.getString("huntId");
            c.heartbeatMs = pub.optLong("heartbeatMs", 30_000);
            c.minMoveM = pub.optDouble("minMoveM", 20);
            String tokenUrl = pub.getString("tokenUrl");
            if (tokenUrl != null && !tokenUrl.isEmpty()) c.tokenUrl = tokenUrl;
            LocationService.publisher = new PositionPublisher(getContext(), c, LocationService.listener());
            publishing = true;
        } else LocationService.publisher = null;
        // Another hunt, or the page sends again: the old one stops (keeping my position there is up to the page).
        if (old != null) old.stop(false);
        Intent i = new Intent(getContext(), LocationService.class)
            .putExtra(LocationService.EXTRA_TITLE, call.getString("title", "Polowanie"))
            .putExtra(LocationService.EXTRA_TEXT, call.getString("text", ""))
            .putExtra(LocationService.EXTRA_STOP, call.getString("stopLabel", "Stop"))
            .putExtra(LocationService.EXTRA_INTERVAL, (long) call.getInt("intervalMs", 3000));
        try {
            ContextCompat.startForegroundService(getContext(), i);
        } catch (Exception e) {
            if (LocationService.publisher != null) LocationService.publisher.stop(false);
            LocationService.publisher = null;
            call.reject("Could not start location service: " + e.getMessage(), "UNAVAILABLE");
            return;
        }
        keepRendererImportant(true);
        JSObject r = new JSObject();
        r.put("publishing", publishing);
        call.resolve(r);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopService();
        call.resolve();
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject r = new JSObject();
        r.put("running", LocationService.running);
        call.resolve(r);
    }

    private void stopService() {
        getContext().stopService(new Intent(getContext(), LocationService.class));
        keepRendererImportant(false);
    }

    private void send(Location l) {
        JSObject o = new JSObject();
        o.put("lat", l.getLatitude());
        o.put("lng", l.getLongitude());
        if (l.hasAccuracy()) o.put("acc", l.getAccuracy());
        o.put("time", l.getTime());
        notifyListeners("location", o);
    }

    /**
     * While sharing, the page must keep running in the background: by default Android may stop
     * the WebView's renderer once the app is not visible.
     */
    private void keepRendererImportant(boolean on) {
        if (getActivity() == null) return;
        getActivity().runOnUiThread(() -> {
            WebView w = getBridge().getWebView();
            if (w != null) w.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, !on);
        });
    }

    @Override
    protected void handleOnDestroy() {
        // The app was closed (swiped away): stop sharing rather than leave GPS running.
        LocationService.sink = null;
        LocationService.satellitesSink = null;
        LocationService.onStoppedByUser = null;
        LocationService.onSent = null;
        LocationService.onDenied = null;
        getContext().stopService(new Intent(getContext(), LocationService.class));
        super.handleOnDestroy();
    }
}
