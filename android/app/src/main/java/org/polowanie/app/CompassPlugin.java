package org.polowanie.app;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Compass from Android's rotation-vector sensor, with what the browser's compass events lack:
 * how accurate the heading is and whether the magnetometer needs calibrating (a figure-eight).
 *
 * "heading" events: { heading (degrees from magnetic north, or null when the phone points
 * straight up or down), accuracy (degrees, or null), calibrate (boolean) }. The heading is where
 * the back camera looks when the phone is held upright, or where its top edge points when flat:
 * the same rule as headingFromOrientation in src/hunt.ts.
 */
@CapacitorPlugin(name = "Compass")
public class CompassPlugin extends Plugin implements SensorEventListener {

    private SensorManager sensors;
    private int listeners = 0;
    private int magAccuracy = SensorManager.SENSOR_STATUS_ACCURACY_HIGH;
    private long lastSent = 0;
    private final float[] rot = new float[9];

    @Override
    public void load() {
        sensors = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
    }

    @PluginMethod
    public void start(PluginCall call) {
        Sensor rv = rotationSensor();
        if (rv == null) {
            call.reject("No compass", "UNAVAILABLE");
            return;
        }
        if (listeners++ == 0) {
            sensors.registerListener(this, rv, SensorManager.SENSOR_DELAY_GAME);
            Sensor mag = sensors.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
            if (mag != null) sensors.registerListener(this, mag, SensorManager.SENSOR_DELAY_UI);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (listeners > 0 && --listeners == 0) sensors.unregisterListener(this);
        call.resolve();
    }

    /** Phones without a gyroscope only have the geomagnetic variant (noisier, still usable). */
    private Sensor rotationSensor() {
        if (sensors == null) return null;
        Sensor s = sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        return s != null ? s : sensors.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR);
    }

    @Override
    public void onSensorChanged(SensorEvent e) {
        if (e.sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) {
            magAccuracy = e.accuracy;
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastSent < 50) return; // 20 a second is plenty for an arrow
        lastSent = now;
        SensorManager.getRotationMatrixFromVector(rot, e.values);
        // Columns of rot are the phone's axes in earth coordinates (x east, y north, z up).
        double backX = -rot[2], backY = -rot[5];
        double topX = rot[1], topY = rot[4];
        double flatness = Math.hypot(backX, backY); // 0 = lying flat, 1 = upright
        double vx = flatness > 0.6 ? backX : topX;
        double vy = flatness > 0.6 ? backY : topY;
        JSObject o = new JSObject();
        if (Math.hypot(vx, vy) < 0.2) o.put("heading", JSObject.NULL);
        else o.put("heading", (Math.toDegrees(Math.atan2(vx, vy)) + 360) % 360);
        // values[4]: estimated heading accuracy in radians, -1 when unknown.
        double acc = e.values.length > 4 && e.values[4] >= 0 ? Math.toDegrees(e.values[4]) : -1;
        if (acc >= 0) o.put("accuracy", acc);
        else o.put("accuracy", JSObject.NULL);
        o.put("calibrate", magAccuracy <= SensorManager.SENSOR_STATUS_ACCURACY_LOW || acc > 25);
        notifyListeners("heading", o);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        if (sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) magAccuracy = accuracy;
    }

    @Override
    protected void handleOnPause() {
        if (listeners > 0) sensors.unregisterListener(this);
        super.handleOnPause();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (listeners > 0) {
            sensors.registerListener(this, rotationSensor(), SensorManager.SENSOR_DELAY_GAME);
            Sensor mag = sensors.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
            if (mag != null) sensors.registerListener(this, mag, SensorManager.SENSOR_DELAY_UI);
        }
    }
}
