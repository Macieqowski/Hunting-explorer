import Foundation
import UIKit
import Network
import ImageIO
import UniformTypeIdentifiers
import BackgroundTasks
import UserNotifications
import Capacitor

/// Offline map saving done by the app itself, not by the web page, so it goes on when the page is
/// paused. iPhone counterpart of TileDownloadPlugin.java + TileDownloadService.java (same job
/// format from src/offline.ts, same files in Documents/tiles/ that src/tileFiles.ts reads).
///
/// While a job runs the screen does not lock by itself. When the person locks it or leaves the
/// app, iOS 26 keeps the download going as a "continued processing" task with its progress on the
/// lock screen (the person can stop it there); older iOS gives the app only about half a minute,
/// after which the download pauses and resumes when the app is opened again (offline.ts restarts it).
@objc(TileDownloadPlugin)
public class TileDownloadPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TileDownloadPlugin"
    public let jsName = "TileDownload"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "forget", returnType: CAPPluginReturnPromise),
    ]

    @objc func start(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { return call.reject("No id") }
        let units: [TileDownloader.Unit]
        let sources: [String: TileDownloader.WmtsSource]
        do {
            units = try TileDownloader.parseUnits(call.getArray("units") ?? [])
            sources = try TileDownloader.parseSources(call.getObject("sources") ?? [:])
        } catch {
            return call.reject("Bad units: \(error)")
        }
        let job = TileDownloader.Job(
            id: id,
            title: call.getString("title") ?? "Polowanie",
            doneTitle: call.getString("doneTitle"),
            refresh: call.getBool("refresh") ?? false,
            concurrency: call.getInt("concurrency") ?? 8,
            wmsConcurrency: call.getInt("wmsConcurrency") ?? 6,
            units: units,
            sources: sources
        )
        TileDownloader.shared.add(job)
        call.resolve()
    }

    @objc func status(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        let since = max(0, call.getInt("since") ?? 0)
        guard let job = TileDownloader.shared.job(id) else { return call.resolve(["state": "none"]) }
        call.resolve(job.status(since: since))
    }

    @objc func cancel(_ call: CAPPluginCall) {
        TileDownloader.shared.cancel(call.getString("id") ?? "")
        call.resolve()
    }

    @objc func forget(_ call: CAPPluginCall) {
        TileDownloader.shared.forget(call.getString("id") ?? "")
        call.resolve()
    }
}

/// The download queue (one job at a time, many workers per job), shared by the plugin.
final class TileDownloader {
    static let shared = TileDownloader()

    struct Unit {
        var url: String?
        var src: String?
        var z = 0, x = 0, y = 0
        var fallback: String?
        var n = 1
        var mime = "image/png"
        var cols: [Int] = []
        var rows: [Int] = []
        var files: [String] = []
        var check: [Bool] = []
        var jpeg: Bool { mime.contains("jpeg") || mime.contains("jpg") }
    }

    struct WmtsSource {
        var template: String
        var fallback: String?
        var scales: [Double]
        var originE: Double
        var originN: Double
        var size: Int
    }

    struct ParseError: Error, CustomStringConvertible { let description: String }

    static func parseUnits(_ arr: JSArray) throws -> [Unit] {
        let fileName = try NSRegularExpression(pattern: "^[0-9a-f]{1,32}\\.(png|jpg)$")
        return try arr.map { item in
            guard let o = item as? JSObject else { throw ParseError(description: "unit is not an object") }
            var u = Unit()
            u.url = o["u"] as? String
            u.src = o["s"] as? String
            u.z = num(o["z"]).map { Int($0) } ?? 0
            u.x = num(o["x"]).map { Int($0) } ?? 0
            u.y = num(o["y"]).map { Int($0) } ?? 0
            if u.url == nil && u.src == nil { throw ParseError(description: "unit without u or s") }
            u.fallback = o["f"] as? String
            u.n = num(o["n"]).map { Int($0) } ?? 1
            u.mime = o["m"] as? String ?? "image/png"
            guard let t = o["t"] as? JSArray else { throw ParseError(description: "unit without t") }
            for e in t {
                guard let row = e as? JSArray, row.count >= 3, let c = num(row[0]), let r = num(row[1]), let f = row[2] as? String else {
                    throw ParseError(description: "bad tile")
                }
                // File names come from tileFileName(): a hash and an extension, nothing else.
                guard fileName.firstMatch(in: f, range: NSRange(f.startIndex..., in: f)) != nil else { throw ParseError(description: "bad file name \(f)") }
                u.cols.append(Int(c))
                u.rows.append(Int(r))
                u.files.append(f)
                u.check.append(row.count > 3 && num(row[3]) == 1)
            }
            return u
        }
    }

