package org.polowanie.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class Puwg92Test {

    /** Geoportal ORTO WMTS, EPSG:2180 tile matrix set (scale denominators). */
    static final double[] SCALES = {
        3.0238155714285716E7, 1.5119077857142858E7, 7559538.928571429, 3779769.4642857146, 1889884.7321428573,
        944942.3660714286, 472471.1830357143, 236235.59151785716, 94494.23660714286, 47247.11830357143,
        23623.559151785714, 9449.423660714287, 4724.711830357143, 1889.8847321428573, 944.9423660714286,
        472.4711830357143, 236.23559151785716,
    };

    private static void near(double lat, double lon, double e, double n) {
        double[] out = new double[2];
        Puwg92.project(lat, lon, out);
        // Reference values from proj4 (+proj=tmerc +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80).
        assertEquals(e, out[0], 0.01);
        assertEquals(n, out[1], 0.01);
    }

    @Test
    public void projectsLikeProj4AcrossPoland() {
        near(52.2318, 21.006, 636952.481, 486978.944); // Warsaw
        near(54.5, 14.2, 189356.402, 747945.613); // far north-west
        near(49.1, 24.1, 872097.678, 149472.961); // far south-east
        near(54.83, 18.3, 455046.776, 774275.244);
        near(50.0, 19.0, 500000.0, 236968.449); // central meridian
    }

    @Test
    public void picksTheCoarsestLevelFineEnough() {
        // Web-map zoom → level whose pixel is at most the ground pixel at 52° N.
        int y16 = 21647, y17 = 43295, y18 = 86590, y19 = 173180; // 52° N
        assertEquals(12, Puwg92.level(SCALES, Puwg92.groundPixel(16, y16)));
        assertEquals(13, Puwg92.level(SCALES, Puwg92.groundPixel(17, y17)));
        assertEquals(14, Puwg92.level(SCALES, Puwg92.groundPixel(18, y18)));
        assertEquals(15, Puwg92.level(SCALES, Puwg92.groundPixel(19, y19)));
        assertEquals(16, Puwg92.level(SCALES, 0.01));
    }

    @Test
    public void mapsTilePixelsOntoTheGrid() {
        // Web-map tile z17 holding the Palace of Culture in Warsaw; level 13 (0.53 m pixels).
        int z = 17;
        int x = (int) Math.floor((21.006 + 180) / 360 * (1 << z));
        double r = Math.toRadians(52.2318);
        int y = (int) Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * (1 << z));
        double px = SCALES[13] * Puwg92.PIXEL;
        float[][] f = Puwg92.sourcePixels(z, x, y, px, 100000, 850000);
        // The tile's centre: its PUWG coordinates, worked out directly.
        double size = 2 * Puwg92.ORIGIN / (1 << z);
        double mx = -Puwg92.ORIGIN + (x + 0.5) * size, my = Puwg92.ORIGIN - (y + 0.5) * size;
        double[] en = new double[2];
        Puwg92.project(Math.toDegrees(Math.atan(Math.sinh(my / Puwg92.ORIGIN * Math.PI))), mx / Puwg92.ORIGIN * 180, en);
        // Pixel (128, 128) has its centre half a pixel past the tile's centre.
        double half = size / 256 / 2;
        double[] en2 = new double[2];
        Puwg92.project(Math.toDegrees(Math.atan(Math.sinh((my - half) / Puwg92.ORIGIN * Math.PI))), (mx + half) / Puwg92.ORIGIN * 180, en2);
        assertEquals((en2[0] - 100000) / px - 0.5, f[0][128 * 256 + 128], 0.05);
        assertEquals((850000 - en2[1]) / px - 0.5, f[1][128 * 256 + 128], 0.05);
        int[] range = Puwg92.tileRange(f, 512);
        assertTrue(range[2] - range[0] <= 1 && range[3] - range[1] <= 1);
    }

    @Test
    public void rendersAndFillsGaps() {
        // A uniform source draws a uniform tile; a missing source draws white.
        int[] grey = new int[512 * 512];
        java.util.Arrays.fill(grey, 0xff808080);
        float[][] f = Puwg92.sourcePixels(17, 72000, 43000, SCALES[13] * Puwg92.PIXEL, 100000, 850000);
        int[] range = Puwg92.tileRange(f, 512);
        int rows = range[3] - range[1] + 1, cols = range[2] - range[0] + 1;
        int[][][] tiles = new int[rows][cols][];
        for (int[][] row : tiles) java.util.Arrays.fill(row, grey);
        int[] out = Puwg92.render(f, tiles, range[0], range[1], 512);
        for (int p : out) assertEquals(0xff808080, p);
        int[][][] none = new int[rows][cols][];
        out = Puwg92.render(f, none, range[0], range[1], 512);
        assertEquals(1.0, Puwg92.whiteShare(out), 0);

        int[] px = { 0xffffffff, 0xff102030, 0xfffafafa };
        Puwg92.fillWhite(px, new int[] { 0xff010101, 0xff020202, 0xff030303 });
        assertArrayEquals(new int[] { 0xff010101, 0xff102030, 0xff030303 }, px);
    }
}
