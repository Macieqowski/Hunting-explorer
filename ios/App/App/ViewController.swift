import UIKit
import Capacitor

/// The app's web view. Registers the app's own native plugins (the ones in this folder),
/// which are not npm packages and so are not found by Capacitor on its own.
/// The same set as MainActivity.java registers on Android, except Gps: on iOS the web view's
/// own location works without the Android problems that plugin solves.
class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BackgroundLocationPlugin())
        bridge?.registerPluginInstance(AlertsPlugin())
        bridge?.registerPluginInstance(CompassPlugin())
        bridge?.registerPluginInstance(PrinterPlugin())
        bridge?.registerPluginInstance(SpeechPlugin())
        bridge?.registerPluginInstance(VoicePlugin())
        bridge?.registerPluginInstance(BarsPlugin())
        bridge?.registerPluginInstance(TileDownloadPlugin())
    }
}