    static func parseSources(_ o: JSObject) throws -> [String: WmtsSource] {
        var out: [String: WmtsSource] = [:]
        for (k, v) in o {
            guard let s = v as? JSObject, let t = s["t"] as? String, let sc = s["scales"] as? JSArray,
                  let e = num(s["e"]), let n = num(s["n"]) else { throw ParseError(description: "bad source \(k)") }
            let scales = sc.compactMap { num($0) }
            if scales.isEmpty { throw ParseError(description: "no scales") }
            out[k] = WmtsSource(template: t, fallback: s["f"] as? String, scales: scales, originE: e, originN: n, size: num(s["size"]).map { Int($0) } ?? 512)
        }
        return out
    }

    static func num(_ v: Any?) -> Double? {
        if let d = v as? Double { return d }
        if let i = v as? Int { return Double(i) }
        if let n = v as? NSNumber { return n.doubleValue }
        return nil
    }

    // ------------------------------------------------------------------ jobs

    final class Job {
        let id: String
        let title: String
        let doneTitle: String?
        let refresh: Bool
        let concurrency: Int
        let units: [Unit]
        let sources: [String: WmtsSource]
        let total: Int
        let wmsSlots: DispatchSemaphore

        private let lock = NSLock()
        private var nextUnit = 0
        private(set) var done = 0
        private(set) var failed = 0
        private(set) var bytes = 0
        private var results: [[Int]] = []
        var state = "queued"
        var cancelled = false
        var waiting = false

        // WMTS tiles shared by neighbouring units, fetched once however many workers want them.
        final class Pending {
            let ready = DispatchSemaphore(value: 0)
            var value: [UInt32]?
        }
        private var cache: [String: Pending] = [:]
        private var cacheOrder: [String] = []

        init(id: String, title: String, doneTitle: String?, refresh: Bool, concurrency: Int, wmsConcurrency: Int, units: [Unit], sources: [String: WmtsSource]) {
            self.id = id
            self.title = title
            self.doneTitle = doneTitle
            self.refresh = refresh
            self.concurrency = max(1, min(32, concurrency))
            self.units = units
            self.sources = sources
            self.wmsSlots = DispatchSemaphore(value: max(1, min(self.concurrency, wmsConcurrency)))
            total = units.reduce(0) { $0 + $1.files.count }
        }

        func locked<T>(_ f: () -> T) -> T {
            lock.lock()
            defer { lock.unlock() }
            return f()
        }

        func takeUnit() -> Int? {
            locked {
                if cancelled || nextUnit >= units.count { return nil }
                nextUnit += 1
                return nextUnit - 1
            }
        }

        func result(_ unit: Int, _ tile: Int, _ size: Int, written: Bool) {
            locked {
                results.append([unit, tile, size])
                done += 1
                if written { bytes += size }
            }
        }

        func fail(_ n: Int) {
            if n > 0 { locked { failed += n } }
        }

        func status(since: Int) -> [String: Any] {
            locked {
                let next = results.count
                return [
                    "state": state, "done": done, "failed": failed, "bytes": bytes, "total": total, "waiting": waiting,
                    "results": since < next ? Array(results[since..<next]) : [], "next": next,
                ]
            }
        }

