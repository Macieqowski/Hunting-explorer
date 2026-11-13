package org.polowanie.app;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

/**
 * Dictation for the oral exam: the phone's speech recognition service (usually Google's) turns
 * speech into text. The app's WebView has no Web Speech API, so this plugin stands in for it.
 *
 * Android's recognizer stops after every pause, so it is started again until stop() is called;
 * each finished stretch arrives as a "final" event and the words being spoken as "partial".
 * Events: "partial" { text }, "final" { text }, "error" { code: denied | network | audio |
 * language | unknown }, "end" {} (always last, also after an error or a long silence).
 * Nothing is recorded or stored by the app.
 */
@CapacitorPlugin(name = "Speech", permissions = { @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }) })
public class SpeechPlugin extends Plugin implements RecognitionListener {

    /** Rounds in a row with no speech (each a few seconds) after which dictation stops on its own. */
    private static final int MAX_QUIET_ROUNDS = 12;
    private static final int ERROR_LANGUAGE_NOT_SUPPORTED = 12;
    private static final int ERROR_LANGUAGE_UNAVAILABLE = 13;

    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private String lang = "pl-PL";
    /** Dictation is wanted: listen again after each stretch. */
    private boolean active = false;
    /** stop() was called and the last stretch is still being recognized. */
    private boolean stopping = false;
    private int quietRounds = 0;

    private final Runnable relisten = () -> {
        if (active) listen();
    };
    private final Runnable forceEnd = this::finish;

    @PluginMethod
    public void available(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("No speech recognition service", "UNAVAILABLE");
            return;
        }
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "afterMicrophone");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void afterMicrophone(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone permission denied", "DENIED");
            return;
        }
        begin(call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> {
            if (active) {
                active = false;
                stopping = true;
                main.removeCallbacks(relisten);
                if (recognizer != null) recognizer.stopListening();
                // The last words normally arrive in onResults; this is for services that never answer.
                main.postDelayed(forceEnd, 2000);
            }
            call.resolve();
        });
    }

    /** The recognizer must be created and used on the main thread. */
    private void begin(PluginCall call) {
        final String wanted = call.getString("lang", "pl-PL");
        main.post(() -> {
            main.removeCallbacks(forceEnd);
            lang = wanted;
            active = true;
            stopping = false;
            quietRounds = 0;
            try {
                listen();
                call.resolve();
            } catch (RuntimeException e) {
                active = false;
                release();
                call.reject("Could not start speech recognition", "UNAVAILABLE", e);
            }
        });
    }

    private void listen() {
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(this);
        }
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        recognizer.startListening(i);
    }

    /** Ends dictation: frees the recognizer and tells the page. Safe to call twice. */
    private void finish() {
        main.removeCallbacks(forceEnd);
        main.removeCallbacks(relisten);
        if (!active && !stopping) return;
        active = false;
        stopping = false;
        release();
        notifyListeners("end", new JSObject());
    }

    private void release() {
        if (recognizer == null) return;
        try {
            recognizer.destroy();
        } catch (RuntimeException ignored) {
            // The service is already gone.
        }
        recognizer = null;
    }

    private void fail(String code) {
        JSObject o = new JSObject();
        o.put("code", code);
        notifyListeners("error", o);
        finish();
    }

    private static String first(Bundle b) {
        if (b == null) return "";
        ArrayList<String> l = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return l == null || l.isEmpty() || l.get(0) == null ? "" : l.get(0).trim();
    }

    private void send(String event, String text) {
        JSObject o = new JSObject();
        o.put("text", text);
        notifyListeners(event, o);
    }

    @Override
    public void onPartialResults(Bundle partialResults) {
        String text = first(partialResults);
        if (!text.isEmpty()) send("partial", text);
    }

    @Override
    public void onResults(Bundle results) {
        String text = first(results);
        if (!text.isEmpty()) {
            quietRounds = 0;
            send("final", text);
        }
        if (active) main.postDelayed(relisten, 100);
        else finish();
    }

    @Override
    public void onError(int error) {
        if (!active) {
            finish();
            return;
        }
        switch (error) {
            case SpeechRecognizer.ERROR_NO_MATCH:
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
            case SpeechRecognizer.ERROR_CLIENT:
                // Silence, or the service was not ready yet: listen again, but not forever.
                if (++quietRounds > MAX_QUIET_ROUNDS) finish();
                else main.postDelayed(relisten, error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY ? 400 : 150);
                break;
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                fail("denied");
                break;
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
            case SpeechRecognizer.ERROR_SERVER:
                fail("network");
                break;
            case SpeechRecognizer.ERROR_AUDIO:
                fail("audio");
                break;
            case ERROR_LANGUAGE_NOT_SUPPORTED:
            case ERROR_LANGUAGE_UNAVAILABLE:
                fail("language");
                break;
            default:
                fail("unknown");
        }
    }

    @Override
    public void onReadyForSpeech(Bundle params) {}

    @Override
    public void onBeginningOfSpeech() {}

    @Override
    public void onRmsChanged(float rmsdB) {}

    @Override
    public void onBufferReceived(byte[] buffer) {}

    @Override
    public void onEndOfSpeech() {}

    @Override
    public void onEvent(int eventType, Bundle params) {}

    /** The microphone is not held while the app is in the background. */
    @Override
    protected void handleOnPause() {
        main.post(this::finish);
    }

    @Override
    protected void handleOnDestroy() {
        main.post(() -> {
            finish();
            release();
        });
    }
}
