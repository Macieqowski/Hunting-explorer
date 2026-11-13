package org.polowanie.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.webkit.WebSettings;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Saves offline map tiles with the screen off. Android stops a WebView page soon after the screen
 * goes dark, so the downloading itself lives here, in a foreground service that holds a wake
 * lock and a Wi-Fi lock and shows a notification with progress and a Stop button.
 *
 * The web code (src/offline.ts through {@link TileDownloadPlugin}) hands over a job: the WMS
 * images to fetch ("units", one image of n×n map tiles each) and the file name of every tile.
 * Each image is cut into 256 px tiles written to files/tiles/ (the same files src/tileFiles.ts
 * reads). The web code then asks which tiles are done and records them in its database, so it
 * catches up whenever it runs again, also after the screen comes back on.
 *
 * Jobs run one after another; the service stops itself when none is left.
 */
public class TileDownloadService extends Service {

    static final String CHANNEL = "downloads";
    static final int NOTIFICATION_ID = 1002;
    static final int DONE_NOTIFICATION_ID = 1003;
    static final String ACTION_STOP = "org.polowanie.app.STOP_DOWNLOADS";
    static final String ACTION_KICK = "org.polowanie.app.KICK_DOWNLOADS";

    /** One image to fetch and the tiles to cut from it, or (src set) tiles drawn from a WMTS source. */
    static final class Unit {
        String url;
        /** WMTS source id (job.sources): the tiles are drawn from its ready-made tiles instead. */
        String src;
        /** Web-map tile of the top-left tile (WMTS units). */
        int z, x, y;
        /** Server to ask for the same image when a tile comes out blank white (Geoportal ortho). */
        String fallback;
        int n;
        String mime;
        int[] cols;
        int[] rows;
        String[] files;
    }

    /** Ready-made tiles in PUWG 1992 (Geoportal orthophoto WMTS), see {@link Puwg92}. */
    static final class WmtsSource {
        /** GetTile URL with {L}, {r} and {c} for level, row and column. */
        String template;
        /** The same from the server to use where the first one has no photo (blank white or empty). */
        String fallback;
        double[] scales;
        double originE, originN;
        int size = 512;
    }

    static final class Job {
        final String id;
        final String title;
        final String doneTitle;
        final String stopLabel;
        final boolean refresh;
        final int concurrency;
        final List<Unit> units;
        final java.util.Map<String, WmtsSource> sources;
        final int total;
        /** Decoded WMTS tiles shared by neighbouring units, most recently used last. */
        final java.util.LinkedHashMap<String, java.util.concurrent.FutureTask<int[]>> cache = new java.util.LinkedHashMap<String, java.util.concurrent.FutureTask<int[]>>(64, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(java.util.Map.Entry<String, java.util.concurrent.FutureTask<int[]>> e) {
                return size() > 48;
            }
        };
        /** Server drawn (WMS) images fetched at once: those servers slow down with more. */
        final java.util.concurrent.Semaphore wmsSlots;
        final AtomicInteger next = new AtomicInteger();
        final AtomicInteger done = new AtomicInteger();
        final AtomicInteger failed = new AtomicInteger();
        final AtomicLong bytes = new AtomicLong();
        /** [unit, tile, bytes] of every tile written (or already there), in order. */
        final List<int[]> results = new ArrayList<>();
        volatile String state = "queued";
        volatile boolean cancelled;
        volatile boolean waitingForSignal;

        Job(String id, String title, String doneTitle, String stopLabel, boolean refresh, int concurrency, int wmsConcurrency, List<Unit> units, java.util.Map<String, WmtsSource> sources) {
            this.id = id;
            this.title = title;
            this.doneTitle = doneTitle;
            this.stopLabel = stopLabel;
            this.refresh = refresh;
            this.concurrency = Math.max(1, Math.min(32, concurrency));
            this.units = units;
            this.sources = sources;
            this.wmsSlots = new java.util.concurrent.Semaphore(Math.max(1, Math.min(this.concurrency, wmsConcurrency)));
            int t = 0;
            for (Unit u : units) t += u.files.length;
            this.total = t;
        }

        void result(int unit, int tile, int size) {
            synchronized (results) {
                results.add(new int[] { unit, tile, size });
            }
        }
    }

    // Shared with the plugin; all access under LOCK.
    static final Object LOCK = new Object();
    static final ArrayDeque<Job> queue = new ArrayDeque<>();
    /** Every job the web code has not forgotten yet, by id (queued, running or finished). */
    static final java.util.HashMap<String, Job> jobs = new java.util.HashMap<>();
    static Job current;

