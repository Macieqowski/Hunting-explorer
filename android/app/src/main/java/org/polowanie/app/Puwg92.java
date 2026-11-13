package org.polowanie.app;

/**
 * Map tiles of the web map (EPSG:3857, 256 px) made from Geoportal's ready-made orthophoto tiles,
 * which only exist in the Polish grid PUWG 1992 (EPSG:2180, 512 px). Geoportal serves those
 * from a cache in well under a second, while drawing the same picture through WMS takes it
 * seconds per image, so saving the photo for offline use is many times faster this way.
 *
 * Plain Java (no Android classes), so it is tested on its own (Puwg92Test).
 */
final class Puwg92 {

    private Puwg92() {}

    // GRS80 ellipsoid and the PUWG 1992 transverse Mercator (EPSG:2180).
    private static final double A = 6378137.0;
    private static final double F = 1 / 298.257222101;
    private static final double E2 = F * (2 - F);
    private static final double E4 = E2 * E2;
    private static final double E6 = E4 * E2;
    private static final double EP2 = E2 / (1 - E2);
    private static final double K0 = 0.9993;
    private static final double LON0 = Math.toRadians(19);
    private static final double FE = 500000;
    private static final double FN = -5300000;
    private static final double M1 = 1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256;
    private static final double M2 = 3 * E2 / 8 + 3 * E4 / 32 + 45 * E6 / 1024;
    private static final double M3 = 15 * E4 / 256 + 45 * E6 / 1024;
    private static final double M4 = 35 * E6 / 3072;

    /** Web Mercator half-width in metres. */
    static final double ORIGIN = 20037508.342789244;
    /** OGC "standardized rendering pixel size" in metres, for WMTS scale denominators. */
    static final double PIXEL = 0.00028;

    /** Latitude and longitude (degrees, ETRS89 ≈ WGS84) to PUWG 1992 {easting, northing} in metres. */
    static void project(double latDeg, double lonDeg, double[] out) {
        double p = Math.toRadians(latDeg);
        double s = Math.sin(p), c = Math.cos(p), t = s / c;
        double n = A / Math.sqrt(1 - E2 * s * s);
        double tt = t * t;
        double cc = EP2 * c * c;
        double a = (Math.toRadians(lonDeg) - LON0) * c;
        double a2 = a * a;
        double m = A * (M1 * p - M2 * Math.sin(2 * p) + M3 * Math.sin(4 * p) - M4 * Math.sin(6 * p));
        out[0] = FE + K0 * n * (a + (1 - tt + cc) * a * a2 / 6 + (5 - 18 * tt + tt * tt + 72 * cc - 58 * EP2) * a * a2 * a2 / 120);
        out[1] = FN + K0 * (m + n * t * (a2 / 2 + (5 - tt + 9 * cc + 4 * cc * cc) * a2 * a2 / 24
            + (61 - 58 * tt + tt * tt + 600 * cc - 330 * EP2) * a2 * a2 * a2 / 720));
    }

    /** Ground size of a web-map pixel at tile (z, y), in metres. */
    static double groundPixel(int z, int y) {
        double size = 2 * ORIGIN / (1 << z);
        double my = ORIGIN - (y + 0.5) * size;
        double lat = Math.atan(Math.sinh(my / ORIGIN * Math.PI));
        return size / 256 * Math.cos(lat);
    }

    /** The coarsest level whose pixels are no bigger than `ground` metres (the finest if none is). */
    static int level(double[] scales, double ground) {
        for (int i = 0; i < scales.length; i++) if (scales[i] * PIXEL <= ground) return i;
        return scales.length - 1;
    }

    /**
     * For each pixel of web-map tile (z, x, y), its position in the PUWG 1992 level with pixel
     * size `px` and top-left corner (originE, originN), as pixel coordinates from that corner
     * (pixel centres at .5). Exact on a 17×17 grid, bilinear in between: the error is far below
     * a pixel. Returns {fx[], fy[]} of 256×256 values, row by row.
     */
    static float[][] sourcePixels(int z, int x, int y, double px, double originE, double originN) {
        final int g = 17, step = 16;
        double size = 2 * ORIGIN / (1 << z);
        double mpp = size / 256;
        double[] gx = new double[g * g], gy = new double[g * g];
        double[] en = new double[2];
        for (int j = 0; j < g; j++) {
            double my = ORIGIN - y * size - j * step * mpp;
            double lat = Math.toDegrees(Math.atan(Math.sinh(my / ORIGIN * Math.PI)));
            for (int i = 0; i < g; i++) {
                double mx = -ORIGIN + x * size + i * step * mpp;
                project(lat, mx / ORIGIN * 180, en);
                gx[j * g + i] = (en[0] - originE) / px;
                gy[j * g + i] = (originN - en[1]) / px;
            }
        }
        float[] fx = new float[256 * 256], fy = new float[256 * 256];
        for (int py = 0; py < 256; py++) {
            double v = (py + 0.5) / step;
            int j = Math.min((int) v, g - 2);
            double dv = v - j;
            for (int pxl = 0; pxl < 256; pxl++) {
                double u = (pxl + 0.5) / step;
                int i = Math.min((int) u, g - 2);
                double du = u - i;
                int k = j * g + i;
                double w00 = (1 - du) * (1 - dv), w10 = du * (1 - dv), w01 = (1 - du) * dv, w11 = du * dv;
                fx[py * 256 + pxl] = (float) (gx[k] * w00 + gx[k + 1] * w10 + gx[k + g] * w01 + gx[k + g + 1] * w11 - 0.5);
                fy[py * 256 + pxl] = (float) (gy[k] * w00 + gy[k + 1] * w10 + gy[k + g] * w01 + gy[k + g + 1] * w11 - 0.5);
            }
        }
        return new float[][] { fx, fy };
    }

