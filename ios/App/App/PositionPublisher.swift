import Foundation
import CoreLocation

/// Sends my position to the group hunt's Firebase Realtime Database straight from the app, over
/// Firebase's REST API, so positions keep reaching the others with the screen locked (iOS suspends
/// the web page then). A port of PositionPublisher.java (Android): same writes as publishPosition()
/// in src/huntFirebase.ts, same rules as sendDecision() in src/hunt.ts, same token renewal.
/// Offline, the newest position and the track points wait and go in one request when the network
/// is back. Refused by the rules (hunt ended, I was removed): `onDenied`.
final class PositionPublisher {
    struct Config {
        var dbUrl: String
        var apiKey: String
        var refreshToken: String
        var uid: String
        var huntId: String
        var idToken: String?
        /// ms since 1970
        var idTokenExpiresAt: Double = 0
        var heartbeatMs: Double = 30_000
        var minMoveM: Double = 20
        var tokenUrl = "https://securetoken.googleapis.com/v1/token"
    }

    /// A position reached the database (ms since 1970). Called on the publisher's queue.
    var onSent: ((Double) -> Void)?
    /// The rules refused it, or the sign-in is gone. Called on the publisher's queue.
    var onDenied: (() -> Void)?

    private static let maxPendingTrack = 300
    private static let minRetry: TimeInterval = 5
    private static let maxRetry: TimeInterval = 60

    private var cfg: Config
    private let dbBase: String
    private let dbQuery: String
    private let queue = DispatchQueue(label: "org.polowanie.position")
    private let lock = NSLock()

    // Guarded by lock.
    private var last: (lat: Double, lng: Double, at: Double)?
    private var pendingPos: (lat: Double, lng: Double, acc: Double)?
    private var pendingTrack: [(lat: Double, lng: Double)] = []
    private var busy = false
    private var retryAt: Date = .distantPast
    private var backoff: TimeInterval = 0
    private var stopped = false

    // Only used on the queue.
    private var idToken: String?
    private var idTokenExpiresAt: Double

    init(config: Config) {
        cfg = config
        var base = config.dbUrl
        var query = ""
        if let q = base.firstIndex(of: "?") {
            let rest = String(base[base.index(after: q)...])
            if !rest.isEmpty { query = rest + "&" }
            base = String(base[..<q])
        }
        while base.hasSuffix("/") { base.removeLast() }
        dbBase = base
        dbQuery = query
        idToken = config.idToken
        idTokenExpiresAt = config.idToken != nil ? config.idTokenExpiresAt : 0
    }

    /// Same as roundCoord() in src/hunt.ts: 5 decimals, about 1 m.
    static func round5(_ v: Double) -> Double { (v * 1e5).rounded() / 1e5 }

    private static func nowMs() -> Double { (Date().timeIntervalSince1970 * 1000).rounded() }

    /// A new position from GPS (any thread).
    func onFix(_ l: CLLocation) {
        let acc = l.horizontalAccuracy
        let now = Self.nowMs()
        lock.lock()
        if stopped { lock.unlock(); return }
        var send = true, track = true
        if let p = last {
            let d = l.distance(from: CLLocation(latitude: p.lat, longitude: p.lng))
            let moved = d >= max(cfg.minMoveM, min(acc < 0 ? 0 : acc, 100))
            if !moved {
                track = false
                send = now - p.at >= cfg.heartbeatMs
            }
        }
        if send {
            last = (l.coordinate.latitude, l.coordinate.longitude, now)
            let pos = (lat: Self.round5(l.coordinate.latitude), lng: Self.round5(l.coordinate.longitude), acc: acc)
            pendingPos = pos
            if track && pendingTrack.count < Self.maxPendingTrack { pendingTrack.append((pos.lat, pos.lng)) }
        }
        if pendingPos == nil || busy || Date() < retryAt { lock.unlock(); return }
        busy = true
        lock.unlock()
        queue.async { self.flush() }
    }

    /// Stop sending; `clear` also removes my position from the map for everyone (best effort).
    func stop(clear: Bool) {
        lock.lock()
        let was = stopped
        stopped = true
        lock.unlock()
        if clear && !was {
            queue.async {
                _ = try? self.write(["positions/\(self.cfg.huntId)/\(self.cfg.uid)": NSNull()])
            }
        }
    }

    private func flush() {
        lock.lock()
        let pos = pendingPos
        let track = pendingTrack
        let isStopped = stopped
        lock.unlock()
        guard let p = pos, !isStopped else {
            lock.lock(); busy = false; lock.unlock()
            return
        }
        do {
            if try write(body(p, track)) == .denied {
                lock.lock()
                let replaced = stopped
                stopped = true
                busy = false
                lock.unlock()
                NSLog("polowanie-pos: refused by the database rules or sign-in lost: stopping")
                if !replaced { onDenied?() }
                return
            }
            lock.lock()
            if let cur = pendingPos, cur == p { pendingPos = nil }
            pendingTrack.removeFirst(min(track.count, pendingTrack.count))
            backoff = 0
            retryAt = .distantPast
            busy = false
            lock.unlock()
            onSent?(Self.nowMs())
        } catch {
            lock.lock()
            backoff = backoff == 0 ? Self.minRetry : min(backoff * 2, Self.maxRetry)
            retryAt = Date().addingTimeInterval(backoff)
            busy = false
            lock.unlock()
            NSLog("polowanie-pos: send failed, retry in \(Int(backoff)) s: \(error)")
        }
    }

