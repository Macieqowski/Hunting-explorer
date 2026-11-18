import Foundation
import UIKit
import CoreHaptics
import CoreLocation
import AudioToolbox
import AVFoundation
import UserNotifications
import Capacitor

/// Hunt alerts (iPhone counterpart of AlertsPlugin.java): vibration patterns through Core Haptics
/// (the web view has no navigator.vibrate) and notifications shown while the app is not on screen.
@objc(AlertsPlugin)
public class AlertsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AlertsPlugin"
    public let jsName = "Alerts"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "vibrate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notify", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    private var engine: CHHapticEngine?
    private var nextId = 2000

    /// pattern: [on, off, on, …] in ms.
    @objc func vibrate(_ call: CAPPluginCall) {
        let pattern = (call.getArray("pattern") ?? []).compactMap { TileDownloader.num($0) }.map { max(0, min(5000, $0)) / 1000 }
        DispatchQueue.main.async {
            defer { call.resolve() }
            guard !pattern.isEmpty else { return }
            guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
                AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
                return
            }
            do {
                if self.engine == nil {
                    let e = try CHHapticEngine()
                    e.playsHapticsOnly = true
                    e.isAutoShutdownEnabled = true
                    e.resetHandler = { [weak self] in try? self?.engine?.start() }
                    self.engine = e
                }
                try self.engine?.start()
                var events: [CHHapticEvent] = []
                var t = 0.0
                for (i, d) in pattern.enumerated() {
                    if i % 2 == 0 && d > 0 {
                        let params = [CHHapticEventParameter(parameterID: .hapticIntensity, value: d < 0.03 ? 0.5 : 1),
                                      CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5)]
                        events.append(d < 0.03
                            ? CHHapticEvent(eventType: .hapticTransient, parameters: params, relativeTime: t)
                            : CHHapticEvent(eventType: .hapticContinuous, parameters: params, relativeTime: t, duration: d))
                    }
                    t += d
                }
                guard !events.isEmpty else { return }
                let player = try self.engine?.makePlayer(with: CHHapticPattern(events: events, parameters: []))
                try player?.start(atTime: CHHapticTimeImmediate)
            } catch {
                AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
            }
        }
    }

    /// Shows a notification (title, text); tapping it opens the app. Asks for permission the first time.
    @objc func notify(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? "Polowanie"
        let text = call.getString("text") ?? ""
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { s in
            let post = {
                let c = UNMutableNotificationContent()
                c.title = title
                c.body = text
                // A sound so the phone also buzzes in the pocket (in silent mode it only vibrates).
                c.sound = .default
                self.nextId += 1
                center.add(UNNotificationRequest(identifier: "alert-\(self.nextId)", content: c, trigger: nil))
            }
            switch s.authorizationStatus {
            case .authorized, .provisional, .ephemeral: post()
            case .notDetermined:
                center.requestAuthorization(options: [.alert, .sound]) { ok, _ in if ok { post() } }
            default: break
            }
            call.resolve()
        }
    }

    /// Clears the alert notifications (when the app comes back to the screen).
    @objc func clear(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.getDeliveredNotifications { list in
            center.removeDeliveredNotifications(withIdentifiers: list.map(\.request.identifier).filter { $0.hasPrefix("alert-") })
            call.resolve()
        }
    }
}