    /** Source tiles a sourcePixels() result needs: {col0, row0, col1, row1}, inclusive. */
    static int[] tileRange(float[][] f, int tileSize) {
        float minX = Float.MAX_VALUE, minY = Float.MAX_VALUE, maxX = -Float.MAX_VALUE, maxY = -Float.MAX_VALUE;
        for (int k = 0; k < f[0].length; k++) {
            minX = Math.min(minX, f[0][k]);
            maxX = Math.max(maxX, f[0][k]);
            minY = Math.min(minY, f[1][k]);
            maxY = Math.max(maxY, f[1][k]);
        }
        return new int[] {
            (int) Math.floor(Math.floor(minX) / tileSize),
            (int) Math.floor(Math.floor(minY) / tileSize),
            (int) Math.floor((Math.floor(maxX) + 1) / tileSize),
            (int) Math.floor((Math.floor(maxY) + 1) / tileSize),
        };
    }

    /**
     * Draws the tile: bilinear samples of the source tiles. `tiles[r][c]` holds the ARGB pixels of
     * source tile (col0 + c, row0 + r), or null where there is none (drawn white).
     */
    static int[] render(float[][] f, int[][][] tiles, int col0, int row0, int tileSize) {
        int[] out = new int[256 * 256];
        int rows = tiles.length, cols = tiles[0].length;
        int x0 = col0 * tileSize, y0 = row0 * tileSize;
        for (int k = 0; k < out.length; k++) {
            float sx = f[0][k] - x0, sy = f[1][k] - y0;
            int ix = (int) Math.floor(sx), iy = (int) Math.floor(sy);
            float dx = sx - ix, dy = sy - iy;
            int p00 = pixel(tiles, ix, iy, tileSize, rows, cols);
            int p10 = pixel(tiles, ix + 1, iy, tileSize, rows, cols);
            int p01 = pixel(tiles, ix, iy + 1, tileSize, rows, cols);
            int p11 = pixel(tiles, ix + 1, iy + 1, tileSize, rows, cols);
            float w00 = (1 - dx) * (1 - dy), w10 = dx * (1 - dy), w01 = (1 - dx) * dy, w11 = dx * dy;
            int r = Math.round(((p00 >> 16) & 0xff) * w00 + ((p10 >> 16) & 0xff) * w10 + ((p01 >> 16) & 0xff) * w01 + ((p11 >> 16) & 0xff) * w11);
            int g = Math.round(((p00 >> 8) & 0xff) * w00 + ((p10 >> 8) & 0xff) * w10 + ((p01 >> 8) & 0xff) * w01 + ((p11 >> 8) & 0xff) * w11);
            int b = Math.round((p00 & 0xff) * w00 + (p10 & 0xff) * w10 + (p01 & 0xff) * w01 + (p11 & 0xff) * w11);
            out[k] = 0xff000000 | (Math.min(255, r) << 16) | (Math.min(255, g) << 8) | Math.min(255, b);
        }
        return out;
    }

    private static int pixel(int[][][] tiles, int x, int y, int size, int rows, int cols) {
        int c = Math.floorDiv(x, size), r = Math.floorDiv(y, size);
        if (r < 0 || c < 0 || r >= rows || c >= cols) return 0xffffffff;
        int[] t = tiles[r][c];
        if (t == null) return 0xffffffff;
        return t[Math.floorMod(y, size) * size + Math.floorMod(x, size)];
    }

    /** Share of near-white pixels (all channels ≥ 248), sampled. */
    static double whiteShare(int[] px) {
        int white = 0, n = 0;
        for (int k = 0; k < px.length; k += 61) {
            int p = px[k];
            n++;
            if (((p >> 16) & 0xff) >= 248 && ((p >> 8) & 0xff) >= 248 && (p & 0xff) >= 248) white++;
        }
        return n == 0 ? 1 : (double) white / n;
    }

    /** Puts `fill`'s pixels where `px` is blank white (gaps in the high-resolution photo). */
    static void fillWhite(int[] px, int[] fill) {
        for (int k = 0; k < px.length && k < fill.length; k++) {
            int p = px[k];
            if (((p >> 16) & 0xff) >= 250 && ((p >> 8) & 0xff) >= 250 && (p & 0xff) >= 250) px[k] = fill[k];
        }
    }
}
