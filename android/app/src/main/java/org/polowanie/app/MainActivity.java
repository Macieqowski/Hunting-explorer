package org.polowanie.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins that live in this app (not in npm packages) are registered before the bridge starts.
        registerPlugin(PrinterPlugin.class);
        registerPlugin(BackgroundLocationPlugin.class);
        registerPlugin(AlertsPlugin.class);
        registerPlugin(CompassPlugin.class);
        registerPlugin(BarsPlugin.class);
        registerPlugin(TileDownloadPlugin.class);
        registerPlugin(SpeechPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
