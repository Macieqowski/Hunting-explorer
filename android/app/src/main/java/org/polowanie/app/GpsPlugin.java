package org.polowanie.app;

import android.Manifest;
import android.location.Location;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * The phone's position while the app is on screen ("Gdzie jestem?", weather for here, stands,
 * sightings, beater guidance), in place of the WebView's navigator.geolocation.
 *
 * The WebView gives up when the page's timeout runs out (15-20 s), and on a phone without Google
 * services, which has no network location or assisted GPS, a cold GPS start takes 40-90 s: the
 * position never came. This listens through {@link LocationFeed} until the page calls stop(),
 * reports satellites meanwhile, and hands over the last known position at once.
 *
 * start() resolves with { last?, enabled }; events "fix" { lat, lng, acc?, time, provider } and
 * "satellites" { visible, used }. Used by src/geo.ts, which shares one feed between its callers.
 */
@CapacitorPlugin(
    name = "Gps",
    permissions = { @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }) }
)
public class GpsPlugin extends Plugin {

    private LocationFeed feed;

    @Override
    public void load() {
        feed = new LocationFeed(getContext(), new LocationFeed.Sink() {
            @Override
            public void onFix(Location l) {
                notifyListeners("fix", toJs(l));
            }

            @Override
            public void onSatellites(int visible, int used) {
                JSObject o = new JSObject();
                o.put("visible", visible);
                o.put("used", used);
                notifyListeners("satellites", o);
            }
        });
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "afterPermission");
            return;
        }
        afterPermission(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Location permission denied", "DENIED");
            return;
        }
        if (!feed.isLocationEnabled()) {
            call.reject("Location is turned off", "OFF");
            return;
        }
        long interval = call.getInt("intervalMs", 1000);
        getActivity().runOnUiThread(() -> {
            try {
                if (!feed.start(interval)) {
                    call.reject("No location provider", "UNAVAILABLE");
                    return;
                }
            } catch (SecurityException e) {
                call.reject("Location permission denied", "DENIED");
                return;
            }
            call.resolve(withLast());
        });
    }

    @PluginMethod
    public void lastKnown(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.resolve(new JSObject());
            return;
        }
        call.resolve(withLast());
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(feed::stop);
        call.resolve();
    }

    private JSObject withLast() {
        JSObject r = new JSObject();
        r.put("enabled", feed.isLocationEnabled());
        Location last = feed.lastKnown();
        if (last != null) r.put("last", toJs(last));
        return r;
    }

    private static JSObject toJs(Location l) {
        JSObject o = new JSObject();
        o.put("lat", l.getLatitude());
        o.put("lng", l.getLongitude());
        if (l.hasAccuracy()) o.put("acc", l.getAccuracy());
        o.put("time", l.getTime());
        o.put("age", LocationFeed.ageMs(l));
        o.put("provider", l.getProvider());
        return o;
    }

    // Deliberately nothing in handleOnPause: stopping there would throw away the satellite search
    // each time the screen dims or a permission dialog appears. The page stops the feed itself.

    @Override
    protected void handleOnDestroy() {
        feed.stop();
        super.handleOnDestroy();
    }
}
