import Foundation
import Capacitor
import HealthKit
import AVFoundation
import UIKit

@objc(IDIAHealthPlugin)
public class IDIAHealthPlugin: CAPPlugin, CAPBridgedPlugin, ObservableObject {
    public let identifier = "IDIAHealthPlugin"
    public let jsName = "IDIAHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkAvailability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "triggerHardwareAction", returnType: CAPPluginReturnPromise)
    ]

    private let audioEngine = AVAudioEngine()
    private let playerNode = AVAudioPlayerNode()
    private var originalBrightness: CGFloat = UIScreen.main.brightness

    // MARK: - HARDWARE COMMANDS (40Hz Gamma / 100% Brightness)
    
    @objc func triggerHardwareAction(_ call: CAPPluginCall) {
        guard let action = call.getString("action") else {
            call.reject("Missing hardware action identifier")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            if action == "CMD_INIT_FLASHBULB" {
                // Force 100% Brightness for Active Liveness [cite: 123]
                self.originalBrightness = UIScreen.main.brightness
                UIScreen.main.brightness = 1.0
                
                // Start Zero-Latency 40Hz Audio [cite: 270]
                self.setupAndStart40HzAudio()
                
                print("🍏 [GAMMA_TRIGGER] 40Hz sequence initiated at 100% brightness.")
                call.resolve(["status": "active"])
                
            } else if action == "CMD_STOP_FLASHBULB" {
                // Restore original system brightness
                UIScreen.main.brightness = self.originalBrightness
                self.stopAudio()
                
                print("🍏 [GAMMA_TRIGGER] Sequence terminated.")
                call.resolve(["status": "restored"])
            }
        }
    }

    private func setupAndStart40HzAudio() {
        let frequency: Float = 40.0
        let sampleRate = Float(audioEngine.mainMixerNode.outputFormat(forBus: 0).sampleRate)
        let capacity = AVAudioFrameCount(sampleRate)
        
        guard let buffer = AVAudioPCMBuffer(pcmFormat: playerNode.outputFormat(forBus: 0), frameCapacity: capacity) else { return }
        
        // Generate Pure 40Hz Sine Wave for Neural Entrainment
        for i in 0..<Int(capacity) {
            let val = sinf(2.0 * Float.pi * frequency * Float(i) / sampleRate)
            buffer.floatChannelData?[0][i] = val * 0.5
        }
        
        audioEngine.attach(playerNode)
        audioEngine.connect(playerNode, to: audioEngine.mainMixerNode, format: buffer.format)
        
        do {
            try audioEngine.start()
            playerNode.play()
            playerNode.scheduleBuffer(buffer, at: nil, options: .loops, completionHandler: nil)
        } catch {
            print("🚨 [AUDIO_ERROR] \(error)")
        }
    }

    private func stopAudio() {
        playerNode.stop()
        audioEngine.stop()
    }

    @objc func checkAvailability(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }
}
