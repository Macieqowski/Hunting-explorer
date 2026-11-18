import Foundation

/// Web-map tiles (EPSG:3857, 256 px) drawn from Geoportal's ready-made orthophoto tiles in the
/// Polish grid PUWG 1992 (EPSG:2180). A port of Puwg92.java (Android) and src/puwg92.ts:
/// same maths, same thresholds. Pixels are ARGB in a UInt32 (0xAARRGGBB), as Android's ints.
enum Puwg92 {
    // GRS80 ellipsoid and the PUWG 1992 transverse Mercator (EPSG:2180).
    private static let A = 6378137.0
    private static let F = 1 / 298.257222101
    private static let E2 = F * (2 - F)
    private static let E4 = E2 * E2
    private static let E6 = E4 * E2
    private static let EP2 = E2 / (1 - E2)
    private static let K0 = 0.9993
    private static let LON0 = 19.0 * .pi / 180
    private static let FE = 500000.0
    private static let FN = -5300000.0
    private static let M1 = 1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256
    private static let M2 = 3 * E2 / 8 + 3 * E4 / 32 + 45 * E6 / 1024
    private static let M3 = 15 * E4 / 256 + 45 * E6 / 1024
    private static let M4 = 35 * E6 / 3072

    /// Web Mercator half-width in metres.
    static let ORIGIN = 20037508.342789244
    /// OGC "standardized rendering pixel size" in metres, for WMTS scale denominators.
    static let PIXEL = 0.00028
    /// Darkest a channel may be to count as black; same as BLACK in src/offlineStore.ts.
    static let BLACK: UInt32 = 6

    /// Latitude and longitude (degrees) to PUWG 1992 (easting, northing) in metres.
    static func project(_ latDeg: Double, _ lonDeg: Double) -> (Double, Double) {
        let p = latDeg * .pi / 180
        let s = sin(p), c = cos(p), t = s / c
        let n = A / (1 - E2 * s * s).squareRoot()
        let tt = t * t
        let cc = EP2 * c * c
        let a = (lonDeg * .pi / 180 - LON0) * c
        let a2 = a * a
        let m = A * (M1 * p - M2 * sin(2 * p) + M3 * sin(4 * p) - M4 * sin(6 * p))
        let e = FE + K0 * n * (a + (1 - tt + cc) * a * a2 / 6 + (5 - 18 * tt + tt * tt + 72 * cc - 58 * EP2) * a * a2 * a2 / 120)
        let t1 = a2 / 2 + (5 - tt + 9 * cc + 4 * cc * cc) * a2 * a2 / 24
        let t2 = (61 - 58 * tt + tt * tt + 600 * cc - 330 * EP2) * a2 * a2 * a2 / 720
        let north = FN + K0 * (m + n * t * (t1 + t2))
        return (e, north)
    }

    /// Ground size of a web-map pixel at tile (z, y), in metres.
    static func groundPixel(_ z: Int, _ y: Int) -> Double {
        let size = 2 * ORIGIN / Double(1 << z)
        let my = ORIGIN - (Double(y) + 0.5) * size
        let lat = atan(sinh(my / ORIGIN * .pi))
        return size / 256 * cos(lat)
    }

    /// The coarsest level whose pixels are no bigger than `ground` metres (the finest if none is).
    static func level(_ scales: [Double], _ ground: Double) -> Int {
        for (i, s) in scales.enumerated() where s * PIXEL <= ground { return i }
        return scales.count - 1
    }

    /// Source pixel position (in the level with pixel size `px`, corner originE/originN) of every
    /// pixel of web-map tile (z, x, y): exact on a 17×17 grid, bilinear in between.
    static func sourcePixels(_ z: Int, _ x: Int, _ y: Int, _ px: Double, _ originE: Double, _ originN: Double) -> (fx: [Float], fy: [Float]) {
        let g = 17, step = 16.0
        let size = 2 * ORIGIN / Double(1 << z)
        let mpp = size / 256
        var gx = [Double](repeating: 0, count: g * g), gy = [Double](repeating: 0, count: g * g)
        for j in 0..<g {
            let my = ORIGIN - Double(y) * size - Double(j) * step * mpp
            let lat = atan(sinh(my / ORIGIN * .pi)) * 180 / .pi
            for i in 0..<g {
                let mx = -ORIGIN + Double(x) * size + Double(i) * step * mpp
                let (e, n) = project(lat, mx / ORIGIN * 180)
                gx[j * g + i] = (e - originE) / px
                gy[j * g + i] = (originN - n) / px
            }
        }
        var fx = [Float](repeating: 0, count: 65536), fy = [Float](repeating: 0, count: 65536)
        for py in 0..<256 {
            let v = (Double(py) + 0.5) / step
            let j = min(Int(v), g - 2)
            let dv = v - Double(j)
            for pxl in 0..<256 {
                let u = (Double(pxl) + 0.5) / step
                let i = min(Int(u), g - 2)
                let du = u - Double(i)
                let k = j * g + i
                let w00 = (1 - du) * (1 - dv), w10 = du * (1 - dv), w01 = (1 - du) * dv, w11 = du * dv
                fx[py * 256 + pxl] = Float(gx[k] * w00 + gx[k + 1] * w10 + gx[k + g] * w01 + gx[k + g + 1] * w11 - 0.5)
                fy[py * 256 + pxl] = Float(gy[k] * w00 + gy[k + 1] * w10 + gy[k + g] * w01 + gy[k + g + 1] * w11 - 0.5)
            }
        }
        return (fx, fy)
    }

