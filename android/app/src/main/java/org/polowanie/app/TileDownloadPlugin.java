package org.polowanie.app;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Offline map saving that goes on with the screen off ({@link TileDownloadService}).
 * Used by src/offline.ts: start() hands over a job, status() says what is done since the last
 * call, cancel() stops it, forget() drops a finished job.
 */
@CapacitorPlugin(name = "TileDownload", permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) })
public class TileDownloadPlugin extends Plugin {

    /**
     * id, title, doneTitle, stopLabel, refresh, concurrency, units: [{ u, f?, n, m, t: [[col, row, file], …] }].
     * A job with the same id replaces the earlier one.
     */
    @PluginMethod
    public void start(PluginCall call) {
        // Without this permission (Android 13+) the download still runs; only its notification is hidden.
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED && !call.getBoolean("askedNotifications", false)) {
            call.getData().put("askedNotifications", true);
            requestPermissionForAlias("notifications", call, "afterPermission");
            return;
        }
        afterPermission(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("No id");
            return;
        }
        List<TileDownloadService.Unit> units;
        java.util.Map<String, TileDownloadService.WmtsSource> sources;
        try {
            units = parseUnits(call.getArray("units", new JSArray()));
            sources = parseSources(call.getObject("sources", new JSObject()));
        } catch (JSONException e) {
            call.reject("Bad units: " + e.getMessage());
            return;
        }
        TileDownloadService.Job job = new TileDownloadService.Job(
            id,
            call.getString("title", "Polowanie"),
            call.getString("doneTitle"),
            call.getString("stopLabel", "Stop"),
            call.getBoolean("refresh", false),
            call.getInt("concurrency", 8),
            call.getInt("wmsConcurrency", 6),
            units,
            sources
        );
        synchronized (TileDownloadService.LOCK) {
            // The page started this area again (it was reloaded, or resumed): the new job replaces
            // the old one. Tiles the old one wrote are found as files and not fetched again.
            TileDownloadService.Job old = TileDownloadService.jobs.get(id);
            if (old != null) {
                old.cancelled = true;
                if (TileDownloadService.queue.remove(old)) old.state = "cancelled";
            }
            TileDownloadService.jobs.put(id, job);
            TileDownloadService.queue.add(job);
        }
        try {
            ContextCompat.startForegroundService(getContext(), new Intent(getContext(), TileDownloadService.class));
        } catch (Exception e) {
            // Android 12+ refuses to start a foreground service from the background.
            synchronized (TileDownloadService.LOCK) {
                TileDownloadService.queue.remove(job);
                TileDownloadService.jobs.remove(id);
            }
            call.reject("Could not start the download service: " + e.getMessage(), "UNAVAILABLE");
            return;
        }
        call.resolve();
    }

    private static List<TileDownloadService.Unit> parseUnits(JSONArray arr) throws JSONException {
        List<TileDownloadService.Unit> out = new ArrayList<>(arr.length());
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.getJSONObject(i);
            TileDownloadService.Unit u = new TileDownloadService.Unit();
            u.url = o.optString("u", null);
            u.src = o.has("s") && !o.isNull("s") ? o.getString("s") : null;
            u.z = o.optInt("z");
            u.x = o.optInt("x");
            u.y = o.optInt("y");
            if (u.url == null && u.src == null) throw new JSONException("unit without u or s");
            u.fallback = o.has("f") && !o.isNull("f") ? o.getString("f") : null;
            u.n = o.optInt("n", 1);
            u.mime = o.optString("m", "image/png");
            JSONArray t = o.getJSONArray("t");
            u.cols = new int[t.length()];
            u.rows = new int[t.length()];
            u.files = new String[t.length()];
            for (int k = 0; k < t.length(); k++) {
                JSONArray e = t.getJSONArray(k);
                u.cols[k] = e.getInt(0);
                u.rows[k] = e.getInt(1);
                String f = e.getString(2);
                // File names come from tileFileName(): a hash and an extension, nothing else.
                if (!f.matches("[0-9a-f]{1,32}\\.(png|jpg)")) throw new JSONException("bad file name " + f);
                u.files[k] = f;
            }
            out.add(u);
        }
        return out;
    }

    /** { id: { t: GetTile URL with {L} {r} {c}, f?: fallback URL, scales: [...], e: origin easting, n: origin northing, size } } */
    private static java.util.Map<String, TileDownloadService.WmtsSource> parseSources(JSONObject o) throws JSONException {
        java.util.Map<String, TileDownloadService.WmtsSource> out = new java.util.HashMap<>();
        java.util.Iterator<String> keys = o.keys();
        while (keys.hasNext()) {
            String k = keys.next();
            JSONObject v = o.getJSONObject(k);
            TileDownloadService.WmtsSource w = new TileDownloadService.WmtsSource();
            w.template = v.getString("t");
            w.fallback = v.has("f") && !v.isNull("f") ? v.getString("f") : null;
            JSONArray sc = v.getJSONArray("scales");
            w.scales = new double[sc.length()];
            for (int i = 0; i < sc.length(); i++) w.scales[i] = sc.getDouble(i);
            if (w.scales.length == 0) throw new JSONException("no scales");
            w.originE = v.getDouble("e");
            w.originN = v.getDouble("n");
            w.size = v.optInt("size", 512);
            out.put(k, w);
        }
        return out;
    }

    /** id, since: results from that index on. Returns state, done, failed, bytes, total, waiting, results, next. */
    @PluginMethod
    public void status(PluginCall call) {
        String id = call.getString("id");
        int since = Math.max(0, call.getInt("since", 0));
        TileDownloadService.Job job;
        synchronized (TileDownloadService.LOCK) {
            job = TileDownloadService.jobs.get(id);
        }
        JSObject res = new JSObject();
        if (job == null) {
            res.put("state", "none");
            call.resolve(res);
            return;
        }
        // Read the counters before the results, so the results are never behind them.
        res.put("state", job.state);
        res.put("done", job.done.get());
        res.put("failed", job.failed.get());
        res.put("bytes", job.bytes.get());
        res.put("total", job.total);
        res.put("waiting", job.waitingForSignal);
        JSONArray list = new JSONArray();
        int next;
        synchronized (job.results) {
            next = job.results.size();
            for (int i = since; i < next; i++) {
                int[] r = job.results.get(i);
                list.put(new JSONArray().put(r[0]).put(r[1]).put(r[2]));
            }
        }
        res.put("results", list);
        res.put("next", next);
        call.resolve(res);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String id = call.getString("id");
        synchronized (TileDownloadService.LOCK) {
            TileDownloadService.Job job = TileDownloadService.jobs.get(id);
            if (job != null) {
                job.cancelled = true;
                if (TileDownloadService.queue.remove(job)) job.state = "cancelled";
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void forget(PluginCall call) {
        String id = call.getString("id");
        synchronized (TileDownloadService.LOCK) {
            TileDownloadService.Job job = TileDownloadService.jobs.get(id);
            if (job != null && ("done".equals(job.state) || "cancelled".equals(job.state))) TileDownloadService.jobs.remove(id);
        }
        call.resolve();
    }
}
