// Checks ios/App/App/Puwg92.swift against the same reference values as Puwg92Test.java.
// Run by the iOS workflow: swiftc ios/App/App/Puwg92.swift ios/Tests/main.swift -o puwg && ./puwg
import Foundation

var failures = 0
func check(_ ok: Bool, _ what: String) {
    if !ok { failures += 1; print("FAIL: \(what)") }
}
func near(_ a: Double, _ b: Double, _ tol: Double) -> Bool { abs(a - b) <= tol }

let SCALES: [Double] = [
    3.0238155714285716E7, 1.5119077857142858E7, 7559538.928571429, 3779769.4642857146, 1889884.7321428573,
    944942.3660714286, 472471.1830357143, 236235.59151785716, 94494.23660714286, 47247.11830357143,
    23623.559151785714, 9449.423660714287, 4724.711830357143, 1889.8847321428573, 944.9423660714286,
    472.4711830357143, 236.23559151785716,
]

for (lat, lon, e, n) in [
    (52.2318, 21.006, 636952.481, 486978.944), (54.5, 14.2, 189356.402, 747945.613),
    (49.1, 24.1, 872097.678, 149472.961), (54.83, 18.3, 455046.776, 774275.244), (50.0, 19.0, 500000.0, 236968.449),
] {
    let (pe, pn) = Puwg92.project(lat, lon)
    check(near(pe, e, 0.01) && near(pn, n, 0.01), "project \(lat) \(lon): \(pe) \(pn)")
}

check(Puwg92.level(SCALES, Puwg92.groundPixel(16, 21647)) == 12, "level z16")
check(Puwg92.level(SCALES, Puwg92.groundPixel(17, 43295)) == 13, "level z17")
check(Puwg92.level(SCALES, Puwg92.groundPixel(18, 86590)) == 14, "level z18")
check(Puwg92.level(SCALES, Puwg92.groundPixel(19, 173180)) == 15, "level z19")
check(Puwg92.level(SCALES, 0.01) == 16, "level finest")

do {
    let z = 17
    let x = Int(((21.006 + 180) / 360 * Double(1 << z)).rounded(.down))
    let r = 52.2318 * Double.pi / 180
    let y = Int(((1 - log(tan(r) + 1 / cos(r)) / .pi) / 2 * Double(1 << z)).rounded(.down))
    let px = SCALES[13] * Puwg92.PIXEL
    let f = Puwg92.sourcePixels(z, x, y, px, 100000, 850000)
    let size = 2 * Puwg92.ORIGIN / Double(1 << z)
    let mx = -Puwg92.ORIGIN + (Double(x) + 0.5) * size, my = Puwg92.ORIGIN - (Double(y) + 0.5) * size
    let half = size / 256 / 2
    let (e2, n2) = Puwg92.project(atan(sinh((my - half) / Puwg92.ORIGIN * .pi)) * 180 / .pi, (mx + half) / Puwg92.ORIGIN * 180)
    check(near((e2 - 100000) / px - 0.5, Double(f.fx[128 * 256 + 128]), 0.05), "sourcePixels x")
    check(near((850000 - n2) / px - 0.5, Double(f.fy[128 * 256 + 128]), 0.05), "sourcePixels y")
    let rg = Puwg92.tileRange(f, 512)
    check(rg.2 - rg.0 <= 1 && rg.3 - rg.1 <= 1, "tileRange \(rg)")
}

do {
    let grey = [UInt32](repeating: 0xff808080, count: 512 * 512)
    let f = Puwg92.sourcePixels(17, 72000, 43000, SCALES[13] * Puwg92.PIXEL, 100000, 850000)
    let rg = Puwg92.tileRange(f, 512)
    let rows = rg.3 - rg.1 + 1, cols = rg.2 - rg.0 + 1
    let tiles = [[[UInt32]?]](repeating: [[UInt32]?](repeating: grey, count: cols), count: rows)
    check(Puwg92.render(f, tiles, rg.0, rg.1, 512).allSatisfy { $0 == 0xff808080 }, "render grey")
    let none = [[[UInt32]?]](repeating: [[UInt32]?](repeating: nil, count: cols), count: rows)
    check(Puwg92.whiteShare(Puwg92.render(f, none, rg.0, rg.1, 512)) == 1, "render none = white")
    var px: [UInt32] = [0xffffffff, 0xff102030, 0xfffafafa]
    Puwg92.fillWhite(&px, [0xff010101, 0xff020202, 0xff030303])
    check(px == [0xff010101, 0xff102030, 0xff030303], "fillWhite")
    var tr: [UInt32] = [0x00000000, 0xff102030, 0x40ffffff, 0xff405060]
    check(Puwg92.clearTransparent(&tr) == 0.5, "clearTransparent share")
    check(tr == [0xffffffff, 0xff102030, 0xffffffff, 0xff405060], "clearTransparent pixels")
}

if failures > 0 { print("\(failures) failed"); exit(1) }
print("Puwg92.swift: all checks passed")
