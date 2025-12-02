import AVFoundation

/// Manages all audio for the game including ambient sounds and sound effects
class SoundManager {
    static let shared = SoundManager()
    
    // Audio engine for ambient sounds (looping background)
    private var audioEngine: AVAudioEngine?
    private var ambientPlayer: AVAudioPlayerNode?
    private var ambientBuffer: AVAudioPCMBuffer?
    
    // Sound effect players (for quick one-shot sounds)
    private var effectPlayers: [String: AVAudioPlayer] = [:]
    
    // State
    private(set) var isAmbientPlaying: Bool = false
    private var ambientVolume: Float = 0.3  // Default ambient volume (30%)
    
    // User preference for sound (persisted)
    var isSoundEnabled: Bool {
        get { UserDefaults.standard.object(forKey: "aquarium_soundEnabled") as? Bool ?? true }
        set {
            UserDefaults.standard.set(newValue, forKey: "aquarium_soundEnabled")
            if newValue {
                resumeAmbientWithFade(duration: 0.5)
            } else {
                pauseAmbientWithFade(duration: 0.5)
            }
        }
    }
    
    // Sound effect names
    private static let fishSplashSound = "Fish adding to water"
    private static let babyBornSound = "Baby born"
    private static let predatorDartSound = "Predator darting"
    
    private init() {
        setupAudioSession()
        setupAudioEngine()
        loadAmbientSound()
        preloadSoundEffects()
    }
    
    private func preloadSoundEffects() {
        // Preload common sound effects for instant playback
        preloadEffect(named: SoundManager.fishSplashSound)
        preloadEffect(named: SoundManager.babyBornSound)
        preloadEffect(named: SoundManager.predatorDartSound)
    }
    
    // MARK: - Setup
    