    private func body(_ pos: (lat: Double, lng: Double, acc: Double), _ track: [(lat: Double, lng: Double)]) -> [String: Any] {
        let sv: [String: Any] = [".sv": "timestamp"]
        var p: [String: Any] = ["lat": pos.lat, "lng": pos.lng, "ts": sv]
        if pos.acc >= 0 && pos.acc.isFinite { p["acc"] = Int(pos.acc.rounded()) }
        var b: [String: Any] = ["positions/\(cfg.huntId)/\(cfg.uid)": p]
        for t in track {
            b["tracks/\(cfg.huntId)/\(cfg.uid)/\(PushId.next())"] = ["lat": t.lat, "lng": t.lng, "ts": sv]
        }
        return b
    }

    private enum WriteResult { case ok, denied }
    struct HTTPError: Error { let text: String }

    /// One multi-path update at the database root (PATCH), as update() in the web SDK.
    private func write(_ body: [String: Any]) throws -> WriteResult {
        var renewed = false
        if idToken == nil || Self.nowMs() > idTokenExpiresAt - 5 * 60_000 {
            if !(try renewToken()) { return .denied }
            renewed = true
        }
        let data = try JSONSerialization.data(withJSONObject: body)
        while true {
            let url = "\(dbBase)/.json?\(dbQuery)print=silent&auth=\(Self.enc(idToken ?? ""))"
            let (code, text) = try request(url, method: "PATCH", type: "application/json", body: data)
            if (200..<300).contains(code) { return .ok }
            if code == 401 || code == 403 {
                // An expired token and a refusal by the rules both answer 401: renew once to tell them apart.
                if renewed { return .denied }
                if !(try renewToken()) { return .denied }
                renewed = true
                continue
            }
            throw HTTPError(text: "HTTP \(code) \(text)")
        }
    }

    /// New ID token from the refresh token. False when the sign-in no longer exists.
    private func renewToken() throws -> Bool {
        let form = "grant_type=refresh_token&refresh_token=\(Self.enc(cfg.refreshToken))"
        let (code, text) = try request("\(cfg.tokenUrl)?key=\(Self.enc(cfg.apiKey))", method: "POST", type: "application/x-www-form-urlencoded", body: Data(form.utf8))
        if code == 400 || code == 403 {
            NSLog("polowanie-pos: token renewal refused: \(text)")
            return false
        }
        guard code == 200,
              let o = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any],
              let t = o["id_token"] as? String else { throw HTTPError(text: "token HTTP \(code)") }
        idToken = t
        let expires = Double(o["expires_in"] as? String ?? "3600") ?? 3600
        idTokenExpiresAt = Self.nowMs() + expires * 1000
        if let rt = o["refresh_token"] as? String, !rt.isEmpty { cfg.refreshToken = rt }
        return true
    }

    private static func enc(_ s: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return s.addingPercentEncoding(withAllowedCharacters: allowed) ?? s
    }

    /// A blocking request (only on the publisher's queue).
    private func request(_ url: String, method: String, type: String, body: Data) throws -> (Int, String) {
        guard let u = URL(string: url) else { throw HTTPError(text: "bad URL") }
        var r = URLRequest(url: u, timeoutInterval: 20)
        r.httpMethod = method
        r.setValue(type, forHTTPHeaderField: "Content-Type")
        r.httpBody = body
        let done = DispatchSemaphore(value: 0)
        var result: (Int, String)?
        var failure: Error?
        URLSession.shared.dataTask(with: r) { data, response, error in
            if let error = error {
                failure = error
            } else {
                let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                result = (code, String(decoding: (data ?? Data()).prefix(64 * 1024), as: UTF8.self))
            }
            done.signal()
        }.resume()
        done.wait()
        if let f = failure { throw f }
        guard let res = result else { throw HTTPError(text: "no answer") }
        return res
    }

    /// Keys like the web SDK's push(): time first, so track points sort by when they were made.
    enum PushId {
        private static let chars = Array("-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz")
        private static var lastTime: Int64 = 0
        private static var lastRandom = [Int](repeating: 0, count: 12)
        private static let lock = NSLock()

        static func next() -> String {
            lock.lock()
            defer { lock.unlock() }
            var now = Int64(Date().timeIntervalSince1970 * 1000)
            let same = now == lastTime
            lastTime = now
            var ts = [Character](repeating: "-", count: 8)
            for i in stride(from: 7, through: 0, by: -1) {
                ts[i] = chars[Int(now % 64)]
                now /= 64
            }
            if !same {
                for i in 0..<12 { lastRandom[i] = Int.random(in: 0..<64) }
            } else {
                var i = 11
                while i >= 0 && lastRandom[i] == 63 { lastRandom[i] = 0; i -= 1 }
                if i >= 0 { lastRandom[i] += 1 }
            }
            return String(ts) + String(lastRandom.map { chars[$0] })
        }
    }
}
