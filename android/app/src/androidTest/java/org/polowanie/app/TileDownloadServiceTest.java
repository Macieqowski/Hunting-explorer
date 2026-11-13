package org.polowanie.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.app.UiAutomation;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import androidx.core.content.ContextCompat;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Saves real map tiles (Geoportal orthophoto WMTS, Geoportal topographic WMS, BDL districts WMS)
 * through {@link TileDownloadService} with the screen off and the phone forced into Doze, and
 * checks every tile file is there and is a 256 px image. Needs internet (CI emulator).
 */
@RunWith(AndroidJUnit4.class)
public class TileDownloadServiceTest {

    private static final String TAG = "polowanie-test";
    private static final double O = 20037508.342789244;

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

    /** Same as wmsBlockUrl() in src/tiles.ts. */
    private static String wmsBlock(String base, String layers, String format, boolean transparent, int z, int x, int y, int n) {
        double size = 2 * O / (1 << z);
        double minX = -O + x * size, maxY = O - y * size;
        double maxX = minX + n * size, minY = maxY - n * size;
        return base + "?service=WMS&request=GetMap&version=1.3.0&layers=" + layers + "&styles=&format=" + format.replace("/", "%2F")
            + "&transparent=" + transparent + "&width=" + 256 * n + "&height=" + 256 * n + "&crs=EPSG:3857&bbox="
            + String.format(Locale.ROOT, "%.2f,%.2f,%.2f,%.2f", minX, minY, maxX, maxY);
    }

    private static int fileNo = 0xabc000;

    private static TileDownloadService.Unit unit(int z, int x, int y, int n, String mime) {
        TileDownloadService.Unit u = new TileDownloadService.Unit();
        u.z = z;
        u.x = x;
        u.y = y;
        u.n = n;
        u.mime = mime;
        u.cols = new int[n * n];
        u.rows = new int[n * n];
        u.files = new String[n * n];
        String ext = mime.contains("jpeg") ? "jpg" : "png";
        for (int k = 0; k < n * n; k++) {
            u.cols[k] = k % n;
            u.rows[k] = k / n;
            u.files[k] = String.format(Locale.ROOT, "%014x.%s", fileNo++, ext);
        }
        return u;
    }

