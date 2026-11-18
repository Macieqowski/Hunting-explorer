import Foundation
import AVFoundation
import Speech
import Capacitor

/// Dictation for the oral exam (iPhone counterpart of SpeechPlugin.java): Apple's speech
/// recognition turns speech into text. Same events: "partial" { text }, "final" { text },
/// "error" { code: denied | network | audio | language | unknown }, "end" {} (always last).
/// iOS ends a recognition after about a minute, so a new one starts after each finished stretch
/// until stop() is called. Nothing is recorded or stored by the app.
@objc(SpeechPlugin)
public class SpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechPlugin"
    public let jsName = "Speech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    /// Stretches in a row with no words after which dictation stops on its own.
    private static let maxQuietRounds = 3

    // Main thread only.
    private var recognizer: SFSpeechRecognizer?
    private let audio = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var active = false
    private var stopping = false
    private var quietRounds = 0
    /// Words of the current stretch: sent as "final" when it ends.
    private var lastText = ""
    private var generation = 0

    @objc func available(_ call: CAPPluginCall) {
        call.resolve(["available": SFSpeechRecognizer(locale: Locale(identifier: "pl-PL"))?.isAvailable ?? false])
    }

    @objc func start(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "pl-PL"
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else { return call.reject("Speech recognition not allowed", "DENIED") }
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                DispatchQueue.main.async {
                    guard granted else { return call.reject("Microphone permission denied", "DENIED") }
                    guard let r = SFSpeechRecognizer(locale: Locale(identifier: lang)), r.isAvailable else {
                        return call.reject("No speech recognition for \(lang)", "UNAVAILABLE")
                    }
                    self.recognizer = r
                    self.active = true
                    self.stopping = false
                    self.quietRounds = 0
                    do {
                        let s = AVAudioSession.sharedInstance()
                        try s.setCategory(.record, mode: .measurement, options: [.duckOthers])
                        try s.setActive(true, options: .notifyOthersOnDeactivation)
                        let input = self.audio.inputNode
                        input.removeTap(onBus: 0)
                        input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { [weak self] buf, _ in
                            self?.request?.append(buf)
                        }
                        self.audio.prepare()
                        try self.audio.start()
                        self.listen()
                        call.resolve()
                    } catch {
                        self.active = false
                        self.release()
                        call.reject("Could not start speech recognition", "UNAVAILABLE")
                    }
                }
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.active {
                self.active = false
                self.stopping = true
                self.request?.endAudio()
                // The last words normally arrive as a final result; this is for when none comes.
                let g = self.generation
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { if self.generation == g { self.finish() } }
            }
            call.resolve()
        }
    }

    /// Starts one recognition (one stretch of speech).
    private func listen() {
        guard let r = recognizer else { return finish() }
        generation += 1
        let g = generation
        lastText = ""
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        req.taskHint = .dictation
        if #available(iOS 16.0, *) { req.addsPunctuation = true }
        request = req
        task = r.recognitionTask(with: req) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self = self, self.generation == g else { return }
                if let result = result {
                    let text = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespaces)
                    if result.isFinal {
                        return self.stretchEnded(text)
                    }
                    if !text.isEmpty {
                        self.lastText = text
                        self.notifyListeners("partial", data: ["text": text])
                    }
                }
                if let e = error as NSError? { self.failed(e) }
            }
        }
    }

    private func stretchEnded(_ text: String) {
        let t = text.isEmpty ? lastText : text
        lastText = ""
        if !t.isEmpty {
            quietRounds = 0
            notifyListeners("final", data: ["text": t])
        } else {
            quietRounds += 1
        }
        if active && quietRounds <= Self.maxQuietRounds {
            listen()
        } else {
            finish()
        }
    }

    private func failed(_ e: NSError) {
        // kAFAssistantErrorDomain 1110 / 203: no speech heard; 301: cancelled (our own restart).
        if e.domain == "kAFAssistantErrorDomain" && [1110, 203, 216, 301].contains(e.code) {
            return stretchEnded(lastText)
        }
        if !active { return finish() }
        let code: String
        switch (e.domain, e.code) {
        case ("kAFAssistantErrorDomain", 1700), ("kLSRErrorDomain", 201): code = "denied"
        case ("kAFAssistantErrorDomain", 1101), ("kAFAssistantErrorDomain", 1107): code = "network"
        case ("kAFAssistantErrorDomain", 1100): code = "audio"
        default: code = e.domain == NSURLErrorDomain ? "network" : "unknown"
        }
        notifyListeners("error", data: ["code": code])
        finish()
    }

    /// Ends dictation: frees the microphone and tells the page. Safe to call twice.
    private func finish() {
        if !active && !stopping && task == nil { return }
        active = false
        stopping = false
        generation += 1
        release()
        notifyListeners("end", data: [:])
    }

    private func release() {
        task?.cancel()
        task = nil
        request = nil
        if audio.isRunning { audio.stop() }
        audio.inputNode.removeTap(onBus: 0)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
