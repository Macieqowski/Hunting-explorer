import UIKit
import UserNotifications
import Capacitor

/// The app's web view. Registers the app's own native plugins (the ones in this folder),
/// which are not npm packages and so are not found by Capacitor on its own.
/// The same set as MainActivity.java registers on Android, except Gps: on iOS the web view's
/// own location works without the Android problems that plugin solves.
class ViewController: CAPBridgeViewController {
    /// Capacitor's notification router keeps only a weak reference.
    private let notifications = ForegroundNotifications()

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BackgroundLocationPlugin())
        bridge?.registerPluginInstance(AlertsPlugin())
        bridge?.registerPluginInstance(CompassPlugin())
        bridge?.registerPluginInstance(PrinterPlugin())
        bridge?.registerPluginInstance(SpeechPlugin())
        bridge?.registerPluginInstance(VoicePlugin())
        bridge?.registerPluginInstance(BarsPlugin())
        bridge?.registerPluginInstance(TileDownloadPlugin())
        bridge?.notificationRouter.localNotificationHandler = notifications
    }
}

/// Notifications the app posts itself ("Mapy zapisane", hunt alerts) also show while the app is
/// on screen, as they do on Android. Without a handler Capacitor tells iOS to hide them.
final class ForegroundNotifications: NSObject, NotificationHandlerProtocol {
    func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    func didReceive(response: UNNotificationResponse) {}
}
