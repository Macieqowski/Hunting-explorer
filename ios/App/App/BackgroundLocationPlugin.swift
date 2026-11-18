import Foundation
import UIKit
import CoreLocation
import Capacitor

/// Location sharing that keeps working with the screen locked (iPhone counterpart of
/// BackgroundLocationPlugin.java + LocationService.java on Android). Used by src/native.ts.
///
/// start() asks for location permission ("while using the app" is enough: updates started on
/// screen go on in the background thanks to UIBackgroundModes=location in Info.plist, with the
/// blue location pill in the status bar). Positions arrive as "location" events while the page
/// is on screen. With a "publish" option the plugin also sends them to the hunt's database
/// itself (PositionPublisher.swift), because iOS suspends the web page when the screen locks:
/// "sent" { at } when one got there, "denied" when the database refused it (sharing has stopped).
/// iOS gives no satellite counts and there is no notification with a Stop button, so
/// "satellites" and "stopped" never come here.
@objc(BackgroundLocationPlugin)
public class BackgroundLocationPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "BackgroundLocationPlugin"
    public let jsName = "BackgroundLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isRunning", returnType: CAPPluginReturnPromise),
    ]

    // Everything below is used on the main thread only.
    private var manager: CLLocationManager?
    /// A start() waiting for the person's answer to the permission prompt.
    private var waiting: CAPPluginCall?
    private var publisher: PositionPublisher?
    private var running = false
    private var intervalMs: Double = 3000
    private var lastSentToPage: Date = .distantPast

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.startOnMain(call) }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.stopUpdates()
            call.resolve()
        }
    }

    @objc func isRunning(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(["running": self.running]) }
    }

    private func locationManager() -> CLLocationManager {
        if let m = manager { return m }
        let m = CLLocationManager()
        m.delegate = self
        m.desiredAccuracy = kCLLocationAccuracyBest
        m.distanceFilter = kCLDistanceFilterNone
        m.activityType = .otherNavigation
        // A hunter on a stand does not move for an hour: iOS must not decide to pause.
        m.pausesLocationUpdatesAutomatically = false
        manager = m
        return m
    }

    private func startOnMain(_ call: CAPPluginCall) {
        let m = locationManager()
        switch m.authorizationStatus {
        case .notDetermined:
            waiting?.reject("Replaced by a newer start", "CANCELLED")
            waiting = call
            m.requestWhenInUseAuthorization()
        case .denied, .restricted:
            call.reject("Location permission denied", "DENIED")
        default:
            begin(call)
        }
    }

    public func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        guard let call = waiting else { return }
        switch m.authorizationStatus {
        case .notDetermined:
            return
        case .denied, .restricted:
            waiting = nil
            call.reject("Location permission denied", "DENIED")
        default:
            waiting = nil
            begin(call)
        }
    }

    private func begin(_ call: CAPPluginCall) {
        intervalMs = max(500, call.getDouble("intervalMs") ?? 3000)
        // In a group hunt the plugin itself sends my position to the database.
        let old = publisher
        publisher = nil
        var publishing = false
        if let pub = call.getObject("publish"),
           let dbUrl = pub["dbUrl"] as? String, let refreshToken = pub["refreshToken"] as? String,
           let uid = pub["uid"] as? String, let huntId = pub["huntId"] as? String {
            var c = PositionPublisher.Config(dbUrl: dbUrl, apiKey: pub["apiKey"] as? String ?? "", refreshToken: refreshToken, uid: uid, huntId: huntId)
            c.idToken = pub["idToken"] as? String
            c.idTokenExpiresAt = Self.number(pub["idTokenExpiresAt"]) ?? 0
            c.heartbeatMs = Self.number(pub["heartbeatMs"]) ?? 30_000
            c.minMoveM = Self.number(pub["minMoveM"]) ?? 20
            if let t = pub["tokenUrl"] as? String, !t.isEmpty { c.tokenUrl = t }
            let p = PositionPublisher(config: c)
            p.onSent = { [weak self] at in
                DispatchQueue.main.async { self?.notifyListeners("sent", data: ["at": at]) }
            }
            p.onDenied = { [weak self, weak p] in
                DispatchQueue.main.async {
                    guard let self = self, let p = p, self.publisher === p else { return }
                    self.stopUpdates()
                    self.notifyListeners("denied", data: [:])
                }
            }
            publisher = p
            publishing = true
        }
        // Another hunt, or the page starts again: the old one stops (clearing my position is up to the page).
        old?.stop(clear: false)

        let m = locationManager()
        m.allowsBackgroundLocationUpdates = true
        m.showsBackgroundLocationIndicator = true
        m.startUpdatingLocation()
        running = true
        lastSentToPage = .distantPast
        call.resolve(["publishing": publishing])
    }

    private func stopUpdates() {
        manager?.stopUpdatingLocation()
        manager?.allowsBackgroundLocationUpdates = false
        running = false
        publisher?.stop(clear: false)
        publisher = nil
    }

    public func locationManager(_ m: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard running, let l = locations.last, l.horizontalAccuracy >= 0 else { return }
        publisher?.onFix(l)
        // The page is suspended in the background: messages to it would only pile up.
        guard UIApplication.shared.applicationState != .background else { return }
        let now = Date()
        guard now.timeIntervalSince(lastSentToPage) * 1000 >= intervalMs else { return }
        lastSentToPage = now
        notifyListeners("location", data: [
            "lat": l.coordinate.latitude,
            "lng": l.coordinate.longitude,
            "acc": l.horizontalAccuracy,
            "time": (l.timestamp.timeIntervalSince1970 * 1000).rounded(),
        ])
    }

    public func locationManager(_ m: CLLocationManager, didFailWithError error: Error) {
        // kCLErrorLocationUnknown: no position yet, GPS keeps trying. Denied: permission taken away in Settings.
        if (error as? CLError)?.code == .denied {
            stopUpdates()
            notifyListeners("stopped", data: [:])
        }
    }

    private static func number(_ v: Any?) -> Double? {
        if let d = v as? Double { return d }
        if let n = v as? NSNumber { return n.doubleValue }
        if let i = v as? Int { return Double(i) }
        return nil
    }
}
