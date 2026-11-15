package org.polowanie.app;

import android.content.Context;
import android.location.Location;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Sends my position to the group hunt's Firebase Realtime Database straight from the location
 * service, over Firebase's REST API, so positions keep reaching the others with the screen locked.
 *
 * Before, the web page sent them. With the screen off Android's WebView throttles and then pauses
 * the page's timers, Firebase's connection drops and is not reopened, and positions stopped after
 * a few minutes until the phone was unlocked (Nov 2026, walk test as a beater).
 *
 * Writes exactly what publishPosition() in src/huntFirebase.ts writes (positions/$h/$uid with a
 * server timestamp, and a track point under tracks/$h/$uid when I moved), with the same rules as
 * sendDecision() in src/hunt.ts: at once when I moved at least {@link Config#minMoveM} (or the
 * accuracy, up to 100 m), otherwise once per heartbeat. Signs in with the page's anonymous
 * Firebase user: the page hands over its refresh token, and ID tokens (valid one hour) are renewed
 * here. Offline, the newest position and the track points wait and go in one request when the
 * network is back. Refused by the rules (hunt ended, I was removed): {@link Listener#onDenied()}.
 */
final class PositionPublisher {

    static final String TAG = "polowanie-pos";

    static final class Config {
        /** e.g. https://x-default-rtdb.europe-west1.firebasedatabase.app (no trailing slash needed). */
        String dbUrl;
        /** Web API key, for renewing ID tokens. */
        String apiKey;
        String refreshToken;
        /** Optional: a current ID token and when it expires (ms since 1970), to skip the first renewal. */
        String idToken;
        long idTokenExpiresAt;
        String uid;
        String huntId;
        long heartbeatMs = 30_000;
        double minMoveM = 20;
        /** Token service; changed only by tests. */
        String tokenUrl = "https://securetoken.googleapis.com/v1/token";
    }

    interface Listener {
        /** A position reached the database (time in ms since 1970). */
        void onSent(long at);

        /** The rules refused it, or the sign-in is gone: sharing should stop. */
        void onDenied(PositionPublisher p);
    }

    /** Track points kept while offline (about 25 minutes of walking); newer ones are dropped. */
    private static final int MAX_PENDING_TRACK = 300;
    private static final long MIN_RETRY_MS = 5_000;
    private static final long MAX_RETRY_MS = 60_000;

    private final Config cfg;
    private final String dbBase;
    private final String dbQuery;
    private final Listener listener;
    private final PowerManager.WakeLock wake;
    private final ExecutorService exec = Executors.newSingleThreadExecutor();
    private final Object lock = new Object();

    // Guarded by lock.
    private double lastLat, lastLng;
    private long lastAt;
    private boolean hasLast;
    private double[] pendingPos;
    private final List<double[]> pendingTrack = new ArrayList<>();
    private boolean busy;
    private long retryAt;
    private long backoff;

    // Only used on the executor thread.
    private String idToken;
    private long idTokenExpiresAt;

    private volatile boolean stopped;

    PositionPublisher(Context context, Config cfg, Listener listener) {
        this.cfg = cfg;
        this.listener = listener;
        // The emulator's address names the database in the query: http://10.0.2.2:9000/?ns=demo
        int q = cfg.dbUrl.indexOf('?');
        String base = q < 0 ? cfg.dbUrl : cfg.dbUrl.substring(0, q);
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        dbBase = base;
        dbQuery = q < 0 || q == cfg.dbUrl.length() - 1 ? "" : cfg.dbUrl.substring(q + 1) + "&";
        idToken = cfg.idToken;
        idTokenExpiresAt = cfg.idToken != null ? cfg.idTokenExpiresAt : 0;
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "polowanie:position");
        wake.setReferenceCounted(false);
    }

    String huntId() {
        return cfg.huntId;
    }

    /** Same as roundCoord() in src/hunt.ts: 5 decimals, about 1 m. */
    static double round5(double v) {
        return Math.round(v * 1e5) / 1e5;
    }

    /** Same as sendDecision() in src/hunt.ts. Returns {send, track}. */
    static boolean[] decide(boolean hasLast, double lastLat, double lastLng, long lastAt, double lat, double lng, double acc, long now, long heartbeatMs, double minMoveM) {
        if (!hasLast) return new boolean[] { true, true };
        float[] d = new float[1];
        Location.distanceBetween(lastLat, lastLng, lat, lng, d);
        boolean moved = d[0] >= Math.max(minMoveM, Math.min(acc < 0 ? 0 : acc, 100));
        if (moved) return new boolean[] { true, true };
        return new boolean[] { now - lastAt >= heartbeatMs, false };
    }

    /** A new position from GPS (any thread). */
    void onFix(Location l) {
        if (stopped) return;
        double acc = l.hasAccuracy() ? l.getAccuracy() : -1;
        long now = System.currentTimeMillis();
        synchronized (lock) {
            boolean[] d = decide(hasLast, lastLat, lastLng, lastAt, l.getLatitude(), l.getLongitude(), acc, now, cfg.heartbeatMs, cfg.minMoveM);
            if (d[0]) {
                hasLast = true;
                lastLat = l.getLatitude();
                lastLng = l.getLongitude();
                lastAt = now;
                pendingPos = new double[] { round5(l.getLatitude()), round5(l.getLongitude()), acc };
                if (d[1] && pendingTrack.size() < MAX_PENDING_TRACK) pendingTrack.add(new double[] { pendingPos[0], pendingPos[1] });
            }
            if (pendingPos == null || busy || SystemClock.elapsedRealtime() < retryAt) return;
            busy = true;
        }
        exec.execute(this::flush);
    }

    /** Stop sending; `clear` also removes my position from the map for everyone (best effort). */
    void stop(boolean clear) {
        boolean was = stopped;
        stopped = true;
        if (exec.isShutdown()) return;
        if (clear && !was)
            exec.execute(() -> {
                try {
                    JSONObject body = new JSONObject();
                    body.put("positions/" + cfg.huntId + "/" + cfg.uid, JSONObject.NULL);
                    wake.acquire(20_000);
                    write(body);
                } catch (Exception e) {
                    Log.w(TAG, "clear failed: " + e);
                } finally {
                    wake.release();
                }
            });
        exec.shutdown();
    }

    private void flush() {
        double[] pos;
        List<double[]> track;
        synchronized (lock) {
            pos = pendingPos;
            track = new ArrayList<>(pendingTrack);
        }
        if (pos == null || stopped) {
            synchronized (lock) {
                busy = false;
            }
            return;
        }
        wake.acquire(30_000);
        try {
            int r = write(body(pos, track));
            if (r == DENIED) {
                boolean replaced = stopped;
                stopped = true;
                exec.shutdown();
                Log.w(TAG, "refused by the database rules or sign-in lost: stopping");
                if (!replaced) listener.onDenied(this);
                return;
            }
            synchronized (lock) {
                if (pendingPos == pos) pendingPos = null;
                pendingTrack.subList(0, track.size()).clear();
                backoff = 0;
                retryAt = 0;
            }
            listener.onSent(System.currentTimeMillis());
        } catch (IOException | JSONException e) {
            synchronized (lock) {
                backoff = backoff == 0 ? MIN_RETRY_MS : Math.min(backoff * 2, MAX_RETRY_MS);
                retryAt = SystemClock.elapsedRealtime() + backoff;
            }
            Log.i(TAG, "send failed, retry in " + backoff / 1000 + " s: " + e);
        } finally {
            synchronized (lock) {
                busy = false;
            }
            wake.release();
        }
    }

    private JSONObject body(double[] pos, List<double[]> track) throws JSONException {
        JSONObject sv = new JSONObject().put(".sv", "timestamp");
        JSONObject p = new JSONObject().put("lat", pos[0]).put("lng", pos[1]).put("ts", sv);
        if (pos[2] >= 0 && !Double.isInfinite(pos[2]) && !Double.isNaN(pos[2])) p.put("acc", Math.round(pos[2]));
        JSONObject body = new JSONObject();
        body.put("positions/" + cfg.huntId + "/" + cfg.uid, p);
        for (double[] t : track)
            body.put("tracks/" + cfg.huntId + "/" + cfg.uid + "/" + PushId.next(), new JSONObject().put("lat", t[0]).put("lng", t[1]).put("ts", sv));
        return body;
    }

    private static final int OK = 0;
    private static final int DENIED = 1;

    /** One multi-path update at the database root (PATCH), as update() in the web SDK. */
    private int write(JSONObject body) throws IOException {
        boolean renewed = false;
        if (idToken == null || System.currentTimeMillis() > idTokenExpiresAt - 5 * 60_000) {
            if (!renewToken()) return DENIED;
            renewed = true;
        }
        for (;;) {
            Response r = request(dbBase + "/.json?" + dbQuery + "print=silent&auth=" + URLEncoder.encode(idToken, "UTF-8"), "PATCH", "application/json", body.toString());
            if (r.code >= 200 && r.code < 300) return OK;
            if (r.code == 401 || r.code == 403) {
                // An expired token and a refusal by the rules both answer 401: renew once to tell them
                // apart. Refused again with a fresh token = the rules.
                if (renewed) return DENIED;
                if (!renewToken()) return DENIED;
                renewed = true;
                continue;
            }
            throw new IOException("HTTP " + r.code + " " + r.body);
        }
    }

    /** New ID token from the refresh token. False when the sign-in no longer exists. */
    private boolean renewToken() throws IOException {
        String form = "grant_type=refresh_token&refresh_token=" + URLEncoder.encode(cfg.refreshToken, "UTF-8");
        Response r = request(cfg.tokenUrl + "?key=" + URLEncoder.encode(cfg.apiKey, "UTF-8"), "POST", "application/x-www-form-urlencoded", form);
        if (r.code == 400 || r.code == 403) {
            // TOKEN_EXPIRED, USER_DISABLED, USER_NOT_FOUND, INVALID_REFRESH_TOKEN: will not get better.
            Log.w(TAG, "token renewal refused: " + r.body);
            return false;
        }
        if (r.code != 200) throw new IOException("token HTTP " + r.code);
        try {
            JSONObject o = new JSONObject(r.body);
            idToken = o.getString("id_token");
            idTokenExpiresAt = System.currentTimeMillis() + Long.parseLong(o.optString("expires_in", "3600")) * 1000;
            String rt = o.optString("refresh_token", "");
            if (!rt.isEmpty()) cfg.refreshToken = rt;
            return true;
        } catch (JSONException | NumberFormatException e) {
            throw new IOException("token answer: " + e);
        }
    }

    private static final class Response {
        int code;
        String body;
    }

    private static Response request(String url, String method, String type, String body) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(15_000);
            c.setReadTimeout(20_000);
            c.setDoOutput(true);
            // HttpURLConnection has no PATCH; Firebase's REST API takes this header instead.
            c.setRequestMethod("POST");
            if (!"POST".equals(method)) c.setRequestProperty("X-HTTP-Method-Override", method);
            c.setRequestProperty("Content-Type", type);
            byte[] b = body.getBytes(StandardCharsets.UTF_8);
            c.setFixedLengthStreamingMode(b.length);
            try (OutputStream out = c.getOutputStream()) {
                out.write(b);
            }
            Response r = new Response();
            r.code = c.getResponseCode();
            InputStream in = r.code >= 400 ? c.getErrorStream() : c.getInputStream();
            r.body = in == null ? "" : read(in);
            return r;
        } finally {
            c.disconnect();
        }
    }

    private static String read(InputStream in) throws IOException {
        try (InputStream i = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[2048];
            int n;
            while ((n = i.read(buf)) > 0 && out.size() < 64 * 1024) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    /** Keys like the web SDK's push(): time first, so track points sort by when they were made. */
    static final class PushId {
        private static final String CHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
        private static final SecureRandom RNG = new SecureRandom();
        private static long lastTime;
        private static final int[] lastRandom = new int[12];

        static synchronized String next() {
            long now = System.currentTimeMillis();
            boolean same = now == lastTime;
            lastTime = now;
            char[] ts = new char[8];
            for (int i = 7; i >= 0; i--) {
                ts[i] = CHARS.charAt((int) (now % 64));
                now /= 64;
            }
            StringBuilder id = new StringBuilder(20).append(ts);
            if (!same) for (int i = 0; i < 12; i++) lastRandom[i] = RNG.nextInt(64);
            else {
                int i = 11;
                while (i >= 0 && lastRandom[i] == 63) lastRandom[i--] = 0;
                if (i >= 0) lastRandom[i]++;
            }
            for (int i = 0; i < 12; i++) id.append(CHARS.charAt(lastRandom[i]));
            return id.toString();
        }
    }
}
