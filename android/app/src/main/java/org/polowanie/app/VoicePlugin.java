package org.polowanie.app;

import android.speech.tts.TextToSpeech;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;

/**
 * Reads first-aid steps aloud with the phone's text-to-speech engine, so the person helping keeps
 * both hands on the injured. The app's WebView has no speech synthesis, so this stands in for it.
 * The engine starts on the first say() and is shut down with the app.
 */
@CapacitorPlugin(name = "Voice")
public class VoicePlugin extends Plugin {

    private TextToSpeech tts;
    private boolean ready = false;
    /** Asked for before the engine was ready: read once it is. */
    private String pendingText;
    private String pendingLang;

    private void ensure() {
        if (tts != null) return;
        tts = new TextToSpeech(getContext(), (status) -> {
            ready = status == TextToSpeech.SUCCESS;
            if (ready && pendingText != null) {
                speakNow(pendingText, pendingLang);
                pendingText = null;
            }
        });
    }

    private void speakNow(String text, String lang) {
        Locale loc = Locale.forLanguageTag(lang == null ? "pl-PL" : lang);
        int ok = tts.setLanguage(loc);
        if (ok == TextToSpeech.LANG_MISSING_DATA || ok == TextToSpeech.LANG_NOT_SUPPORTED) tts.setLanguage(Locale.getDefault());
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "aid");
    }

    @PluginMethod
    public void available(PluginCall call) {
        ensure();
        JSObject r = new JSObject();
        r.put("available", true);
        call.resolve(r);
    }

    @PluginMethod
    public void say(PluginCall call) {
        String text = call.getString("text", "");
        String lang = call.getString("lang", "pl-PL");
        ensure();
        if (ready) speakNow(text, lang);
        else {
            pendingText = text;
            pendingLang = lang;
        }
        call.resolve();
    }

    @PluginMethod
    public void hush(PluginCall call) {
        pendingText = null;
        if (tts != null && ready) tts.stop();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
    }
}