/// The phone's compass with accuracy (iPhone counterpart of CompassPlugin.java): "heading" events
/// { heading (degrees from magnetic north), accuracy (degrees or null), calibrate }.
@objc(CompassPlugin)
public class CompassPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "CompassPlugin"
    public let jsName = "Compass"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private var manager: CLLocationManager?
    private var listeners = 0
    private var lastSent = Date.distantPast

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard CLLocationManager.headingAvailable() else { return call.reject("No compass", "UNAVAILABLE") }
            if self.manager == nil {
                let m = CLLocationManager()
                m.delegate = self
                m.headingFilter = 1
                self.manager = m
            }
            self.listeners += 1
            if self.listeners == 1 { self.manager?.startUpdatingHeading() }
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.listeners > 0 {
                self.listeners -= 1
                if self.listeners == 0 { self.manager?.stopUpdatingHeading() }
            }
            call.resolve()
        }
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateHeading h: CLHeading) {
        let now = Date()
        guard now.timeIntervalSince(lastSent) >= 0.05 else { return }
        lastSent = now
        let acc = h.headingAccuracy
        notifyListeners("heading", data: [
            "heading": h.magneticHeading >= 0 ? h.magneticHeading : NSNull(),
            "accuracy": acc >= 0 ? acc : NSNull(),
            "calibrate": acc < 0 || acc > 25,
        ])
    }

    /// The app shows its own hint (a figure-eight) instead of iOS's calibration screen.
    public func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool { false }
}

/// Prints the current page (the pokot sheet) or saves it as PDF through iOS's print sheet
/// (iPhone counterpart of PrinterPlugin.java; the web view ignores window.print()).
@objc(PrinterPlugin)
public class PrinterPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PrinterPlugin"
    public let jsName = "Printer"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "print", returnType: CAPPluginReturnPromise)]

    @objc func print(_ call: CAPPluginCall) {
        let name = call.getString("name") ?? "Polowanie"
        DispatchQueue.main.async {
            guard let web = self.bridge?.webView else { return call.reject("No page") }
            let info = UIPrintInfo(dictionary: nil)
            info.jobName = name
            info.outputType = .general
            let pc = UIPrintInteractionController.shared
            pc.printInfo = info
            pc.printFormatter = web.viewPrintFormatter()
            pc.present(animated: true) { _, _, _ in }
            call.resolve()
        }
    }
}

/// Reads first-aid steps aloud (iPhone counterpart of VoicePlugin.java), also in silent mode.
@objc(VoicePlugin)
public class VoicePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VoicePlugin"
    public let jsName = "Voice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "say", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hush", returnType: CAPPluginReturnPromise),
    ]

    private let synth = AVSpeechSynthesizer()

    @objc func available(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    @objc func say(_ call: CAPPluginCall) {
        let text = call.getString("text") ?? ""
        let lang = call.getString("lang") ?? "pl-PL"
        DispatchQueue.main.async {
            try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
            try? AVAudioSession.sharedInstance().setActive(true)
            self.synth.stopSpeaking(at: .immediate)
            let u = AVSpeechUtterance(string: text)
            u.voice = AVSpeechSynthesisVoice(language: lang) ?? AVSpeechSynthesisVoice(language: "pl-PL")
            self.synth.speak(u)
            call.resolve()
        }
    }

    @objc func hush(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.synth.stopSpeaking(at: .immediate)
            call.resolve()
        }
    }
}

/// Status bar icons dark or light to match the look chosen in the app, and the strip behind
/// the bars in the app's bar colour (iPhone counterpart of BarsPlugin.java).
@objc(BarsPlugin)
public class BarsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BarsPlugin"
    public let jsName = "Bars"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)]

    @objc func set(_ call: CAPPluginCall) {
        guard let color = Self.color(call.getString("color") ?? "#ffffff") else { return call.reject("Unknown colour") }
        let dark = call.getBool("dark") ?? false
        DispatchQueue.main.async {
            self.bridge?.statusBarStyle = dark ? .lightContent : .darkContent
            self.bridge?.viewController?.view.backgroundColor = color
            self.bridge?.webView?.backgroundColor = color
            self.bridge?.webView?.scrollView.backgroundColor = color
            call.resolve()
        }
    }

    private static func color(_ hex: String) -> UIColor? {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        return UIColor(red: CGFloat((v >> 16) & 0xff) / 255, green: CGFloat((v >> 8) & 0xff) / 255, blue: CGFloat(v & 0xff) / 255, alpha: 1)
    }
}