        /// The pending entry for `key`, and whether this caller must load it.
        func cacheEntry(_ key: String) -> (Pending, Bool) {
            locked {
                if let p = cache[key] {
                    if let i = cacheOrder.firstIndex(of: key) { cacheOrder.remove(at: i) }
                    cacheOrder.append(key)
                    return (p, false)
                }
                let p = Pending()
                cache[key] = p
                cacheOrder.append(key)
                if cacheOrder.count > 48 { cache.removeValue(forKey: cacheOrder.removeFirst()) }
                return (p, true)
            }
        }

        func dropCache(_ key: String, _ p: Pending) {
            locked {
                if cache[key] === p {
                    cache.removeValue(forKey: key)
                    cacheOrder.removeAll { $0 == key }
                }
            }
        }
    }

    private let lock = NSLock()
    private var queue: [Job] = []
    private var jobs: [String: Job] = [:]
    private var current: Job?
    private var running = false
    private let monitor = NWPathMonitor()
    private var online = true
    private let session: URLSession
    private let background = BackgroundKeeper()

    private init() {
        let cfg = URLSessionConfiguration.default
        cfg.httpMaximumConnectionsPerHost = 32
        cfg.timeoutIntervalForRequest = 60
        cfg.requestCachePolicy = .reloadIgnoringLocalCacheData
        cfg.urlCache = nil
        session = URLSession(configuration: cfg)
        monitor.pathUpdateHandler = { [weak self] p in
            self?.lock.lock()
            self?.online = p.status == .satisfied
            self?.lock.unlock()
        }
        monitor.start(queue: DispatchQueue(label: "org.polowanie.tiles.net"))
    }

    func job(_ id: String) -> Job? {
        lock.lock()
        defer { lock.unlock() }
        return jobs[id]
    }

    func add(_ job: Job) {
        lock.lock()
        // The page started this area again: the new job replaces the old one. Tiles the old one
        // wrote are found as files and not fetched again.
        if let old = jobs[job.id] {
            old.locked { old.cancelled = true }
            if let i = queue.firstIndex(where: { $0 === old }) {
                queue.remove(at: i)
                old.locked { old.state = "cancelled" }
            }
        }
        jobs[job.id] = job
        queue.append(job)
        let start = !running
        running = true
        lock.unlock()
        if start {
            DispatchQueue.main.async { self.background.begin(title: job.title) }
            Thread { self.runJobs() }.start()
        }
    }

    func cancel(_ id: String) {
        lock.lock()
        defer { lock.unlock() }
        guard let job = jobs[id] else { return }
        job.locked { job.cancelled = true }
        if let i = queue.firstIndex(where: { $0 === job }) {
            queue.remove(at: i)
            job.locked { job.state = "cancelled" }
        }
    }

    /// Stops everything (the person stopped it on the lock screen, or iOS ran out of time).
    func cancelAll() {
        lock.lock()
        defer { lock.unlock() }
        for j in queue { j.locked { j.cancelled = true; j.state = "cancelled" } }
        queue.removeAll()
        if let c = current { c.locked { c.cancelled = true } }
    }

    func forget(_ id: String) {
        lock.lock()
        defer { lock.unlock() }
        if let j = jobs[id], ["done", "cancelled"].contains(j.locked({ j.state })) { jobs.removeValue(forKey: id) }
    }

    private func runJobs() {
        while true {
            lock.lock()
            guard !queue.isEmpty else {
                current = nil
                running = false
                lock.unlock()
                DispatchQueue.main.async { self.background.end() }
                return
            }
            let job = queue.removeFirst()
            current = job
            lock.unlock()
            if job.locked({ job.cancelled }) {
                job.locked { job.state = "cancelled" }
                continue
            }
            run(job)
            let cancelled = job.locked { job.cancelled }
            job.locked { job.state = cancelled ? "cancelled" : "done" }
            if !cancelled, let t = job.doneTitle { Self.notifyDone(t, job) }
        }
    }

