import UIKit
import Capacitor

/// The app's web view. Registers the app's own native plugins (the ones in this folder),
/// which are not npm packages and so are not found by Capacitor on its own.
class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BackgroundLocationPlugin())
    }
}
