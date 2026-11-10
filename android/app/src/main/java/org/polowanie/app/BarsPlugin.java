package org.polowanie.app;

import android.content.res.Configuration;
import android.graphics.Color;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Colours the strips behind the status bar (top) and the navigation bar (bottom) like the app's
 * own bars, and makes the system icons on them dark or light to match. The light or dark look is
 * chosen in the app and can differ from the phone's setting, so Android cannot work it out itself.
 */
@CapacitorPlugin(name = "Bars")
public class BarsPlugin extends Plugin {

    private Integer color = null;
    private boolean dark = false;

    @PluginMethod
    public void set(PluginCall call) {
        try {
            color = Color.parseColor(call.getString("color", "#ffffff"));
        } catch (IllegalArgumentException e) {
            call.reject("Unknown colour");
            return;
        }
        dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        getActivity().runOnUiThread(() -> {
            apply();
            call.resolve();
        });
    }

    /** Turning the phone or switching its dark mode makes Capacitor repaint the strips; paint ours again after it. */
    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        if (color != null) getActivity().getWindow().getDecorView().post(this::apply);
    }

    @SuppressWarnings("deprecation")
    private void apply() {
        if (color == null) return;
        try {
            Window window = getActivity().getWindow();
            // The page does not reach under the system bars: the window's own background shows there.
            window.getDecorView().setBackgroundColor(color);
            // Android 14 and older still paint the bars themselves (no effect on newer versions).
            window.setStatusBarColor(color);
            window.setNavigationBarColor(color);
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            controller.setAppearanceLightStatusBars(!dark);
            controller.setAppearanceLightNavigationBars(!dark);
        } catch (Exception e) {
            // Cosmetic only: the bars keep the system colours.
        }
    }
}