    private func run(_ job: Job) {
        job.locked { job.state = "running" }
        DispatchQueue.main.async { self.background.progress(job.title, 0, job.total) }
        let group = DispatchGroup()
        for _ in 0..<job.concurrency {
            group.enter()
            Thread {
                self.work(job)
                group.leave()
            }.start()
        }
        while group.wait(timeout: .now() + 1) == .timedOut {
            let done = job.locked { job.done + job.failed }
            DispatchQueue.main.async { self.background.progress(job.title, done, job.total) }
        }
    }

    private func work(_ job: Job) {
        while let i = job.takeUnit() {
            var ok = 0
            autoreleasepool {
                doUnit(job, i, job.units[i], &ok)
            }
        }
    }

    private static var tilesDir: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("tiles", isDirectory: true)
    }

    private func doUnit(_ job: Job, _ ui: Int, _ u: Unit, _ ok: inout Int) {
        let dir = Self.tilesDir
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        var need: [Int] = []
        for t in 0..<u.files.count {
            let f = dir.appendingPathComponent(u.files[t])
            let size = (try? FileManager.default.attributesOfItem(atPath: f.path)[.size] as? Int) ?? 0
            // Not an update: a tile already saved stays, unless it is one to check and came out black.
            if !job.refresh && size > 0 && !(u.check[t] && Self.looksBlack(f)) {
                job.result(ui, t, size, written: false)
                ok += 1
            } else {
                need.append(t)
            }
        }
        if need.isEmpty { return }
        if u.src != nil { return doWmtsUnit(job, ui, u, need, dir, &ok) }
        guard let url = u.url else { return job.fail(need.count) }

        job.wmsSlots.wait()
        let img = fetch(job, url)
        job.wmsSlots.signal()
        guard var data = img else { return job.fail(need.count) }
        // One tile in its own image: kept as it came, unless blank.
        if u.n == 1 {
            if let fb = u.fallback, let px = Image.decode(data), Image.whiteShare(px, 0, 0, px.width) >= 0.4 {
                job.wmsSlots.wait()
                if let other = fetch(job, fb) { data = other }
                job.wmsSlots.signal()
            }
            if Self.write(dir, u.files[need[0]], data) {
                job.result(ui, need[0], data.count, written: true)
                ok += 1
            } else {
                job.fail(1)
            }
            return
        }
        guard let bmp = Image.decode(data) else { return job.fail(need.count) }
        var other: Image?
        var triedOther = false
        for t in need {
            if job.locked({ job.cancelled }) { return }
            let x = u.cols[t] * 256, y = u.rows[t] * 256
            if x + 256 > bmp.width || y + 256 > bmp.height {
                job.fail(1)
                continue
            }
            var src = bmp
            if let fb = u.fallback, Image.whiteShare(bmp, x, y, 256) >= 0.4 {
                if !triedOther {
                    triedOther = true
                    job.wmsSlots.wait()
                    if let o = fetch(job, fb) { other = Image.decode(o) }
                    job.wmsSlots.signal()
                }
                if let o = other, o.width == bmp.width { src = o }
            }
            guard let out = Image.encode(src.crop(x, y, 256), 256, 256, jpeg: u.jpeg), Self.write(dir, u.files[t], out) else {
                job.fail(1)
                continue
            }
            job.result(ui, t, out.count, written: true)
            ok += 1
        }
    }

    // ------------------------------------------------------------------ tiles drawn from WMTS

    private func doWmtsUnit(_ job: Job, _ ui: Int, _ u: Unit, _ need: [Int], _ dir: URL, _ ok: inout Int) {
        guard let s = u.src, let src = job.sources[s] else { return job.fail(need.count) }
        for t in need {
            if job.locked({ job.cancelled }) { return }
            let tx = u.x + u.cols[t], ty = u.y + u.rows[t]
            let level = Puwg92.level(src.scales, Puwg92.groundPixel(u.z, ty))
            let px = src.scales[level] * Puwg92.PIXEL
            let f = Puwg92.sourcePixels(u.z, tx, ty, px, src.originE, src.originN)
            let (c0, r0, c1, r1) = Puwg92.tileRange(f, src.size)
            let cols = c1 - c0 + 1, rows = r1 - r0 + 1
            if cols > 4 || rows > 4 {
                job.fail(1)
                continue
            }
            var tiles = [[[UInt32]?]](repeating: [[UInt32]?](repeating: nil, count: cols), count: rows)
            var missing = false
            outer: for r in 0..<rows {
                for c in 0..<cols {
                    guard let got = wmtsTile(job, src, level, r0 + r, c0 + c) else {
                        missing = true
                        break outer
                    }
                    tiles[r][c] = got.isEmpty ? nil : got
                }
            }
            if missing {
                job.fail(1)
                continue
            }
            let pixels = Puwg92.render(f, tiles, c0, r0, src.size)
            guard let out = Image.encode(pixels, 256, 256, jpeg: u.jpeg), Self.write(dir, u.files[t], out) else {
                job.fail(1)
                continue
            }
            job.result(ui, t, out.count, written: true)
            ok += 1
        }
    }

    /// A WMTS tile's pixels; empty = no photo there (white); nil = fetching failed.
    private func wmtsTile(_ job: Job, _ src: WmtsSource, _ level: Int, _ row: Int, _ col: Int) -> [UInt32]? {
        if row < 0 || col < 0 { return [] }
        let key = "\(src.template)|\(level)/\(row)/\(col)"
        let (p, mine) = job.cacheEntry(key)
        if mine {
            p.value = loadWmtsTile(job, src, level, row, col)
            // Wake every worker waiting on it (there are never more than the job's workers).
            for _ in 0..<job.concurrency { p.ready.signal() }
        } else {
            p.ready.wait()
            p.ready.signal()
        }
        if p.value == nil { job.dropCache(key, p) }
        return p.value
    }

    private func loadWmtsTile(_ job: Job, _ src: WmtsSource, _ level: Int, _ row: Int, _ col: Int) -> [UInt32]? {
        var holes = 0.0
        guard var main = wmtsPixels(job, src.template, src, level, row, col, &holes) else { return nil }
        guard let fb = src.fallback else { return main }
        if main.isEmpty || Puwg92.needsFill(main, holes) {
            var h2 = 0.0
            guard let other = wmtsPixels(job, fb, src, level, row, col, &h2) else {
                return main.isEmpty || holes > 0.001 ? nil : main
            }
            if main.isEmpty { return other }
            if other.count == src.size * src.size { Puwg92.fillWhite(&main, other) }
        }
        return main
    }

    private func wmtsPixels(_ job: Job, _ template: String, _ src: WmtsSource, _ level: Int, _ row: Int, _ col: Int, _ holes: inout Double) -> [UInt32]? {
        let url = template.replacingOccurrences(of: "{L}", with: "\(level)").replacingOccurrences(of: "{r}", with: "\(row)").replacingOccurrences(of: "{c}", with: "\(col)")
        guard let data = fetch(job, url, allowEmpty: true) else { return nil }
        if data.isEmpty { return [] }
        guard let img = Image.decode(data), img.width == src.size, img.height == src.size else { return [] }
        var px = img.pixels
        holes = Puwg92.clearTransparent(&px)
        return holes > 0.99 ? [] : px
    }

    /// A saved photo tile with black in it (drawn from transparent "no photo" answers before Nov 2026).
    static func looksBlack(_ f: URL) -> Bool {
        guard let d = try? Data(contentsOf: f), let img = Image.decode(d) else { return true }
        return Puwg92.blackShare(img.pixels) >= 0.02
    }

    private static func write(_ dir: URL, _ name: String, _ data: Data) -> Bool {
        (try? data.write(to: dir.appendingPathComponent(name), options: .atomic)) != nil
    }

    // ------------------------------------------------------------------ network

    /// The State Forests' server refuses unknown clients: look like the phone's browser.
    private static let userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"

    /// Fetches an image, retrying hiccups and waiting (up to 15 minutes) for signal. `allowEmpty`:
    /// an empty 200 answer (Geoportal WMTS where it has no photo) returns empty data.
    private func fetch(_ job: Job, _ url: String, allowEmpty: Bool = false) -> Data? {
        guard let u = URL(string: url) else { return nil }
        for attempt in 0..<4 {
            if job.locked({ job.cancelled }) || !waitForSignal(job) { return nil }
            if attempt > 0 { Thread.sleep(forTimeInterval: 0.4 * pow(3, Double(attempt - 1))) }
            var r = URLRequest(url: u)
            r.setValue(Self.userAgent, forHTTPHeaderField: "User-Agent")
            r.setValue("image/*", forHTTPHeaderField: "Accept")
            let doneSem = DispatchSemaphore(value: 0)
            var body: Data?
            var resp: HTTPURLResponse?
            session.dataTask(with: r) { d, re, _ in
                body = d
                resp = re as? HTTPURLResponse
                doneSem.signal()
            }.resume()
            doneSem.wait()
            guard let res = resp else { continue }
            let type = res.value(forHTTPHeaderField: "Content-Type") ?? ""
            let data = body ?? Data()
            if allowEmpty && res.statusCode == 200 && data.isEmpty { return Data() }
            if res.statusCode == 200 && type.hasPrefix("image/") && !data.isEmpty { return data }
        }
        return nil
    }

    private func isOnline() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return online
    }

    private func waitForSignal(_ job: Job) -> Bool {
        let until = Date().addingTimeInterval(15 * 60)
        while !isOnline() {
            if job.locked({ job.cancelled }) || Date() > until { return false }
            job.locked { job.waiting = true }
            Thread.sleep(forTimeInterval: 3)
        }
        job.locked { job.waiting = false }
        return !job.locked({ job.cancelled })
    }

    private static func notifyDone(_ title: String, _ job: Job) {
        let c = UNMutableNotificationContent()
        c.title = title
        let (d, t) = job.locked { (job.done, job.total) }
        c.body = "\(d) / \(t)"
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "tiles-done", content: c, trigger: nil))
    }
}

