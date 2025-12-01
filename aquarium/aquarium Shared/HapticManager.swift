import UIKit

#if os(iOS)
import CoreHaptics

/// Manages haptic feedback for game events
class HapticManager {
    static let shared = HapticManager()
    
    private var lightImpact: UIImpactFeedbackGenerator?
    private var mediumImpact: UIImpactFeedbackGenerator?
    private var heavyImpact: UIImpactFeedbackGenerator?
    private var notificationFeedback: UINotificationFeedbackGenerator?
    
    // Core Haptics engine for custom patterns (predator rumble)
    private var engine: CHHapticEngine?
    private var supportsHaptics: Bool = false
    
    private init() {
        setupGenerators()
        setupCoreHaptics()
    }
    
    private func setupGenerators() {
        lightImpact = UIImpactFeedbackGenerator(style: .light)
        mediumImpact = UIImpactFeedbackGenerator(style: .medium)
        heavyImpact = UIImpactFeedbackGenerator(style: .heavy)
        notificationFeedback = UINotificationFeedbackGenerator()
        
        // Prepare generators for lower latency
        lightImpact?.prepare()
        mediumImpact?.prepare()
        heavyImpact?.prepare()
        notificationFeedback?.prepare()
    }
    
    /// Call this at app launch to fully initialize the haptic system
    /// This prevents the first real haptic from causing a delay
    func warmUp() {
        // Trigger a zero-intensity haptic to fully initialize the system
        // This happens during the loading screen so the delay isn't noticeable
        lightImpact?.impactOccurred(intensity: 0.0)
        
        // Re-prepare for next use
        lightImpact?.prepare()
        mediumImpact?.prepare()
        heavyImpact?.prepare()
        notificationFeedback?.prepare()
    }
    
    private func setupCoreHaptics() {
        // Check if device supports haptics
        supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics
        
        guard supportsHaptics else { return }
        
        do {
            engine = try CHHapticEngine()
            engine?.isAutoShutdownEnabled = true
            
            // Handle engine reset
            engine?.resetHandler = { [weak self] in
                do {
                    try self?.engine?.start()
                } catch {
                    print("Failed to restart haptic engine: \(error)")
                }
            }
            
            try engine?.start()
        } catch {
            print("Failed to create haptic engine: \(error)")
            supportsHaptics = false
        }
    }
    
    // MARK: - Public Haptic Methods
    
    /// Light tap when food is dropped
    func foodDropped() {
        lightImpact?.impactOccurred(intensity: 0.5)
    }
    
    /// Soft feedback when a fish eats food
    func fishAte() {
        lightImpact?.impactOccurred(intensity: 0.7)
    }
    
    /// Sad notification when a fish dies
    func fishDied() {
        notificationFeedback?.notificationOccurred(.warning)
    }
    
    /// Big rumble when a predator catches prey
    func predatorCaughtPrey() {
        if supportsHaptics {
            playPredatorRumble()
        } else {
            // Fallback to heavy impact
            heavyImpact?.impactOccurred(intensity: 1.0)
        }
    }
    
    // MARK: - UI Haptic Methods
    
    /// Light tap for button presses
    func buttonTap() {
        lightImpact?.impactOccurred(intensity: 0.6)
    }
    
    /// Toggle feedback (on/off switches)
    func toggleChanged() {
        lightImpact?.impactOccurred(intensity: 0.5)
    }
    
    /// Success feedback (purchase, etc)
    func success() {
        notificationFeedback?.notificationOccurred(.success)
    }
    
    /// Error feedback (failed action, etc)
    func error() {
        notificationFeedback?.notificationOccurred(.error)
    }
    
    /// Selection changed feedback
    private var selectionFeedback: UISelectionFeedbackGenerator?
    
    func selectionChanged() {
        if selectionFeedback == nil {
            selectionFeedback = UISelectionFeedbackGenerator()
            selectionFeedback?.prepare()
        }
        selectionFeedback?.selectionChanged()
    }
    
    /// Custom rumble pattern for predator attack
    private func playPredatorRumble() {
        guard supportsHaptics, let engine = engine else {
            heavyImpact?.impactOccurred(intensity: 1.0)
            return
        }
        
        do {
            // Create a rumble pattern: quick intense bursts
            let sharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.3)
            let intensity1 = CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0)
            let intensity2 = CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.7)
            let intensity3 = CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.4)
            
            // Three quick rumbles that fade out
            let event1 = CHHapticEvent(eventType: .hapticContinuous, parameters: [intensity1, sharpness], relativeTime: 0, duration: 0.1)
            let event2 = CHHapticEvent(eventType: .hapticContinuous, parameters: [intensity2, sharpness], relativeTime: 0.12, duration: 0.08)
            let event3 = CHHapticEvent(eventType: .hapticContinuous, parameters: [intensity3, sharpness], relativeTime: 0.22, duration: 0.06)
            
            let pattern = try CHHapticPattern(events: [event1, event2, event3], parameters: [])
            let player = try engine.makePlayer(with: pattern)
            
            try engine.start()
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            // Fallback to heavy impact
            heavyImpact?.impactOccurred(intensity: 1.0)
        }
    }
}

#else
// macOS/tvOS stub
class HapticManager {
    static let shared = HapticManager()
    private init() {}
    
    func foodDropped() {}
    func fishAte() {}
    func fishDied() {}
    func predatorCaughtPrey() {}
    func buttonTap() {}
    func toggleChanged() {}
    func success() {}
    func error() {}
    func selectionChanged() {}
}
#endif

