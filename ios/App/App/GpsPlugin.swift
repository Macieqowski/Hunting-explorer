import Foundation
import CoreLocation
import Capacitor

/// The phone's position while the app is on screen ("Gdzie jestem?", weather for here, stands,
/// sightings, beater guidance), in place of the web view's navigator.geolocation. iPhone
/// counterpart of GpsPlugin.java, used by src/geo.ts.
///
/// Through the web view, iOS asked on top of the app's own permission whether "localhost" may use
/// the location; this uses the app's permission only. start() resolves with { last?, enabled };
/// events "fix" { lat, lng, acc, time, age }. iOS gives no satellite counts, so no "satellites".
@objc(GpsPlugin)
public class GpsPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "GpsPlugin"
    public let jsName = "Gps"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "lastKnown", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    // Everything below is used on the main thread only.
    private var manager: CLLocationManager?
    /// start() calls waiting for the person's answer to the permission prompt.
    private var waiting: [CAPPluginCall] = []
    private var intervalMs: Double = 1000
    private var lastSent: Date = .distantPast

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            // Asked off the main thread: it can take a moment.
            let enabled = CLLocationManager.locationServicesEnabled()
            DispatchQueue.main.async {
                guard enabled else { return call.reject("Location is turned off", "OFF") }
                self.intervalMs = max(200, call.getDouble("intervalMs") ?? 1000)
                let m = self.locationManager()
                switch m.authorizationStatus {
                case .notDetermined:
                    self.waiting.append(call)
                    m.requestWhenInUseAuthorization()
                case .denied, .restricted:
                    call.reject("Location permission denied", "DENIED")
                default:
                    self.begin(call)
                }
            }
        }
    }

    @objc func lastKnown(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let m = self.locationManager()
            let allowed = m.authorizationStatus == .authorizedWhenInUse || m.authorizationStatus == .authorizedAlways
            if allowed, let l = m.location { call.resolve(["last": Self.toJs(l)]) } else { call.resolve() }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.manager?.stopUpdatingLocation()
            call.resolve()
        }
    }

    private func locationManager() -> CLLocationManager {
        if let m = manager { return m }
        let m = CLLocationManager()
        m.delegate = self
        m.desiredAccuracy = kCLLocationAccuracyBest
        m.distanceFilter = kCLDistanceFilterNone
        m.activityType = .otherNavigation
        m.pausesLocationUpdatesAutomatically = false
        manager = m
        return m
    }

    private func begin(_ call: CAPPluginCall) {
        let m = locationManager()
        m.startUpdatingLocation()
        lastSent = .distantPast
        var r: [String: Any] = ["enabled": true]
        if let l = m.location { r["last"] = Self.toJs(l) }
        call.resolve(r)
    }

    public func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        guard !waiting.isEmpty, m.authorizationStatus != .notDetermined else { return }
        let calls = waiting
        waiting = []
        let denied = m.authorizationStatus == .denied || m.authorizationStatus == .restricted
        for c in calls {
            if denied { c.reject("Location permission denied", "DENIED") } else { begin(c) }
        }
    }

    public func locationManager(_ m: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let l = locations.last, l.horizontalAccuracy >= 0 else { return }
        let now = Date()
        guard now.timeIntervalSince(lastSent) * 1000 >= intervalMs * 0.8 else { return }
        lastSent = now
        notifyListeners("fix", data: Self.toJs(l))
    }

    public func locationManager(_ m: CLLocationManager, didFailWithError error: Error) {
        // kCLErrorLocationUnknown: no position yet, the GPS keeps trying (as on Android, no time limit).
    }

    private static func toJs(_ l: CLLocation) -> [String: Any] {
        [
            "lat": l.coordinate.latitude,
            "lng": l.coordinate.longitude,
            "acc": l.horizontalAccuracy,
            "time": (l.timestamp.timeIntervalSince1970 * 1000).rounded(),
            "age": max(0, (-l.timestamp.timeIntervalSinceNow * 1000).rounded()),
        ]
    }
}