// ------------------------------------------------------------------ keeping the app running

/// Keeps the download going: the screen does not auto-lock while it runs; once the app leaves
/// the screen, a background task (about 30 s) and, on iOS 26, a continued processing task with
/// progress on the lock screen. Main thread only.
private final class BackgroundKeeper {
    private var task: UIBackgroundTaskIdentifier = .invalid
    private var continued: AnyObject?

    func begin(title: String) {
        UIApplication.shared.isIdleTimerDisabled = true
        if #available(iOS 26.0, *), continued == nil { continued = ContinuedTask.start(title: title) }
        if task == .invalid {
            task = UIApplication.shared.beginBackgroundTask(withName: "tiles") { [weak self] in
                guard let self = self else { return }
                // Without a continued processing task iOS stops the app now: pause the download
                // (offline.ts resumes it when the app is open again).
                if self.continued == nil { TileDownloader.shared.cancelAll() }
                UIApplication.shared.endBackgroundTask(self.task)
                self.task = .invalid
            }
        }
        // Ask once for notifications, for the "saved" message at the end.
        UNUserNotificationCenter.current().getNotificationSettings { s in
            if s.authorizationStatus == .notDetermined {
                UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
            }
        }
    }

    func progress(_ title: String, _ done: Int, _ total: Int) {
        if #available(iOS 26.0, *), let c = continued as? ContinuedTask { c.update(title: title, done: done, total: total) }
    }