    @Test
    public void savesTilesWithTheScreenOffAndInDoze() throws Exception {
        Context ctx = InstrumentationRegistry.getInstrumentation().getTargetContext();
        UiAutomation ui = InstrumentationRegistry.getInstrumentation().getUiAutomation();
        shell(ui, "pm grant " + ctx.getPackageName() + " android.permission.POST_NOTIFICATIONS");

        TileDownloadService.WmtsSource ortho = new TileDownloadService.WmtsSource();
        String wmts = "https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/%s?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTOFOTOMAPA&STYLE=default&FORMAT=image/jpeg&TILEMATRIXSET=EPSG:2180&TILEMATRIX=EPSG:2180:{L}&TILEROW={r}&TILECOL={c}";
        ortho.template = String.format(wmts, "HighResolution");
        ortho.fallback = String.format(wmts, "StandardResolution");
        ortho.scales = new double[] {
            3.0238155714285716E7, 1.5119077857142858E7, 7559538.928571429, 3779769.4642857146, 1889884.7321428573,
            944942.3660714286, 472471.1830357143, 236235.59151785716, 94494.23660714286, 47247.11830357143,
            23623.559151785714, 9449.423660714287, 4724.711830357143, 1889.8847321428573, 944.9423660714286,
            472.4711830357143, 236.23559151785716,
        };
        ortho.originE = 100000;
        ortho.originN = 850000;
        Map<String, TileDownloadService.WmtsSource> sources = new HashMap<>();
        sources.put("ortho", ortho);

        // Warsaw centre, and a forest in the Bieszczady (far from the grid's central meridian).
        List<TileDownloadService.Unit> units = new ArrayList<>();
        for (int[] b : new int[][] { { 17, 73184, 43156 }, { 17, 73188, 43156 }, { 16, 36592, 21576 }, { 19, 295040, 179092 }, { 18, 147520, 89544 } }) {
            TileDownloadService.Unit u = unit(b[0], b[1], b[2], 4, "image/jpeg");
            u.src = "ortho";
            units.add(u);
        }
        TileDownloadService.Unit topo = unit(16, 36592, 21576, 4, "image/jpeg");
        topo.url = wmsBlock("https://mapy.geoportal.gov.pl/wss/service/img/guest/TOPO/MapServer/WMSServer", "Raster", "image/jpeg", false, 16, 36592, 21576, 4);
        units.add(topo);
        TileDownloadService.Unit districts = unit(14, 9148, 5392, 4, "image/png");
        districts.url = wmsBlock("https://mapserver.bdl.lasy.gov.pl/ArcGIS/services/WMS_Obwody_lowieckie/MapServer/WMSServer", "0", "image/png", true, 14, 9148, 5392, 4);
        units.add(districts);

        File dir = new File(ctx.getFilesDir(), "tiles");
        for (TileDownloadService.Unit u : units) for (String f : u.files) //noinspection ResultOfMethodCallIgnored
            new File(dir, f).delete();

        // The app on screen first: Android only lets a visible app start a foreground service.
        try (ActivityScenario<MainActivity> ignored = ActivityScenario.launch(MainActivity.class)) {
            TileDownloadService.Job job = new TileDownloadService.Job("test", "Test", "Test done", "Stop", true, 16, 6, units, sources);
            synchronized (TileDownloadService.LOCK) {
                TileDownloadService.jobs.put(job.id, job);
                TileDownloadService.queue.add(job);
            }
            ContextCompat.startForegroundService(ctx, new Intent(ctx, TileDownloadService.class));
            Thread.sleep(1500);
            String services = shell(ui, "dumpsys activity services " + ctx.getPackageName() + "/.TileDownloadService");
            Log.i(TAG, services);
            assertTrue("foreground service", services.contains("isForeground=true"));

            // Screen off and Doze, as in a pocket.
            shell(ui, "input keyevent KEYCODE_SLEEP");
            shell(ui, "dumpsys deviceidle force-idle");
            long t0 = System.currentTimeMillis();
            try {
                while (!"done".equals(job.state) && !"cancelled".equals(job.state) && System.currentTimeMillis() - t0 < 240_000) Thread.sleep(500);
            } finally {
                Log.i(TAG, "deviceidle: " + shell(ui, "dumpsys deviceidle get deep"));
                shell(ui, "dumpsys deviceidle unforce");
                shell(ui, "input keyevent KEYCODE_WAKEUP");
            }
            double secs = (System.currentTimeMillis() - t0) / 1000.0;
            Log.i(TAG, String.format(Locale.ROOT, "tiles %d done, %d failed of %d in %.1f s (%.1f tiles/s), %d KB", job.done.get(), job.failed.get(), job.total, secs, job.done.get() / secs, job.bytes.get() / 1024));
            assertEquals("done", job.state);
            assertEquals(0, job.failed.get());
            assertEquals(job.total, job.done.get());
            assertEquals(job.total, job.results.size());
            for (TileDownloadService.Unit u : units)
                for (String f : u.files) {
                    File file = new File(dir, f);
                    assertTrue(f, file.length() > 0);
                    Bitmap b = BitmapFactory.decodeFile(file.getPath());
                    assertNotNull(f, b);
                    assertEquals(256, b.getWidth());
                    assertEquals(256, b.getHeight());
                }
            // Warsaw's centre is not blank: the photo is there.
            Bitmap w = BitmapFactory.decodeFile(new File(dir, units.get(0).files[5]).getPath());
            int[] px = new int[256 * 256];
            w.getPixels(px, 0, 256, 0, 0, 256, 256);
            assertTrue("photo, not white", Puwg92.whiteShare(px) < 0.5);
            // Gone once done: the notification and the service.
            Thread.sleep(1500);
            assertTrue(!shell(ui, "dumpsys activity services " + ctx.getPackageName() + "/.TileDownloadService").contains("isForeground=true"));
        }
    }
}