    private static final long OFFLINE_WAIT_MS = 15 * 60_000L;

    /** Guarded by LOCK. */
    private Thread runner;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private String userAgent;
    private long lastNotified;
    private volatile int lastStartId;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        lastStartId = startId;
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            synchronized (LOCK) {
                for (Job j : queue) cancelJob(j);
                queue.clear();
                if (current != null) cancelJob(current);
            }
            synchronized (LOCK) {
                if (runner == null) finish();
            }
            return START_NOT_STICKY;
        }
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            progressNotification(peekJob()),
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC : 0
        );
        synchronized (LOCK) {
            if (runner == null) {
                acquireLocks();
                runner = new Thread(this::runJobs, "tile-downloads");
                runner.start();
            }
        }
        return START_NOT_STICKY;
    }

    private static void cancelJob(Job j) {
        j.cancelled = true;
        if ("queued".equals(j.state)) j.state = "cancelled";
    }

    private Job peekJob() {
        synchronized (LOCK) {
            return current != null ? current : queue.peek();
        }
    }

    private void runJobs() {
        while (true) {
            Job job;
            synchronized (LOCK) {
                job = queue.poll();
                current = job;
                if (job == null) {
                    // Under the lock, so a job added now starts a new runner instead of being missed.
                    runner = null;
                    finish();
                    return;
                }
            }
            if (job.cancelled) {
                job.state = "cancelled";
                continue;
            }
            try {
                runJob(job);
            } catch (Throwable t) {
                job.state = "cancelled";
            }
            if (!job.cancelled && job.doneTitle != null) notifyDone(job);
        }
    }

    private void finish() {
        releaseLocks();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        // Only if no start came in meanwhile: that one has a new job and starts a new runner.
        stopSelf(lastStartId);
    }

    private void runJob(Job job) {
        job.state = "running";
        updateNotification(job, true);
        ExecutorService pool = Executors.newFixedThreadPool(job.concurrency);
        for (int w = 0; w < job.concurrency; w++) pool.execute(() -> work(job));
        pool.shutdown();
        try {
            while (!pool.awaitTermination(1, TimeUnit.SECONDS)) updateNotification(job, false);
        } catch (InterruptedException e) {
            job.cancelled = true;
            pool.shutdownNow();
        }
        job.state = job.cancelled ? "cancelled" : "done";
    }

    private void work(Job job) {
        while (!job.cancelled) {
            int i = job.next.getAndIncrement();
            if (i >= job.units.size()) return;
            Unit u = job.units.get(i);
            int[] ok = { 0 };
            try {
                doUnit(job, i, u, ok);
            } catch (Throwable t) {
                // Out of memory on a huge image, a full disk…: the unit's missing tiles count as failed.
                android.util.Log.w("polowanie", "tile download unit " + i + " failed", t);
                job.failed.addAndGet(Math.max(0, u.files.length - ok[0]));
            }
        }
    }

    private void doUnit(Job job, int ui, Unit u, int[] ok) throws IOException {
        File dir = new File(getFilesDir(), "tiles");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        List<Integer> need = new ArrayList<>();
        for (int t = 0; t < u.files.length; t++) {
            File f = new File(dir, u.files[t]);
            // Not an update: a tile already on the phone (another saved area, an interrupted save) stays.
            if (!job.refresh && f.length() > 0) {
                job.result(ui, t, (int) f.length());
                job.done.incrementAndGet();
                ok[0]++;
            } else need.add(t);
        }
        if (need.isEmpty()) return;
        if (u.src != null) {
            doWmtsUnit(job, ui, u, need, dir, ok);
            return;
        }

        byte[] img;
        job.wmsSlots.acquireUninterruptibly();
        try {
            img = fetch(job, u.url);
        } finally {
            job.wmsSlots.release();
        }
        if (img == null) {
            job.failed.addAndGet(need.size());
            ok[0] = u.files.length;
            return;
        }
        // One tile in its own image: kept as it came, unless blank.
        if (u.n == 1) {
            if (u.fallback != null && whiteShare(img) >= 0.4) {
                job.wmsSlots.acquireUninterruptibly();
                try {
                    byte[] other = fetch(job, u.fallback);
                    if (other != null) img = other;
                } finally {
                    job.wmsSlots.release();
                }
            }
            write(dir, u.files[need.get(0)], img);
            job.result(ui, need.get(0), img.length);
            job.done.incrementAndGet();
            ok[0]++;
            job.bytes.addAndGet(img.length);
            return;
        }
        Bitmap bmp = decode(img);
        if (bmp == null) {
            job.failed.addAndGet(need.size());
            ok[0] = u.files.length;
            return;
        }
        Bitmap other = null;
        boolean triedOther = false;
        boolean jpeg = u.mime.contains("jpeg") || u.mime.contains("jpg");
        try {
            for (int t : need) {
                if (job.cancelled) return;
                int x = u.cols[t] * 256, y = u.rows[t] * 256;
                if (x + 256 > bmp.getWidth() || y + 256 > bmp.getHeight()) {
                    job.failed.incrementAndGet();
                    ok[0]++;
                    continue;
                }
                Bitmap src = bmp;
                if (u.fallback != null && whiteShare(bmp, x, y) >= 0.4) {
                    if (!triedOther) {
                        triedOther = true;
                        job.wmsSlots.acquireUninterruptibly();
                        try {
                            byte[] o = fetch(job, u.fallback);
                            if (o != null) other = decode(o);
                        } finally {
                            job.wmsSlots.release();
                        }
                    }
                    if (other != null && other.getWidth() == bmp.getWidth()) src = other;
                }
                Bitmap tile = Bitmap.createBitmap(src, x, y, 256, 256);
                ByteArrayOutputStream out = new ByteArrayOutputStream(jpeg ? 24_000 : 8_000);
                tile.compress(jpeg ? Bitmap.CompressFormat.JPEG : Bitmap.CompressFormat.PNG, 90, out);
                tile.recycle();
                byte[] data = out.toByteArray();
                write(dir, u.files[t], data);
                job.result(ui, t, data.length);
                job.done.incrementAndGet();
                job.bytes.addAndGet(data.length);
                ok[0]++;
            }
        } finally {
            bmp.recycle();
            if (other != null) other.recycle();
        }
    }

    // ---------------------------------------------------------------- tiles drawn from WMTS

    private void doWmtsUnit(Job job, int ui, Unit u, List<Integer> need, File dir, int[] ok) throws IOException {
        WmtsSource src = job.sources.get(u.src);
        if (src == null) {
            job.failed.addAndGet(need.size());
            ok[0] = u.files.length;
            return;
        }
        boolean jpeg = u.mime.contains("jpeg") || u.mime.contains("jpg");
        for (int t : need) {
            if (job.cancelled) return;
            int tx = u.x + u.cols[t], ty = u.y + u.rows[t];
            int level = Puwg92.level(src.scales, Puwg92.groundPixel(u.z, ty));
            double px = src.scales[level] * Puwg92.PIXEL;
            float[][] f = Puwg92.sourcePixels(u.z, tx, ty, px, src.originE, src.originN);
            int[] range = Puwg92.tileRange(f, src.size);
            int cols = range[2] - range[0] + 1, rows = range[3] - range[1] + 1;
            if (cols > 4 || rows > 4) {
                // Never for the zooms that are saved; a guard against a wrong level table.
                job.failed.incrementAndGet();
                ok[0]++;
                continue;
            }
            int[][][] tiles = new int[rows][cols][];
            boolean missing = false;
            for (int r = 0; r < rows && !missing; r++)
                for (int c = 0; c < cols && !missing; c++) {
                    int[] got = wmtsTile(job, src, level, range[1] + r, range[0] + c);
                    if (got == null) missing = true;
                    else tiles[r][c] = got.length == 0 ? null : got;
                }
            if (missing) {
                job.failed.incrementAndGet();
                ok[0]++;
                continue;
            }
            int[] pixels = Puwg92.render(f, tiles, range[0], range[1], src.size);
            Bitmap tile = Bitmap.createBitmap(pixels, 256, 256, Bitmap.Config.ARGB_8888);
            ByteArrayOutputStream out = new ByteArrayOutputStream(jpeg ? 24_000 : 8_000);
            tile.compress(jpeg ? Bitmap.CompressFormat.JPEG : Bitmap.CompressFormat.PNG, 90, out);
            tile.recycle();
            byte[] data = out.toByteArray();
            write(dir, u.files[t], data);
            job.result(ui, t, data.length);
            job.done.incrementAndGet();
            job.bytes.addAndGet(data.length);
            ok[0]++;
        }
    }

    /**
     * A WMTS tile's pixels: from the job's cache, or fetched once however many workers want it.
     * An empty array means the server has no photo there (drawn white); null that fetching failed.
     */
    private int[] wmtsTile(Job job, WmtsSource src, int level, int row, int col) {
        String key = level + "/" + row + "/" + col;
        java.util.concurrent.FutureTask<int[]> task;
        boolean mine = false;
        synchronized (job.cache) {
            task = job.cache.get(key);
            if (task == null) {
                task = new java.util.concurrent.FutureTask<>(() -> loadWmtsTile(job, src, level, row, col));
                job.cache.put(key, task);
                mine = true;
            }
        }
        if (mine) task.run();
        try {
            int[] got = task.get();
            if (got == null) {
                // Failed: forget it, so a later unit tries again.
                synchronized (job.cache) {
                    if (job.cache.get(key) == task) job.cache.remove(key);
                }
            }
            return got;
        } catch (Exception e) {
            return null;
        }
    }

    private int[] loadWmtsTile(Job job, WmtsSource src, int level, int row, int col) {
        int[] main = wmtsPixels(job, src.template, src, level, row, col);
        if (main == null || src.fallback == null) return main;
        // No photo or a part of it missing in the high-resolution set: fill from the other one.
        if (main.length == 0 || Puwg92.whiteShare(main) >= 0.3) {
            int[] other = wmtsPixels(job, src.fallback, src, level, row, col);
            if (other == null) return main;
            if (main.length == 0) return other;
            if (other.length == src.size * src.size) Puwg92.fillWhite(main, other);
        }
        return main;
    }

    /** null: failed; empty: the server answered with no image (no photo there). */
    private int[] wmtsPixels(Job job, String template, WmtsSource src, int level, int row, int col) {
        String url = template.replace("{L}", Integer.toString(level)).replace("{r}", Integer.toString(row)).replace("{c}", Integer.toString(col));
        byte[] img = fetch(job, url, true);
        if (img == null) return null;
        if (img.length == 0) return new int[0];
        Bitmap b = decode(img);
        if (b == null) return new int[0];
        try {
            if (b.getWidth() != src.size || b.getHeight() != src.size) return new int[0];
            int[] px = new int[src.size * src.size];
            b.getPixels(px, 0, src.size, 0, 0, src.size, src.size);
            return px;
        } finally {
            b.recycle();
        }
    }

    private static Bitmap decode(byte[] img) {
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inPreferredConfig = Bitmap.Config.ARGB_8888;
        return BitmapFactory.decodeByteArray(img, 0, img.length, o);
    }

    /** Share of near-white pixels in a whole image, sampled on a 32×32 grid. */
    private static double whiteShare(byte[] img) {
        Bitmap b = decode(img);
        if (b == null) return 0;
        try {
            return whiteShare(b, 0, 0, b.getWidth());
        } finally {
            b.recycle();
        }
    }

    private static double whiteShare(Bitmap b, int x, int y) {
        return whiteShare(b, x, y, 256);
    }

    private static double whiteShare(Bitmap b, int x, int y, int size) {
        int white = 0;
        for (int j = 0; j < 32; j++)
            for (int i = 0; i < 32; i++) {
                int p = b.getPixel(x + i * size / 32, y + j * size / 32);
                if (((p >> 16) & 0xff) >= 248 && ((p >> 8) & 0xff) >= 248 && (p & 0xff) >= 248) white++;
            }
        return white / 1024.0;
    }

    /** Writes through a temporary file, so a tile file is never half written. */
    private static void write(File dir, String name, byte[] data) throws IOException {
        File tmp = new File(dir, name + ".part");
        try (FileOutputStream f = new FileOutputStream(tmp)) {
            f.write(data);
        }
        File dest = new File(dir, name);
        if (!tmp.renameTo(dest)) {
            //noinspection ResultOfMethodCallIgnored
            dest.delete();
            if (!tmp.renameTo(dest)) throw new IOException("rename failed");
        }
    }

    private byte[] fetch(Job job, String url) {
        return fetch(job, url, false);
    }

    /**
     * Fetches an image, retrying server hiccups, and waiting (up to 15 minutes) for signal.
     * `allowEmpty`: an empty 200 answer (Geoportal WMTS where it has no photo) returns an empty array.
     */
    private byte[] fetch(Job job, String url, boolean allowEmpty) {
        for (int attempt = 0; attempt < 4 && !job.cancelled; attempt++) {
            if (!waitForSignal(job)) return null;
            if (attempt > 0) sleep(400L * (long) Math.pow(3, attempt - 1));
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(20_000);
                c.setReadTimeout(60_000);
                c.setRequestProperty("User-Agent", userAgent());
                c.setRequestProperty("Accept", "image/*");
                int code = c.getResponseCode();
                String type = c.getContentType();
                if (allowEmpty && code == 200 && c.getContentLength() == 0) return new byte[0];
                if (code == 200 && type != null && type.startsWith("image/")) {
                    try (InputStream in = c.getInputStream()) {
                        ByteArrayOutputStream out = new ByteArrayOutputStream(64_000);
                        byte[] buf = new byte[16_384];
                        int r;
                        while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
                        return out.toByteArray();
                    }
                }
                drain(c);
            } catch (IOException e) {
                // Retry.
            } finally {
                if (c != null) c.disconnect();
            }
        }
        return null;
    }

    private static void drain(HttpURLConnection c) {
        try (InputStream in = c.getErrorStream() != null ? c.getErrorStream() : c.getInputStream()) {
            byte[] buf = new byte[4096];
            //noinspection StatementWithEmptyBody
            while (in != null && in.read(buf) > 0) {}
        } catch (IOException ignored) {}
    }

    /** The WebView's user agent: the State Forests' server refuses unknown clients. */
    private String userAgent() {
        if (userAgent == null) {
            try {
                userAgent = WebSettings.getDefaultUserAgent(this);
            } catch (Exception e) {
                userAgent = System.getProperty("http.agent", "Polowanie");
            }
        }
        return userAgent;
    }

    private boolean waitForSignal(Job job) {
        long until = System.currentTimeMillis() + OFFLINE_WAIT_MS;
        while (!online()) {
            if (job.cancelled || System.currentTimeMillis() > until) return false;
            job.waitingForSignal = true;
            sleep(3000);
        }
        job.waitingForSignal = false;
        return !job.cancelled;
    }

    private boolean online() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            Network n = cm.getActiveNetwork();
            if (n == null) return false;
            NetworkCapabilities caps = cm.getNetworkCapabilities(n);
            return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        } catch (SecurityException e) {
            // Without ACCESS_NETWORK_STATE: just try.
            return true;
        }
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    // ---------------------------------------------------------------- locks

    @SuppressWarnings("deprecation")
    private void acquireLocks() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null && wakeLock == null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "polowanie:tiles");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire(6 * 3600_000L);
        }
        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm != null && wifiLock == null) {
            wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "polowanie:tiles");
            wifiLock.setReferenceCounted(false);
            wifiLock.acquire();
        }
    }

    private void releaseLocks() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        wifiLock = null;
    }

    // ---------------------------------------------------------------- notifications

    private void ensureChannel() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Zapisywanie map", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Postęp zapisywania map offline.");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
    }

    private PendingIntent openApp() {
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification progressNotification(Job job) {
        ensureChannel();
        PendingIntent stopPi = PendingIntent.getService(
            this,
            2,
            new Intent(this, TileDownloadService.class).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_polowanie)
            .setContentTitle(job != null ? job.title : "Polowanie")
            .setContentIntent(openApp())
            .addAction(0, job != null ? job.stopLabel : "Stop", stopPi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);
        if (job != null && job.total > 0) {
            int done = job.done.get();
            int pct = (int) Math.floor(100.0 * done / job.total);
            String text = String.format(Locale.getDefault(), "%d%% · %,d / %,d", pct, done, job.total);
            if (job.failed.get() > 0) text += String.format(Locale.getDefault(), " · ✕ %,d", job.failed.get());
            if (job.waitingForSignal) text += " · …";
            b.setContentText(text).setProgress(job.total, done, false);
        } else b.setProgress(0, 0, true);
        return b.build();
    }

    private void updateNotification(Job job, boolean force) {
        long now = System.currentTimeMillis();
        if (!force && now - lastNotified < 1000) return;
        lastNotified = now;
        try {
            NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, progressNotification(job));
        } catch (SecurityException ignored) {
            // No notification permission: the download goes on without one.
        }
    }

    private void notifyDone(Job job) {
        ensureChannel();
        String text = String.format(Locale.getDefault(), "%,d / %,d", job.done.get(), job.total);
        Notification n = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_polowanie)
            .setContentTitle(job.doneTitle)
            .setContentText(text)
            .setContentIntent(openApp())
            .setAutoCancel(true)
            .build();
        try {
            NotificationManagerCompat.from(this).notify(DONE_NOTIFICATION_ID, n);
        } catch (SecurityException ignored) {}
    }

    /** Android 15+: a data-sync service may run 6 hours a day; past that it must stop. */
    @Override
    public void onTimeout(int startId, int fgsType) {
        synchronized (LOCK) {
            for (Job j : queue) cancelJob(j);
            queue.clear();
            if (current != null) cancelJob(current);
        }
        finish();
    }

    @Override
    public void onDestroy() {
        releaseLocks();
        super.onDestroy();
    }
}