    func end() {
        UIApplication.shared.isIdleTimerDisabled = false
        if #available(iOS 26.0, *), let c = continued as? ContinuedTask { c.finish() }
        continued = nil
        if task != .invalid {
            UIApplication.shared.endBackgroundTask(task)
            task = .invalid
        }
    }
}

/// iOS 26: a long download the person started goes on in the background, shown on the lock screen.
@available(iOS 26.0, *)
private final class ContinuedTask {
    private var task: BGContinuedProcessingTask?
    private var pending: (String, Int, Int)?
    private var finished = false

    static func start(title: String) -> ContinuedTask? {
        let me = ContinuedTask()
        // Matches org.polowanie.app.tiles.* in BGTaskSchedulerPermittedIdentifiers (Info.plist).
        let id = "\(Bundle.main.bundleIdentifier ?? "org.polowanie.app").tiles.\(UUID().uuidString)"
        let ok = BGTaskScheduler.shared.register(forTaskWithIdentifier: id, using: .main) { t in
            guard let t = t as? BGContinuedProcessingTask else { return t.setTaskCompleted(success: false) }
            if me.finished { return t.setTaskCompleted(success: true) }
            me.task = t
            t.expirationHandler = { TileDownloader.shared.cancelAll() }
            if let p = me.pending { me.update(title: p.0, done: p.1, total: p.2) }
        }
        guard ok else { return nil }
        let req = BGContinuedProcessingTaskRequest(identifier: id, title: title, subtitle: "")
        do {
            try BGTaskScheduler.shared.submit(req)
        } catch {
            NSLog("polowanie-tiles: continued task not available: \(error)")
            return nil
        }
        return me
    }