    private func setupAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            // Use ambient category so audio mixes with other apps and respects silent switch
            try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            print("SoundManager: Failed to setup audio session: \(error)")
        }
    }
    
    private func setupAudioEngine() {
        audioEngine = AVAudioEngine()
        ambientPlayer = AVAudioPlayerNode()
        
        guard let engine = audioEngine, let player = ambientPlayer else { return }
        
        engine.attach(player)
        
        // Connection to mixer happens in loadAmbientFromURL when we know the audio format
    }
    
    /// Find a sound file in the bundle, checking multiple possible locations
    private func findSoundURL(named name: String, withExtension ext: String) -> URL? {
        // Try with subdirectory first
        if let url = Bundle.main.url(forResource: name, withExtension: ext, subdirectory: "Sound Effects") {
            return url
        }
        // Try without subdirectory (Xcode may flatten the structure)
        if let url = Bundle.main.url(forResource: name, withExtension: ext) {
            return url
        }
        // Debug: list what's in the bundle
        print("SoundManager: Could not find \(name).\(ext) in bundle")
        if let resourcePath = Bundle.main.resourcePath {
            let fileManager = FileManager.default
            if let contents = try? fileManager.contentsOfDirectory(atPath: resourcePath) {
                let cafFiles = contents.filter { $0.hasSuffix(".caf") }
                print("SoundManager: CAF files in bundle: \(cafFiles)")
            }
        }
        return nil
    }
    
    private func loadAmbientSound() {
        guard let url = findSoundURL(named: "Ocean noise", withExtension: "caf") else {
            return
        }
        loadAmbientFromURL(url)
    }
    
    private func loadAmbientFromURL(_ url: URL) {
        
        do {
            let audioFile = try AVAudioFile(forReading: url)
            let format = audioFile.processingFormat
            let frameCount = AVAudioFrameCount(audioFile.length)
            
            // Create buffer for the entire file
            guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else {
                print("SoundManager: Could not create audio buffer")
                return
            }
            
            try audioFile.read(into: buffer)
            ambientBuffer = buffer
            
            // Now connect the player with the correct format
            guard let engine = audioEngine, let player = ambientPlayer else { return }
            
            let mixer = engine.mainMixerNode
            engine.connect(player, to: mixer, format: format)
            
            // Set initial volume
            player.volume = ambientVolume
            
            // Start the engine
            try engine.start()
            
            print("SoundManager: Audio engine started, ambient sound loaded")
            
        } catch {
            print("SoundManager: Failed to load ambient sound: \(error)")
        }
    }
    
    // MARK: - Ambient Sound Control
    
    /// Start playing the ambient ocean sound (looped) with optional fade-in
    func startAmbient(fadeInDuration: TimeInterval = 0) {
        guard isSoundEnabled else { return }
        guard let player = ambientPlayer, let buffer = ambientBuffer else {
            print("SoundManager: Cannot start ambient - player or buffer not ready")
            return
        }
        
        guard !isAmbientPlaying else { return }
        
        // Start at zero volume if fading in
        if fadeInDuration > 0 {
            player.volume = 0
        } else {
            player.volume = ambientVolume
        }
        
        // Schedule the buffer to loop indefinitely
        player.scheduleBuffer(buffer, at: nil, options: .loops, completionHandler: nil)
        player.play()
        isAmbientPlaying = true
        
        // Fade in if duration specified
        if fadeInDuration > 0 {
            fadeAmbientVolume(to: ambientVolume, duration: fadeInDuration)
        }
        
        print("SoundManager: Ambient sound started\(fadeInDuration > 0 ? " with \(fadeInDuration)s fade-in" : "")")
    }
    
    /// Pause the ambient sound
    func pauseAmbient() {
        guard let player = ambientPlayer else { return }
        player.pause()
        isAmbientPlaying = false
    }
    
    /// Pause the ambient sound with fade out
    func pauseAmbientWithFade(duration: TimeInterval) {
        guard isAmbientPlaying else { return }
        
        fadeAmbientVolume(to: 0, duration: duration)
        
        // Pause after fade completes
        DispatchQueue.main.asyncAfter(deadline: .now() + duration + 0.05) { [weak self] in
            self?.ambientPlayer?.stop()  // Use stop() instead of pause() to fully reset
            self?.isAmbientPlaying = false
        }
    }
    
    /// Resume the ambient sound
    func resumeAmbient() {
        guard isSoundEnabled else { return }
        guard let player = ambientPlayer, let buffer = ambientBuffer else { return }
        
        if !isAmbientPlaying {
            // Need to reschedule the buffer after pause
            player.scheduleBuffer(buffer, at: nil, options: .loops, completionHandler: nil)
            player.play()
            isAmbientPlaying = true
        }
    }
    
    /// Resume the ambient sound with fade in
    func resumeAmbientWithFade(duration: TimeInterval) {
        guard let player = ambientPlayer else {
            print("SoundManager: Cannot resume - player not ready")
            return
        }
        guard let buffer = ambientBuffer else {
            print("SoundManager: Cannot resume - buffer not loaded")
            return
        }
        guard let engine = audioEngine else {
            print("SoundManager: Cannot resume - engine not ready")
            return
        }
        
        // Stop any current playback first to ensure clean state
        player.stop()
        isAmbientPlaying = false
        
        // Ensure engine is running
        if !engine.isRunning {
            do {
                try engine.start()
                print("SoundManager: Engine restarted")
            } catch {
                print("SoundManager: Failed to restart engine: \(error)")
                return
            }
        }
        
        // Start at zero volume
        player.volume = 0
        
        // Schedule the buffer to loop indefinitely
        player.scheduleBuffer(buffer, at: nil, options: .loops, completionHandler: nil)
        player.play()
        isAmbientPlaying = true
        
        // Fade in to the stored ambient volume (0.3 by default)
        print("SoundManager: Fading in to volume \(ambientVolume)")
        fadeAmbientVolume(to: ambientVolume, duration: duration)
        
        print("SoundManager: Ambient resumed with \(duration)s fade-in")
    }
    
    /// Stop the ambient sound completely
    func stopAmbient() {
        guard let player = ambientPlayer else { return }
        player.stop()
        isAmbientPlaying = false
    }
    
    /// Set the ambient volume (0.0 to 1.0)
    func setAmbientVolume(_ volume: Float) {
        ambientVolume = max(0, min(1, volume))
        ambientPlayer?.volume = ambientVolume
    }
    
    /// Fade ambient volume (for transitions)
    /// Note: This only changes the player volume, not the stored ambientVolume setting
    func fadeAmbientVolume(to targetVolume: Float, duration: TimeInterval) {
        let startVolume = ambientPlayer?.volume ?? 0
        let steps = 20
        let stepDuration = duration / Double(steps)
        let volumeStep = (targetVolume - startVolume) / Float(steps)
        
        for i in 0...steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + stepDuration * Double(i)) { [weak self] in
                let newVolume = startVolume + volumeStep * Float(i)
                self?.ambientPlayer?.volume = newVolume
            }
        }
    }
    
    // MARK: - Sound Effects
    
    /// Play the fish splash sound (when a fish is added to the aquarium)
    func playFishSplash() {
        playEffect(named: SoundManager.fishSplashSound, volume: 0.7)
    }
    
    /// Play the baby born sound (when fish reproduce)
    func playBabyBorn() {
        playEffect(named: SoundManager.babyBornSound, volume: 0.3)
    }
    
    /// Play the predator dart sound (when a predator lunges at prey)
    func playPredatorDart() {
        playEffect(named: SoundManager.predatorDartSound, volume: 0.5)
    }
    
    /// Preload a sound effect for later playback
    func preloadEffect(named name: String, extension ext: String = "caf") {
        guard let url = findSoundURL(named: name, withExtension: ext) else {
            return
        }
        
        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.prepareToPlay()
            effectPlayers[name] = player
            print("SoundManager: Preloaded effect \(name)")
        } catch {
            print("SoundManager: Failed to preload \(name): \(error)")
        }
    }
    
    /// Play a preloaded sound effect
    func playEffect(named name: String, volume: Float = 1.0) {
        guard isSoundEnabled else { return }
        
        if let player = effectPlayers[name] {
            player.volume = volume
            player.currentTime = 0
            player.play()
        } else {
            // Try to load and play on demand
            guard let url = findSoundURL(named: name, withExtension: "caf") else {
                print("SoundManager: Effect \(name) not found")
                return
            }
            
            do {
                let player = try AVAudioPlayer(contentsOf: url)
                player.volume = volume
                player.play()
                effectPlayers[name] = player
            } catch {
                print("SoundManager: Failed to play \(name): \(error)")
            }
        }
    }
    
    // MARK: - App Lifecycle
    
    /// Call when app enters background
    func handleEnterBackground() {
        pauseAmbient()
    }
    
    /// Call when app enters foreground
    func handleEnterForeground() {
        if isSoundEnabled {
            // Restart engine if needed
            if audioEngine?.isRunning == false {
                try? audioEngine?.start()
            }
            resumeAmbient()
        }
    }
}

