import Foundation
import SwiftUI
import Combine

// MARK: - Spirit Event (Log Entry for Deaths and Births)
enum SpiritEventType: String, Codable {
    case death
    case birth
}

struct SpiritEvent: Identifiable, Codable {
    let id: UUID
    let type: SpiritEventType
    let timestamp: Date
    
    // Death-specific fields
    let deceasedName: String?
    let speciesName: String?
    let deathReason: String?
    let ageAtDeath: TimeInterval?
    
    // Birth-specific fields
    let parent1Name: String?
    let parent2Name: String?
    let babyNames: [String]?
    
    var formattedAge: String? {
        guard let age = ageAtDeath else { return nil }
        if age < 60 {
            return "\(Int(age))s"
        } else if age < 3600 {
            let minutes = Int(age / 60)
            return "\(minutes)m"
        } else {
            let hours = Int(age / 3600)
            let minutes = Int((age.truncatingRemainder(dividingBy: 3600)) / 60)
            return minutes > 0 ? "\(hours)h \(minutes)m" : "\(hours)h"
        }
    }
    
    // Convenience initializers
    static func death(name: String, species: String, reason: String, age: TimeInterval) -> SpiritEvent {
        SpiritEvent(
            id: UUID(),
            type: .death,
            timestamp: Date(),
            deceasedName: name,
            speciesName: species,
            deathReason: reason,
            ageAtDeath: age,
            parent1Name: nil,
            parent2Name: nil,
            babyNames: nil
        )
    }
    
    static func birth(parent1: String, parent2: String, babies: [String], species: String) -> SpiritEvent {
        SpiritEvent(
            id: UUID(),
            type: .birth,
            timestamp: Date(),
            deceasedName: nil,
            speciesName: species,
            deathReason: nil,
            ageAtDeath: nil,
            parent1Name: parent1,
            parent2Name: parent2,
            babyNames: babies
        )
    }
}

// MARK: - Saved Fish State (for persistence)
struct SavedFishState: Codable {
    let speciesId: String
    let name: String
    let positionX: CGFloat
    let positionY: CGFloat
    let energy: CGFloat
    let scaleFactor: CGFloat
    let birthTime: TimeInterval
    let lifespan: TimeInterval
}

class GameData: ObservableObject {
    static let shared = GameData()
    
    @Published var score: Int = 100
    @Published var showShop: Bool = false
    @Published var showMemories: Bool = false {
        didSet {
            if showMemories {
                // Reset unread count when drawer is opened
                unreadMemoriesCount = 0
            }
        }
    }
    @Published var isTalkMode: Bool = false
    @Published var isAutoFeed: Bool = false
    @Published var showSettings: Bool = false
    @Published var uiVisible: Bool = true
    
    // Settings
    @Published var selectedBackground: Int = 1  // 1-4
    @Published var showDebugInfo: Bool = false
    @Published var timeSpeed: Double = 2.0  // 0 = stopped, 1 = realtime (24h), 2 = normal (5min), 3 = fast (1min)
    
    // Time speed presets (cycle duration in seconds)
    // Order: Stopped -> Realtime -> Normal -> Fast
    // 0 = stopped (infinite), 1 = realtime (86400s = 24h), 2 = normal (300s = 5min), 3 = fast (60s = 1min)
    var cycleDuration: CGFloat {
        let speed = Int(timeSpeed.rounded())
        switch speed {
        case 0: return CGFloat.infinity  // Stopped
        case 1: return 86400.0           // Realtime (24 hour full cycle)
        case 2: return 300.0             // Normal (5 minute full cycle)
        case 3: return 60.0              // Fast (1 minute full cycle)
        default: return 300.0
        }
    }
    
    var timeSpeedLabel: String {
        let speed = Int(timeSpeed.rounded())
        switch speed {
        case 0: return "Stopped"
        case 1: return "Real Time"
        case 2: return "Normal"
        case 3: return "Fast"
        default: return "Normal"
        }
    }
    
    // Debug info (updated by GameScene)
    @Published var nodeCount: Int = 0
    @Published var currentFPS: Int = 0
    
    // Callback for game restart (set by GameScene)
    var onRestartGame: (() -> Void)?
    
    // Callback for background change (set by GameScene)
    var onBackgroundChanged: (() -> Void)?
    
    // Spirit Events (deaths and births)
    @Published var spiritEvents: [SpiritEvent] = []
    @Published var unreadMemoriesCount: Int = 0  // Badge count for new events since last viewed
    private let maxEvents = 50  // Keep last 50 events
    
    // Stats tracking (persisted)
    @Published var totalBirths: Int = 0
    @Published var totalDeaths: Int = 0
    @Published var currentAliveFish: Int = 0  // Updated by GameScene
    @Published var aliveFishBySpecies: [String: Int] = [:]  // Updated by GameScene - speciesId -> count
    
    // Fish state for persistence (set by GameScene before saving)
    var savedFishStates: [SavedFishState] = []
    