    func update(title: String, done: Int, total: Int) {
        pending = (title, done, total)
        guard let t = task else { return }
        t.progress.totalUnitCount = Int64(max(1, total))
        t.progress.completedUnitCount = Int64(min(done, total))
        t.updateTitle(title, subtitle: "\(done) / \(total)")
    }

    func finish() {
        finished = true
        task?.setTaskCompleted(success: true)
        task = nil
    }
}

// ------------------------------------------------------------------ images

/// Decoded image as ARGB pixels (0xAARRGGBB), the layout Puwg92 works with.
struct Image {
    let width: Int
    let height: Int
    var pixels: [UInt32]

    private static let bitmapInfo = CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue

    static func decode(_ data: Data) -> Image? {
        guard let src = CGImageSourceCreateWithData(data as CFData, nil),
              let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { return nil }
        let w = cg.width, h = cg.height
        guard w > 0, h > 0 else { return nil }
        var px = [UInt32](repeating: 0, count: w * h)
        let ok = px.withUnsafeMutableBytes { buf -> Bool in
            guard let ctx = CGContext(data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: bitmapInfo) else { return false }
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
            return true
        }
        return ok ? Image(width: w, height: h, pixels: px) : nil
    }

    static func encode(_ pixels: [UInt32], _ w: Int, _ h: Int, jpeg: Bool) -> Data? {
        var px = pixels
        let cg: CGImage? = px.withUnsafeMutableBytes { buf in
            CGContext(data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: bitmapInfo)?.makeImage()
        }
        guard let image = cg else { return nil }
        let out = NSMutableData()
        let type = (jpeg ? UTType.jpeg : UTType.png).identifier as CFString
        guard let dest = CGImageDestinationCreateWithData(out, type, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
        return CGImageDestinationFinalize(dest) ? out as Data : nil
    }

    /// A size×size square starting at (x, y).
    func crop(_ x: Int, _ y: Int, _ size: Int) -> [UInt32] {
        var out = [UInt32](repeating: 0, count: size * size)
        for r in 0..<size {
            let from = (y + r) * width + x
            out.replaceSubrange(r * size..<(r + 1) * size, with: pixels[from..<from + size])
        }
        return out
    }

    /// Share of near-white pixels in a square, sampled on a 32×32 grid.
    static func whiteShare(_ img: Image, _ x: Int, _ y: Int, _ size: Int) -> Double {
        var white = 0
        for j in 0..<32 {
            for i in 0..<32 {
                let px = x + i * size / 32, py = y + j * size / 32
                guard px < img.width, py < img.height else { continue }
                let p = img.pixels[py * img.width + px]
                if ((p >> 16) & 0xff) >= 248 && ((p >> 8) & 0xff) >= 248 && (p & 0xff) >= 248 { white += 1 }
            }
        }
        return Double(white) / 1024
    }
}
