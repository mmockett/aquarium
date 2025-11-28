import Foundation
import CoreGraphics

// Shared definition for a Fish Species
struct Species: Identifiable {
    let id: String
    let name: String
    let cost: Int              // In-game currency cost (0 if IAP only)
    let size: CGFloat
    let speed: CGFloat
    let isPredator: Bool
    let folderName: String
    let description: String
    let thumbnailName: String
    let personality: FishPersonality
    let isIAP: Bool            // True if this species requires in-app purchase
    
    init(id: String, name: String, cost: Int, size: CGFloat, speed: CGFloat, isPredator: Bool, folderName: String, description: String, thumbnailName: String, personality: FishPersonality, isIAP: Bool = false) {
        self.id = id
        self.name = name
        self.cost = cost
        self.size = size
        self.speed = speed
        self.isPredator = isPredator
        self.folderName = folderName
        self.description = description
        self.thumbnailName = thumbnailName
        self.personality = personality
        self.isIAP = isIAP
    }
}

class SpeciesCatalog {
    static let shared = SpeciesCatalog()
    
    let allSpecies: [Species] = [
        Species(id: "basic", name: "River Spirit", cost: 100, size: 15, speed: 2.5, isPredator: false, folderName: "River Spirit", description: "Curious and bubbly", thumbnailName: "basic_thumb", personality: .curiousAndBubbly),
        
        Species(id: "starbit", name: "Star Bit Guppy", cost: 250, size: 10, speed: 4.0, isPredator: false, folderName: "Star Bit Guppy", description: "Energetic and fast", thumbnailName: "starbit_thumb", personality: .energeticStarlikeFast),
        
        Species(id: "kodama", name: "Kodama Tetra", cost: 350, size: 12, speed: 3.5, isPredator: false, folderName: "Kodama Tetra", description: "Playful and mysterious", thumbnailName: "kodama_thumb", personality: .playfulClickingMysterious),
        
        Species(id: "forest", name: "Mossy Carp", cost: 800, size: 25, speed: 1.8, isPredator: false, folderName: "Mossy Carp", description: "Slow, wise, and sleepy", thumbnailName: "forest_thumb", personality: .slowWiseSleepy),
        
        Species(id: "hunter", name: "Shadow Hunter", cost: 1200, size: 30, speed: 3.8, isPredator: true, folderName: "Shadow Hunter", description: "Aggressive predator", thumbnailName: "hunter_thumb", personality: .aggressiveHuntingSharp),
        
        Species(id: "sun", name: "Sky Spirit", cost: 2000, size: 35, speed: 3.0, isPredator: false, folderName: "Sky Spirit", description: "Majestic and noble", thumbnailName: "sun_thumb", personality: .majesticAncientNoble),
        
        Species(id: "lord", name: "River Lord", cost: 5000, size: 60, speed: 1.2, isPredator: true, folderName: "River Lord", description: "Massive and insatiable", thumbnailName: "lord_thumb", personality: .massiveSlowInsatiable),
        
        Species(id: "rainbow", name: "Rainbow Spirit", cost: 0, size: 45, speed: 3.5, isPredator: false, folderName: "Rainbow Spirit", description: "Colorful and radiant", thumbnailName: "rainbow_thumb", personality: .colorfulAndRadiant, isIAP: true)
    ]
    
    func species(for id: String) -> Species? {
        return allSpecies.first { $0.id == id }
    }
}