    // Unlocked species (persisted) - "basic" is always unlocked
    @Published var unlockedSpecies: Set<String> = ["basic"]
    
    // IAP-purchased species (persisted separately from in-game unlocks)
    @Published var iapPurchasedSpecies: Set<String> = []
    
    // Shop Items: Show unlocked species + affordable locked species + IAP species
    var shopItems: [Species] {
        return SpeciesCatalog.shared.allSpecies.filter { species in
            if species.isIAP {
                // Always show IAP species (they have a special purchase flow)
                return true
            }
            // Show if already unlocked OR if player can afford it
            return unlockedSpecies.contains(species.id) || score >= species.cost
        }
    }
    
    // Check if species is unlocked (for UI display)
    func isSpeciesUnlocked(_ speciesId: String) -> Bool {
        // Check both regular unlocks and IAP purchases
        return unlockedSpecies.contains(speciesId) || iapPurchasedSpecies.contains(speciesId)
    }
    
    // Check if species requires IAP and hasn't been purchased
    func requiresIAPPurchase(_ speciesId: String) -> Bool {
        guard let species = SpeciesCatalog.shared.species(for: speciesId) else { return false }
        return species.isIAP && !iapPurchasedSpecies.contains(speciesId)
    }
    
    // Unlock an IAP species (called by StoreManager after successful purchase)
    func unlockIAPSpecies(_ speciesId: String) {
        if !iapPurchasedSpecies.contains(speciesId) {
            iapPurchasedSpecies.insert(speciesId)
            saveState()
        }
    }
    
    // Check if there are locked species that aren't yet affordable (excluding IAP species)
    var hasLockedSpecies: Bool {
        return SpeciesCatalog.shared.allSpecies.contains { species in
            !species.isIAP && !unlockedSpecies.contains(species.id) && score < species.cost
        }
    }
    
    // Get the next locked species (cheapest one not yet affordable, excluding IAP)
    var nextLockedSpecies: Species? {
        return SpeciesCatalog.shared.allSpecies
            .filter { !$0.isIAP && !unlockedSpecies.contains($0.id) && score < $0.cost }
            .sorted { $0.cost < $1.cost }
            .first
    }
    
    // MARK: - Persistence Keys
    private let scoreKey = "aquarium_score"
    private let eventsKey = "aquarium_spiritEvents"
    private let fishKey = "aquarium_fishStates"
    private let autoFeedKey = "aquarium_autoFeed"
    private let totalBirthsKey = "aquarium_totalBirths"
    private let totalDeathsKey = "aquarium_totalDeaths"
    private let unlockedSpeciesKey = "aquarium_unlockedSpecies"
    private let iapPurchasedKey = "aquarium_iapPurchased"
    private let backgroundKey = "aquarium_background"
    private let debugInfoKey = "aquarium_debugInfo"
    private let timeSpeedKey = "aquarium_timeSpeed"
    private let lastSaveTimeKey = "aquarium_lastSaveTime"
    
    // Elapsed time since last save (used to pause fish aging while app is closed)
    var elapsedTimeSinceLastSave: TimeInterval = 0
    
    // MARK: - Initialization
    private init() {
        loadState()
    }
    
    func addScore(_ amount: Int) {
        score += amount
    }
    
    func purchase(cost: Int, speciesId: String) -> Bool {
        if score >= cost {
            score -= cost
            // Unlock the species when first purchased
            if !unlockedSpecies.contains(speciesId) {
                unlockedSpecies.insert(speciesId)
            }
            return true
        }
        return false
    }
    
    func addSpiritMemory(name: String, speciesName: String, deathReason: String, ageAtDeath: TimeInterval) {
        let event = SpiritEvent.death(name: name, species: speciesName, reason: deathReason, age: ageAtDeath)
        addEvent(event)
        totalDeaths += 1
    }
    
    func addBirthEvent(parent1: String, parent2: String, babyNames: [String], speciesName: String) {
        let event = SpiritEvent.birth(parent1: parent1, parent2: parent2, babies: babyNames, species: speciesName)
        addEvent(event)
        totalBirths += babyNames.count
    }
    
    private func addEvent(_ event: SpiritEvent) {
        // Insert at beginning (newest first)
        spiritEvents.insert(event, at: 0)
        
        // Increment unread count (only if drawer is not currently open)
        if !showMemories {
            unreadMemoriesCount += 1
        }
        
        // Trim to max size
        if spiritEvents.count > maxEvents {
            spiritEvents = Array(spiritEvents.prefix(maxEvents))
        }
    }
    
    // MARK: - Persistence
    