    /// Source tiles a sourcePixels() result needs: (col0, row0, col1, row1), inclusive.
    static func tileRange(_ f: (fx: [Float], fy: [Float]), _ tileSize: Int) -> (Int, Int, Int, Int) {
        let minX = f.fx.min() ?? 0, maxX = f.fx.max() ?? 0
        let minY = f.fy.min() ?? 0, maxY = f.fy.max() ?? 0
        let ts = Float(tileSize)
        return (
            Int((minX.rounded(.down) / ts).rounded(.down)),
            Int((minY.rounded(.down) / ts).rounded(.down)),
            Int(((maxX.rounded(.down) + 1) / ts).rounded(.down)),
            Int(((maxY.rounded(.down) + 1) / ts).rounded(.down))
        )
    }

    /// Draws the tile: bilinear samples of the source tiles; `tiles[r][c]` nil = none (white).
    static func render(_ f: (fx: [Float], fy: [Float]), _ tiles: [[[UInt32]?]], _ col0: Int, _ row0: Int, _ tileSize: Int) -> [UInt32] {
        var out = [UInt32](repeating: 0, count: 65536)
        let rows = tiles.count, cols = tiles[0].count
        let x0 = Float(col0 * tileSize), y0 = Float(row0 * tileSize)
        func pixel(_ x: Int, _ y: Int) -> UInt32 {
            let c = Int((Double(x) / Double(tileSize)).rounded(.down)), r = Int((Double(y) / Double(tileSize)).rounded(.down))
            if r < 0 || c < 0 || r >= rows || c >= cols { return 0xffffffff }
            guard let t = tiles[r][c] else { return 0xffffffff }
            let my = ((y % tileSize) + tileSize) % tileSize, mx = ((x % tileSize) + tileSize) % tileSize
            return t[my * tileSize + mx]
        }
        for k in 0..<out.count {
            let sx = f.fx[k] - x0, sy = f.fy[k] - y0
            let fxf = sx.rounded(.down), fyf = sy.rounded(.down)
            let ix = Int(fxf), iy = Int(fyf)
            let dx = sx - fxf, dy = sy - fyf
            let p00 = pixel(ix, iy), p10 = pixel(ix + 1, iy), p01 = pixel(ix, iy + 1), p11 = pixel(ix + 1, iy + 1)
            let w00 = (1 - dx) * (1 - dy), w10 = dx * (1 - dy), w01 = (1 - dx) * dy, w11 = dx * dy
            func ch(_ shift: UInt32) -> UInt32 {
                let v = Float((p00 >> shift) & 0xff) * w00 + Float((p10 >> shift) & 0xff) * w10
                    + Float((p01 >> shift) & 0xff) * w01 + Float((p11 >> shift) & 0xff) * w11
                return min(255, UInt32(max(0, v.rounded())))
            }
            out[k] = 0xff000000 | (ch(16) << 16) | (ch(8) << 8) | ch(0)
        }
        return out
    }

    /// Transparent pixels (Geoportal's "no photo") become white; returns their share.
    static func clearTransparent(_ px: inout [UInt32]) -> Double {
        var n = 0
        for k in 0..<px.count {
            if (px[k] >> 24) < 128 {
                px[k] = 0xffffffff
                n += 1
            } else {
                px[k] |= 0xff000000
            }
        }
        return px.isEmpty ? 1 : Double(n) / Double(px.count)
    }

    /// Share of near-black pixels.
    static func blackShare(_ px: [UInt32]) -> Double {
        var black = 0
        for p in px where ((p >> 16) & 0xff) <= BLACK && ((p >> 8) & 0xff) <= BLACK && (p & 0xff) <= BLACK { black += 1 }
        return px.isEmpty ? 0 : Double(black) / Double(px.count)
    }

    /// A source tile needs filling from the other server: a lot of white, or any transparent pixels.
    static func needsFill(_ px: [UInt32], _ transparent: Double) -> Bool {
        transparent > 0.001 || whiteShare(px) >= 0.3
    }

    /// Share of near-white pixels (all channels ≥ 248), sampled.
    static func whiteShare(_ px: [UInt32]) -> Double {
        var white = 0, n = 0, k = 0
        while k < px.count {
            let p = px[k]
            n += 1
            if ((p >> 16) & 0xff) >= 248 && ((p >> 8) & 0xff) >= 248 && (p & 0xff) >= 248 { white += 1 }
            k += 61
        }
        return n == 0 ? 1 : Double(white) / Double(n)
    }

    /// Puts `fill`'s pixels where `px` is blank white.
    static func fillWhite(_ px: inout [UInt32], _ fill: [UInt32]) {
        for k in 0..<min(px.count, fill.count) {
            let p = px[k]
            if ((p >> 16) & 0xff) >= 250 && ((p >> 8) & 0xff) >= 250 && (p & 0xff) >= 250 { px[k] = fill[k] }
        }
    }
}