    func saveState() {
        let defaults = UserDefaults.standard
        
        // Save score
        defaults.set(score, forKey: scoreKey)
        
        // Save autoFeed setting
        defaults.set(isAutoFeed, forKey: autoFeedKey)
        
        // Save stats
        defaults.set(totalBirths, forKey: totalBirthsKey)
        defaults.set(totalDeaths, forKey: totalDeathsKey)
        
        // Save unlocked species
        defaults.set(Array(unlockedSpecies), forKey: unlockedSpeciesKey)
        
        // Save IAP purchased species
        defaults.set(Array(iapPurchasedSpecies), forKey: iapPurchasedKey)
        
        // Save settings
        defaults.set(selectedBackground, forKey: backgroundKey)
        defaults.set(showDebugInfo, forKey: debugInfoKey)
        defaults.set(timeSpeed, forKey: timeSpeedKey)
        
        // Save spirit events
        if let eventsData = try? JSONEncoder().encode(spiritEvents) {
            defaults.set(eventsData, forKey: eventsKey)
        }
        
        // Save fish states (set by GameScene before calling saveState)
        if let fishData = try? JSONEncoder().encode(savedFishStates) {
            defaults.set(fishData, forKey: fishKey)
        }
        
        // Save the current time so we can calculate elapsed time on next load
        defaults.set(Date().timeIntervalSince1970, forKey: lastSaveTimeKey)
        
        defaults.synchronize()
        print("GameData: Saved state - Score: \(score), Fish: \(savedFishStates.count), Events: \(spiritEvents.count), Unlocked: \(unlockedSpecies.count)")
    }
    
    func loadState() {
        let defaults = UserDefaults.standard
        
        // Load score
        if defaults.object(forKey: scoreKey) != nil {
            score = defaults.integer(forKey: scoreKey)
        }
        
        // Load autoFeed setting
        isAutoFeed = defaults.bool(forKey: autoFeedKey)
        
        // Load stats
        totalBirths = defaults.integer(forKey: totalBirthsKey)
        totalDeaths = defaults.integer(forKey: totalDeathsKey)
        
        // Load unlocked species (always include "basic")
        if let unlocked = defaults.stringArray(forKey: unlockedSpeciesKey) {
            unlockedSpecies = Set(unlocked)
            unlockedSpecies.insert("basic")  // Ensure basic is always unlocked
        }
        
        // Load IAP purchased species
        if let iapPurchased = defaults.stringArray(forKey: iapPurchasedKey) {
            iapPurchasedSpecies = Set(iapPurchased)
        }
        
        // Load settings
        let bg = defaults.integer(forKey: backgroundKey)
        selectedBackground = bg > 0 ? bg : 1  // Default to 1 if not set
        showDebugInfo = defaults.bool(forKey: debugInfoKey)
        
        // Load time speed (default to 2.0 = normal if not set)
        // Note: We check for existence since 0 is a valid value (stopped)
        if defaults.object(forKey: timeSpeedKey) != nil {
            let loadedSpeed = defaults.double(forKey: timeSpeedKey)
            // Ensure it's a valid value (0, 1, 2, or 3)
            timeSpeed = loadedSpeed.rounded()
            if timeSpeed < 0 || timeSpeed > 3 {
                timeSpeed = 2.0  // Default to Normal if invalid
            }
            #if DEBUG
            print("GameData: Loaded timeSpeed = \(timeSpeed) (raw: \(loadedSpeed))")
            #endif
        } else {
            timeSpeed = 2.0  // Default to Normal (5 min cycle)
            #if DEBUG
            print("GameData: No saved timeSpeed, defaulting to \(timeSpeed)")
            #endif
        }
        
        // Load spirit events
        if let eventsData = defaults.data(forKey: eventsKey),
           let events = try? JSONDecoder().decode([SpiritEvent].self, from: eventsData) {
            spiritEvents = events
        }
        
        // Load fish states
        if let fishData = defaults.data(forKey: fishKey),
           let fish = try? JSONDecoder().decode([SavedFishState].self, from: fishData) {
            savedFishStates = fish
        }
        
        // Calculate elapsed time since last save (fish don't age while app is closed)
        let lastSaveTime = defaults.double(forKey: lastSaveTimeKey)
        if lastSaveTime > 0 {
            elapsedTimeSinceLastSave = Date().timeIntervalSince1970 - lastSaveTime
            print("GameData: App was closed for \(Int(elapsedTimeSinceLastSave)) seconds")
        } else {
            elapsedTimeSinceLastSave = 0
        }
        
        print("GameData: Loaded state - Score: \(score), Fish: \(savedFishStates.count), Events: \(spiritEvents.count), Unlocked: \(unlockedSpecies.count)")
    }
    
    /// Check if there's saved game data to restore
    var hasSavedFish: Bool {
        return !savedFishStates.isEmpty
    }
    
    /// Clear saved fish states after restoring
    func clearSavedFishStates() {
        savedFishStates = []
    }
    
    /// Reset all game progress (called from settings)
    func restartGame() {
        // Reset stats
        score = 100
        totalBirths = 0
        totalDeaths = 0
        currentAliveFish = 0
        
        // Clear events
        spiritEvents = []
        unreadMemoriesCount = 0
        
        // Reset unlocked species to just basic
        unlockedSpecies = ["basic"]
        
        // Clear saved fish
        savedFishStates = []
        
        // Notify GameScene to restart
        onRestartGame?()
        
        // Save the reset state
        saveState()
    }
}
