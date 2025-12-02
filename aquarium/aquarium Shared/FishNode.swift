import SpriteKit

// MARK: - FishNode
class FishNode: SKNode {
    
    // MARK: - Properties
    let species: Species
    var velocity: Vector
    var acceleration: Vector
    var angularVelocity: CGFloat = 0
    
    // Identity
    private(set) var fishName: String
    private(set) var birthTime: TimeInterval  // For determining school leader (oldest fish leads)
    private(set) var lifespan: TimeInterval   // How long this fish will live (seconds)
    
    // State
    var energy: CGFloat = 100
    var maxEnergy: CGFloat = 100
    var isDead: Bool = false
    
    // UI Elements (for talk mode) - added to scene, not fish, for efficiency
    // Single label with attributed text for name + hunger (no shadow)
    private(set) var infoLabel: SKLabelNode?
    
    // Speech bubble (lazy-created only when fish speaks)
    private(set) var speechBubble: SKNode?
    private(set) var speechLabel: SKLabelNode?
    private var speechTimer: TimeInterval = 0  // Countdown until speech disappears
    
    // Legacy accessors for compatibility
    var nameLabel: SKLabelNode? { infoLabel }
    var nameShadow: SKLabelNode? { nil }  // Removed for performance
    var hungerLabel: SKLabelNode? { nil }  // Combined into infoLabel
    
    // Feeding Nuances
    var isDarting: Bool = false
    var currentFoodTarget: FoodNode? {
        didSet {
            if let old = oldValue, old !== currentFoodTarget {
                old.targetCount = max(0, old.targetCount - 1)
            }
            if let new = currentFoodTarget, new !== oldValue {
                new.targetCount += 1
            }
        }
    }
    
    // Predator hunting state
    var huntingCooldown: CGFloat = 0  // Time until predator can hunt again (seconds)
    var lastAteTime: TimeInterval = 0  // When fish last ate (for hunger calculation)
    private var wasHuntDarting: Bool = false  // Track previous hunt dart state for sound trigger
    
    // Callbacks - includes parent names for birth event logging
    var onReproduction: ((Species, CGPoint, String, String) -> Void)?  // (species, position, parent1Name, parent2Name)
    
    // Animation
    var tailAngle: CGFloat = 0
    var tailSpeed: CGFloat = 0.2
    var visualAngle: CGFloat = 0
    var facingLeft: Bool = false
    
    // Growth
    var scaleFactor: CGFloat = 1.0
    var isAdult: Bool { scaleFactor >= 0.95 }
    private var hasLoggedAdulthood: Bool = false  // Track if we've logged the grown-up event
    
    // Smooth Movement State
    private var targetHeading: CGFloat = 0          // Where we WANT to face (radians)
    private var currentHeading: CGFloat = 0         // Where we ARE facing (radians)
    private var swimPhase: CGFloat = 0              // Oscillation phase for natural rhythm
    private var glideTimer: CGFloat = 0             // Time until next thrust
    private var thrustStrength: CGFloat = 0         // Current thrust power (decays)
    
    // Anti-pattern behavior
    private var commitedHeading: CGFloat = 0        // Direction we're committed to
    private var commitmentTimer: CGFloat = 0        // How long to maintain commitment
    private var recentTurnDirection: CGFloat = 0    // Accumulated turn direction (for anti-orbit)
    private var lastWallEscapeTime: CGFloat = 0     // Cooldown for wall escape maneuvers
    private var personalityBias: CGFloat = 0        // Slight directional preference (-1 to 1)
    private var leaderDirectionChangeTimer: CGFloat = 0  // Timer for leader direction changes
    
    // Food circling detection
    private var foodChaseTimer: CGFloat = 0         // How long we've been chasing current food
    private var foodCirclingTimer: CGFloat = 0      // How long we've been circling (turning a lot near food)
    private var foodGiveUpCooldown: CGFloat = 0     // Cooldown before retargeting after giving up
    
    // Parts - Direct sprite references (no intermediate bone nodes)
    private var sprites: [String: SKSpriteNode] = [:]
    private var configs: [String: FishPartConfig] = [:]
    private let partKeys = ["pelvicFin1", "pelvicFin2", "body", "pectoralFin1", "pectoralFin2", "tail", "dorsalFin"]
    
    // Cached sprite references for faster animation (avoid dictionary lookups every frame)
    private var tailSprite: SKSpriteNode?
    private var pectoral1Sprite: SKSpriteNode?
    private var pectoral2Sprite: SKSpriteNode?
    private var pelvic1Sprite: SKSpriteNode?
    private var pelvic2Sprite: SKSpriteNode?
    private var dorsalSprite: SKSpriteNode?
    private var bodySprite: SKSpriteNode?
    
    // Cached base positions and scales for animation (computed once at setup)
    private var partBasePositions: [String: CGPoint] = [:]
    private var partPivots: [String: CGPoint] = [:]
    private var partScales: [String: CGFloat] = [:]
    private var baseScale: CGFloat = 1.0
    
    // Static counter for unique fish depth assignment
    // With 0.01 separation and range 15-45, supports 3000 unique depths before wrap
    private static var nextFishDepth: CGFloat = 0
    
    // Each fish gets a unique fixed depth to prevent part interleaving
    private var fishDepth: CGFloat = 0
    
    // MARK: - Initialization
    init(species: Species, position: CGPoint) {
        self.species = species
        self.fishName = FishNames.randomName()
        self.birthTime = Date().timeIntervalSince1970
        
        // Lifespan: Predators live 10-30 minutes, regular fish live 1-24 hours
        // (Converted from JS milliseconds to Swift seconds)
        if species.isPredator {
            self.lifespan = Double.random(in: (10 * 60)...(30 * 60))  // 10-30 minutes
        } else {
            self.lifespan = Double.random(in: (60 * 60)...(24 * 60 * 60))  // 1-24 hours
        }
        
        // Start with a random heading and gentle initial velocity
        let initialHeading = CGFloat.random(in: -.pi ... .pi)
        let initialSpeed = species.speed * 0.8
        self.velocity = Vector(x: cos(initialHeading) * initialSpeed, y: sin(initialHeading) * initialSpeed)
        self.acceleration = Vector(x: 0, y: 0)
        
        super.init()
        
        // Initialize smooth movement state
        self.currentHeading = initialHeading
        self.targetHeading = initialHeading
        self.commitedHeading = initialHeading
        self.wanderAngle = initialHeading
        self.nextWanderTarget = initialHeading
        
        // Give each fish a slight personality bias for variety
        self.personalityBias = CGFloat.random(in: -0.3...0.3)
        
        self.position = position
        
        // Assign unique fixed depth for this fish (range 15-45, between caustics at 5 and front overlay at 50)
        // Each fish gets a unique depth so their parts never interleave with other fish
        // With 0.01 separation, supports 3000 fish before wrap (15 + 2999*0.01 = 44.99)
        self.fishDepth = 15 + (FishNode.nextFishDepth.truncatingRemainder(dividingBy: 3000)) * 0.01
        FishNode.nextFishDepth += 1
        self.zPosition = fishDepth
        
        setupParts()
        setupLabels()
    }
    
    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    /// Initialize from saved state (for persistence)
    convenience init?(savedState: SavedFishState) {
        guard let species = SpeciesCatalog.shared.species(for: savedState.speciesId) else {
            return nil
        }
        self.init(species: species, position: CGPoint(x: savedState.positionX, y: savedState.positionY))
        
        // Restore saved properties
        self.fishName = savedState.name
        self.lifespan = savedState.lifespan
        self.energy = savedState.energy
        self.scaleFactor = savedState.scaleFactor
        
        // Adjust birthTime forward by the time the app was closed
        // This prevents fish from aging while the app is not running
        let elapsedWhileClosed = GameData.shared.elapsedTimeSinceLastSave
        self.birthTime = savedState.birthTime + elapsedWhileClosed
        
        // Also extend lifespan by the same amount so fish don't die prematurely
        self.lifespan = savedState.lifespan + elapsedWhileClosed
        
        // Update the label text to show restored name
        infoLabel?.text = "\(savedState.name)\nFull"
    }
    
    /// Create a saved state from this fish
    func toSavedState() -> SavedFishState {
        return SavedFishState(
            speciesId: species.id,
            name: fishName,
            positionX: position.x,
            positionY: position.y,
            energy: energy,
            scaleFactor: scaleFactor,
            birthTime: birthTime,
            lifespan: lifespan
        )
    }
    
    // MARK: - Label Setup (for Talk Mode)
    // Single combined label for name + hunger (reduces node count)
    // Speech UI is lazy-created only when fish speaks
    private func setupLabels() {
        // Info label (combined name + hunger with color)
        let info = SKLabelNode()
        info.fontName = "AvenirNext-Bold"
        info.fontSize = 13
        info.verticalAlignmentMode = .center
        info.horizontalAlignmentMode = .center
        info.zPosition = 200
        info.alpha = 0
        info.numberOfLines = 2
        info.text = "\(fishName)\nFull"
        self.infoLabel = info
        
        // No shadow - reduces node count
        // Speech UI is NOT created here - lazy-created in speak() when needed
    }
    
    /// Call this after adding fish to scene to add labels to scene as well
    func addLabelsToScene() {
        guard let scene = scene else { return }
        
        if let info = infoLabel, info.parent == nil {
            scene.addChild(info)
            // No constraints - we'll manually position in updateLabelPosition()
            // This avoids issues with fish rotation affecting label position
        }
        // Speech UI is lazy-added when speak() is called
    }
    
    /// Calculate the Y offset for labels based on fish size
    private func calculateLabelOffset() -> CGFloat {
        // Fish visual height is approximately species.size * scaleFactor
        // Add padding to ensure label is comfortably above the fish
        let fishHeight = species.size * scaleFactor
        return fishHeight * 0.6 + 20  // Half height + padding
    }
    
    /// Update label position to stay above fish (call every frame when labels visible)
    /// This positions the label in world space, ignoring fish rotation
    func updateLabelPosition() {
        guard let info = infoLabel else { return }
        // Position label directly above the fish's center point in world coordinates
        // This ignores the fish's rotation/flip - label always stays above
        let labelOffset = calculateLabelOffset()
        info.position = CGPoint(x: position.x, y: position.y + labelOffset)
    }
    
    /// Call this when removing fish to clean up labels
    func removeLabels() {
        infoLabel?.removeFromParent()
        speechBubble?.removeFromParent()
        speechLabel?.removeFromParent()
    }
    
    // Track if labels are currently hidden to avoid redundant alpha sets
    private var labelsHidden = false
    
    /// Quickly hide all labels (called when talk mode is off to save performance)
    func hideLabels() {
        // Skip if already hidden (avoids property sets per fish per frame)
        guard !labelsHidden else { return }
        labelsHidden = true
        infoLabel?.alpha = 0
        speechBubble?.alpha = 0
        speechLabel?.alpha = 0
    }
    
    /// Make the fish speak a phrase based on their personality (called when tapped in talk mode)
    func speak() {
        guard !isDead else { return }
        
        // Lazy-create speech UI on first speak
        if speechLabel == nil {
            createSpeechUI()
        }
        
        // Get a random phrase for this fish's personality
        let phrase = FishPhrases.randomPhrase(for: species.personality)
        
        // Update speech label
        speechLabel?.text = phrase
        
        // Show speech bubble with animation
        speechTimer = 3.0  // Show for 3 seconds
        
        speechBubble?.alpha = 1.0
        speechLabel?.alpha = 1.0
        
        // Pop-in animation
        speechBubble?.setScale(0.5)
        speechLabel?.setScale(0.5)
        speechBubble?.run(SKAction.scale(to: 1.0, duration: 0.2))
        speechLabel?.run(SKAction.scale(to: 1.0, duration: 0.2))
    }
    
    /// Lazy-create speech UI (only when fish first speaks)
    private func createSpeechUI() {
        guard let scene = scene else { return }
        
        // Speech bubble container
        let bubble = SKNode()
        bubble.zPosition = 250
        bubble.alpha = 0
        scene.addChild(bubble)
        self.speechBubble = bubble
        
        // Speech text
        let speech = SKLabelNode(text: "")
        speech.fontName = "AvenirNext-DemiBold"
        speech.fontSize = 13
        speech.fontColor = .white
        speech.verticalAlignmentMode = .center
        speech.horizontalAlignmentMode = .center
        speech.zPosition = 251
        speech.preferredMaxLayoutWidth = 150
        speech.numberOfLines = 0
        scene.addChild(speech)
        self.speechLabel = speech
        
        // Position will be updated manually in updateLabelPosition()
    }
    
    /// Calculate the Y offset for speech bubble (above the info label)
    private func calculateSpeechOffset() -> CGFloat {
        // Speech bubble goes above the info label
        return calculateLabelOffset() + 30
    }
    
    /// Update speech bubble position (call when speech is visible)
    private func updateSpeechPosition() {
        let speechOffset = calculateSpeechOffset()
        speechBubble?.position = CGPoint(x: position.x, y: position.y + speechOffset)
        speechLabel?.position = CGPoint(x: position.x, y: position.y + speechOffset)
    }
    
    
    // MARK: - Public Methods
    
    // Cached colors to avoid repeated allocations
    private static let starvingColor = SKColor(red: 0.94, green: 0.27, blue: 0.27, alpha: 1.0)
    private static let hungryColor = SKColor(red: 0.99, green: 0.83, blue: 0.30, alpha: 1.0)
    private static let fullColor = SKColor(red: 0.29, green: 0.87, blue: 0.5, alpha: 1.0)
    
    /// Update the visibility and content of labels based on talk mode
    /// Pass currentTime to avoid multiple Date() calls per frame
    func updateLabels(isTalkMode: Bool, currentTime: TimeInterval = 0) {
        // Mark labels as visible (reset hidden flag)
        labelsHidden = false
        
        let targetAlpha: CGFloat = isTalkMode && !isDead ? 1.0 : 0.0
        
        // Update label position (in world space, ignoring fish rotation)
        updateLabelPosition()
        
        // Update alpha
        infoLabel?.alpha = targetAlpha
        
        // Update combined text with name + hunger status (only when visible)
        if isTalkMode, let infoLabel = infoLabel {
            // Hunger status
            let hungerStatus: String
            let hungerColor: UIColor
            if energy < 30 {
                hungerStatus = "Starving"
                hungerColor = FishNode.starvingColor
            } else if energy < 60 {
                hungerStatus = "Hungry"
                hungerColor = FishNode.hungryColor
            } else {
                hungerStatus = "Full"
                hungerColor = FishNode.fullColor
            }
            
            // Age in human-readable format (use passed time or fallback to Date())
            let timestamp = currentTime > 0 ? currentTime : Date().timeIntervalSince1970
            let ageSeconds = timestamp - birthTime
            let ageText: String
            if ageSeconds < 60 {
                ageText = "\(Int(ageSeconds))s"
            } else if ageSeconds < 3600 {
                let minutes = Int(ageSeconds / 60)
                ageText = "\(minutes)m"
            } else {
                let hours = Int(ageSeconds / 3600)
                let minutes = Int((ageSeconds.truncatingRemainder(dividingBy: 3600)) / 60)
                ageText = minutes > 0 ? "\(hours)h \(minutes)m" : "\(hours)h"
            }
            
            // Build attributed string with different colors
            // Line 1: Name + Age (white)
            // Line 2: Hunger status (colored by hunger level)
            let nameAndAge = "\(fishName) • \(ageText)"
            let fullText = "\(nameAndAge)\n\(hungerStatus)"
            
            let attributed = NSMutableAttributedString(string: fullText)
            let paragraphStyle = NSMutableParagraphStyle()
            paragraphStyle.alignment = .center
            paragraphStyle.lineSpacing = 2
            
            // Apply base attributes to entire string
            attributed.addAttributes([
                .font: UIFont(name: "AvenirNext-Bold", size: 13) ?? UIFont.boldSystemFont(ofSize: 13),
                .paragraphStyle: paragraphStyle
            ], range: NSRange(location: 0, length: fullText.count))
            
            // Name + Age line: white
            attributed.addAttribute(.foregroundColor, value: UIColor.white, range: NSRange(location: 0, length: nameAndAge.count))
            
            // Hunger status: colored
            let hungerRange = NSRange(location: nameAndAge.count + 1, length: hungerStatus.count)
            attributed.addAttribute(.foregroundColor, value: hungerColor, range: hungerRange)
            
            infoLabel.attributedText = attributed
        }
        
        // Update speech bubble position if visible
        if speechTimer > 0 && speechBubble != nil {
            updateSpeechPosition()
        }
        
        // Hide speech bubble if not in talk mode or timer expired
        if !isTalkMode || isDead {
            speechBubble?.alpha = 0
            speechLabel?.alpha = 0
            speechTimer = 0
        }
    }
    
    /// Update speech timer (call from main update loop)
    func updateSpeechTimer(deltaTime: TimeInterval) {
        if speechTimer > 0 {
            speechTimer -= deltaTime
            if speechTimer <= 0 {
                // Fade out speech
                speechBubble?.run(SKAction.fadeOut(withDuration: 0.3))
                speechLabel?.run(SKAction.fadeOut(withDuration: 0.3))
            }
        }
    }
    
    func eat(at foodPosition: CGPoint? = nil, atePrey: Bool = false) {
        // Flash the body sprite white when eating
        if let bodySprite = bodySprite {
            let sequence = SKAction.sequence([
                SKAction.colorize(with: .white, colorBlendFactor: 1.0, duration: 0.1),
                SKAction.colorize(withColorBlendFactor: 0.0, duration: 0.1)
            ])
            bodySprite.run(sequence)
        }
        energy = min(maxEnergy, energy + 20)
        GameData.shared.addScore(15)
        lastAteTime = Date().timeIntervalSince1970
        velocity = velocity * 0.5
        
        // Haptic feedback
        if atePrey {
            HapticManager.shared.predatorCaughtPrey()
        } else {
            HapticManager.shared.fishAte()
        }
        
        // Spawn food crumb particles at the eating location
        if let scene = scene, let pos = foodPosition {
            spawnFoodCrumbs(at: pos, in: scene)
        }
        
        // Growth by Feeding - slow growth (10x slower than before)
        // At 0.5% per meal, fish need ~140 meals to grow from 30% to 100%
        if scaleFactor < 1.0 {
            let wasNotAdult = !isAdult
            scaleFactor += 0.005 // Grow 0.5% per meal
            if scaleFactor > 1.0 { scaleFactor = 1.0 }
            // Label position will auto-update in updateLabelPosition() based on new scaleFactor
            
            // Log grown-up event when fish becomes an adult
            if wasNotAdult && isAdult && !hasLoggedAdulthood {
                hasLoggedAdulthood = true
                GameData.shared.addGrownUpEvent(name: fishName, speciesName: species.name)
            }
        }
        
        // Predators have a longer cooldown after eating (set in hunting logic when catching prey)
        // Regular fish don't need hunting cooldown
    }
    
    /// Called when fish dies - records to Spirit Memories
    func die(reason: String, age: TimeInterval? = nil) {
        guard !isDead else { return }  // Prevent double-death
        isDead = true
        removeLabels()
        
        // Haptic feedback for death
        HapticManager.shared.fishDied()
        
        let fishAge = age ?? (Date().timeIntervalSince1970 - birthTime)
        GameData.shared.addSpiritMemory(
            name: fishName,
            speciesName: species.name,
            deathReason: reason,
            ageAtDeath: fishAge
        )
    }
    
    private func spawnFoodCrumbs(at position: CGPoint, in scene: SKScene) {
        // Spawn 3-5 small crumb particles
        let crumbCount = Int.random(in: 3...5)
        
        for _ in 0..<crumbCount {
            let crumb = SKShapeNode(circleOfRadius: CGFloat.random(in: 0.8...1.5))  // Smaller particles
            crumb.fillColor = SKColor(red: 0.75, green: 0.55, blue: 0.35, alpha: 0.9)  // Match darker food color
            crumb.strokeColor = .clear
            crumb.position = position
            crumb.zPosition = 5
            
            // Random velocity - smaller burst outward
            let angle = CGFloat.random(in: 0...(2 * .pi))
            let speed = CGFloat.random(in: 8...20)  // Slower burst
            let vx = cos(angle) * speed
            let vy = sin(angle) * speed - 5 // Slight downward bias
            
            scene.addChild(crumb)
            
            // Animate: drift outward, sink slightly, fade out
            let drift = SKAction.moveBy(x: vx, y: vy, duration: 0.3)
            drift.timingMode = .easeOut
            
            let sink = SKAction.moveBy(x: 0, y: -10, duration: 0.4)
            sink.timingMode = .easeIn
            
            let fade = SKAction.fadeOut(withDuration: 0.4)
            let shrink = SKAction.scale(to: 0.2, duration: 0.4)
            
            let movement = SKAction.sequence([drift, SKAction.group([sink, fade, shrink])])
            let cleanup = SKAction.removeFromParent()
            
            crumb.run(SKAction.sequence([movement, cleanup]))
        }
    }
    
    // MARK: - Update Loop (Graceful Gliding Movement)
    func update(deltaTime: TimeInterval, bounds: CGRect, otherFish: [FishNode], food: [SKNode], isNight: Bool) {
        let dt = CGFloat(deltaTime)
        
        if isDead {
            velocity.x *= 0.95
            velocity.y = 0.5 // Float up gently
            zRotation = .pi
            position.x += velocity.x * dt * 60
            position.y += velocity.y * dt * 60
            alpha -= 0.003
            if alpha <= 0 { removeFromParent() }
            return
        }
        
        // Energy drain: varies by type and age
        // Prey fish: 0.4 per second = 250 seconds (4+ minutes) to starve from full
        // Predators: 0.15 per second = 666 seconds (11+ minutes) to starve from full
        // This allows predators to survive their longer hunting cooldowns (2-5 minutes)
        // Baby fish (not yet adult) drain energy 4x faster so they eat more and grow faster
        let baseEnergyDrainRate: CGFloat = species.isPredator ? 0.15 : 0.4
        let babyMultiplier: CGFloat = isAdult ? 1.0 : 4.0
        let energyDrainRate = baseEnergyDrainRate * babyMultiplier
        energy -= dt * energyDrainRate
        
        // Decrement hunting cooldown for predators
        if huntingCooldown > 0 {
            huntingCooldown -= dt
        }
        
        // Growth only happens when eating (see eat() method)
        
        // Death checks: starvation or old age
        // Cache current time to avoid multiple Date() calls
        let currentTimestamp = Date().timeIntervalSince1970
        let age = currentTimestamp - birthTime
        if energy <= 0 {
            die(reason: "Starved", age: age)
            return
        }
        if age > lifespan {
            die(reason: "Old Age", age: age)
            return
        }
        
        // --- Graceful Gliding Movement with Anti-Pattern Behaviors ---
        // Philosophy: Fish commit to directions, avoiding constant micro-adjustments
        // that lead to circling. They anticipate walls and escape parallel movement.
        
        // Decrement food give-up cooldown (must be done here where dt is available)
        if foodGiveUpCooldown > 0 {
            foodGiveUpCooldown -= dt
        }
        
        // Check if we're in a flock (has nearby same-species fish) - used for commitment and turn rate
        // Optimization: Use squared distance to avoid sqrt, and early exit
        let flockDistSq: CGFloat = 250 * 250  // 62500
        var hasFlockmates = false
        for other in otherFish {
            if other !== self && !other.isDead && other.species.id == species.id {
                let dx = other.position.x - position.x
                let dy = other.position.y - position.y
                if dx * dx + dy * dy < flockDistSq {
                    hasFlockmates = true
                    break  // Early exit - we only need to know if there's at least one
                }
            }
        }
        
        // 1. Determine what we're trying to do (get target heading)
        let (desiredDir, darting, _) = calculateTargetVelocity(otherFish: otherFish, food: food, bounds: bounds, isNight: isNight, dt: dt)
        isDarting = darting
        let rawTargetHeading = atan2(desiredDir.y, desiredDir.x)
        
        // 2. Commitment System - Balance between smooth movement and responsive flocking
        commitmentTimer -= dt
        
        if isDarting && currentFoodTarget != nil {
            // When chasing food: SNAP heading directly to food direction
            // No gradual turning - just go straight at it
            currentHeading = rawTargetHeading
            targetHeading = rawTargetHeading
            commitmentTimer = 0
        } else if isDarting {
            // Darting for other reasons (fleeing, hunting) - track target directly
            targetHeading = rawTargetHeading
            commitmentTimer = 0
        } else if hasFlockmates {
            // When in a flock, be more responsive to formation changes
            // Blend current heading with target more aggressively
            var flockDiff = rawTargetHeading - currentHeading
            while flockDiff < -.pi { flockDiff += 2 * .pi }
            while flockDiff > .pi { flockDiff -= 2 * .pi }
            
            // Smoothly track the flock direction
            targetHeading = currentHeading + flockDiff * 0.3
            commitmentTimer = 0.2  // Very short commitment when flocking
        } else if commitmentTimer <= 0 {
            // Time to pick a new committed direction (solo wandering)
            // Blend the raw target with some randomness and personality
            let randomOffset = CGFloat.random(in: -0.4...0.4) + personalityBias * 0.2
            targetHeading = rawTargetHeading + randomOffset
            commitedHeading = targetHeading
            commitmentTimer = CGFloat.random(in: 1.5...4.0)  // Commit for 1.5-4 seconds
        } else {
            // Maintain commitment, but allow gradual drift toward new target
            var commitDiff = rawTargetHeading - commitedHeading
            while commitDiff < -.pi { commitDiff += 2 * .pi }
            while commitDiff > .pi { commitDiff -= 2 * .pi }
            
            // Only update commitment if target has changed significantly (> 60 degrees)
            if abs(commitDiff) > 1.0 {
                commitedHeading = commitedHeading + commitDiff * 0.1
            }
            targetHeading = commitedHeading
        }
        
        // 3. Calculate heading difference and track turn direction for anti-orbit
        var headingDiff = targetHeading - currentHeading
        while headingDiff < -.pi { headingDiff += 2 * .pi }
        while headingDiff > .pi { headingDiff -= 2 * .pi }
        
        // Track accumulated turn direction (positive = turning right, negative = left)
        recentTurnDirection += headingDiff * dt
        recentTurnDirection *= 0.95  // Decay over time
        
        // Anti-orbit: If we've been turning the same direction too long, force a change
        // Apply to ALL fish including when darting - prevents spinning after missing food
        if abs(recentTurnDirection) > 3.0 {
            // We've turned more than ~170 degrees in one direction recently
            // Force a reversal by flipping the target
            targetHeading = currentHeading - recentTurnDirection * 0.5
            recentTurnDirection = 0
            commitmentTimer = CGFloat.random(in: 2.0...3.0)
            commitedHeading = targetHeading
            
            // If we were darting, clear the food target to prevent re-spinning
            if isDarting {
                currentFoodTarget = nil
                foodChaseTimer = 0
                foodCirclingTimer = 0
                foodGiveUpCooldown = 1.5  // Brief cooldown before retargeting
            }
        }
        
        // 4. Calculate turn rate
        // Larger fish turn more slowly (size affects maneuverability)
        // species.size ranges from ~10 (small) to ~60 (large)
        // Scale factor: small fish (size 10) = 1.0, large fish (size 60) = 0.3
        let sizeTurnMultiplier = max(0.3, 1.0 - (species.size - 10) / 80.0)
        
        var baseTurnRate: CGFloat
        if isDarting && currentFoodTarget != nil {
            // When chasing food: heading is already snapped, but use high turn rate
            // for any minor corrections needed
            baseTurnRate = 20.0
        } else if isDarting {
            // Darting for other reasons (fleeing, hunting)
            baseTurnRate = 8.0
        } else if hasFlockmates {
            baseTurnRate = 2.0 * sizeTurnMultiplier  // Responsive turns when in a flock
        } else {
            baseTurnRate = 0.5 * sizeTurnMultiplier  // Slow, graceful turns when solo
        }
        
        // Recalculate heading diff after potential anti-orbit adjustment
        headingDiff = targetHeading - currentHeading
        while headingDiff < -.pi { headingDiff += 2 * .pi }
        while headingDiff > .pi { headingDiff -= 2 * .pi }
        
        let turnAmount = headingDiff * baseTurnRate * dt
        currentHeading += turnAmount
        
        // Normalize heading
        while currentHeading < -.pi { currentHeading += 2 * .pi }
        while currentHeading > .pi { currentHeading -= 2 * .pi }
        
        // 5. Calculate target speed
        // Slower cruising for more relaxed movement, but still responsive when darting
        let baseSpeed = species.speed
        let sizeSpeedMult = 1.0 + ((1.0 - scaleFactor) * 1.25)
        
        // Predators are slower when not hungry/hunting, but can burst when chasing prey
        let predatorSlowdown: CGFloat = species.isPredator && energy >= 70 ? 0.5 : 1.0
        
        let cruiseSpeed = baseSpeed * 0.5 * sizeSpeedMult * predatorSlowdown
        let dartSpeed = baseSpeed * 2.5 * sizeSpeedMult    // Predators dart at full speed when hunting
        var targetSpeed = isDarting ? dartSpeed : cruiseSpeed
        
        // 6. Wall proximity handling
        let slowdownMargin: CGFloat = 180
        let wallProximity = calculateWallProximity(bounds: bounds, margin: slowdownMargin)
        
        // Check if we're moving parallel to a wall (the scraping problem)
        let isScrapingWall = wallProximity > 0.3 && isMovingParallelToWall(bounds: bounds)
        
        if isScrapingWall && (lastWallEscapeTime <= 0 || CGFloat(CACurrentMediaTime()) - lastWallEscapeTime > 2.0) {
            // Execute wall escape maneuver: turn sharply toward center
            let centerX = (bounds.minX + bounds.maxX) / 2
            let centerY = (bounds.minY + bounds.maxY) / 2
            let escapeHeading = atan2(centerY - position.y, centerX - position.x)
            
            // Add some randomness to escape direction
            targetHeading = escapeHeading + CGFloat.random(in: -0.5...0.5)
            commitedHeading = targetHeading
            commitmentTimer = CGFloat.random(in: 1.0...2.0)
            lastWallEscapeTime = CGFloat(CACurrentMediaTime())
            recentTurnDirection = 0  // Reset turn tracking
        }
        
        if wallProximity > 0 {
            let slowdownFactor = 1.0 - (wallProximity * 0.6)
            targetSpeed *= slowdownFactor
        }
        
        // 7. Smooth speed changes
        let currentSpeed = velocity.magnitude()
        var newSpeed: CGFloat
        
        if currentSpeed < targetSpeed {
            let accelRate: CGFloat = isDarting ? 2.0 : 0.8
            newSpeed = currentSpeed + (targetSpeed - currentSpeed) * accelRate * dt
        } else {
            let decelRate: CGFloat = wallProximity > 0.3 ? 1.5 : 0.3
            newSpeed = currentSpeed + (targetSpeed - currentSpeed) * decelRate * dt
        }
        
        newSpeed = max(newSpeed, baseSpeed * 0.15 * sizeSpeedMult)  // Lower minimum speed for gentler movement
        
        // 8. Update velocity from heading and speed
        // Cache sin/cos of heading (used multiple times)
        let cosHeading = cos(currentHeading)
        let sinHeading = sin(currentHeading)
        
        velocity = Vector(
            x: cosHeading * newSpeed,
            y: sinHeading * newSpeed
        )
        
        // 9. Add subtle swimming oscillation
        swimPhase += dt * (3.0 + newSpeed * 0.5)
        let wiggleAmount = sin(swimPhase) * 0.015 * newSpeed  // Reduced wiggle
        let perpendicular = Vector(x: -sinHeading, y: cosHeading)  // Reuse cached values
        velocity = velocity + (perpendicular * wiggleAmount)
        
        // 7. Move
        position.x += velocity.x * dt * 60
        position.y += velocity.y * dt * 60
        
        // zPosition is fixed at fish creation to prevent parts from interleaving with other fish
        
        // 8. Soft boundary handling (gradual push, not bounce)
        let margin: CGFloat = species.size * 0.5
        let pushStrength: CGFloat = 0.5
        
        if position.x < bounds.minX + margin {
            position.x = bounds.minX + margin
            velocity.x = abs(velocity.x) * pushStrength
            currentHeading = atan2(velocity.y, velocity.x)
        }
        if position.x > bounds.maxX - margin {
            position.x = bounds.maxX - margin
            velocity.x = -abs(velocity.x) * pushStrength
            currentHeading = atan2(velocity.y, velocity.x)
        }
        if position.y < bounds.minY + margin {
            position.y = bounds.minY + margin
            velocity.y = abs(velocity.y) * pushStrength
            currentHeading = atan2(velocity.y, velocity.x)
        }
        if position.y > bounds.maxY - margin {
            position.y = bounds.maxY - margin
            velocity.y = -abs(velocity.y) * pushStrength
            currentHeading = atan2(velocity.y, velocity.x)
        }
        
        updateRotation()
        animateParts()
        
        // Tail speed linked to swimming effort (slowed down to match leisurely movement)
        tailSpeed = 0.08 + (newSpeed / targetSpeed) * 0.12  // Reduced from 0.15 + 0.25x
        
        if !isNight && Double.random(in: 0...1) < 0.005 {
            checkMating(otherFish: otherFish)
        }
    }
    
    private func checkMating(otherFish: [FishNode]) {
        if !isAdult || energy < 90 { return } // Only adults breed
        
        // Population-based birth rate reduction
        // At 0 fish: 100% chance, at 100 fish: 50% chance, at 200 fish: ~0% chance
        let population = otherFish.count + 1  // +1 for self
        let maxPopulation: CGFloat = 200
        let birthChance = max(0, 1.0 - (CGFloat(population) / maxPopulation))
        
        // Random check against birth chance
        guard Double.random(in: 0...1) < Double(birthChance) else { return }
        
        if let partner = otherFish.first(where: { 
            $0 !== self && 
            $0.species.id == species.id && 
            !$0.isDead && 
            $0.isAdult && 
            $0.energy > 90 && 
            distance(to: $0) < 50 
        }) {
            energy -= 30
            partner.energy -= 30
            // Pass both parent names for birth event logging
            onReproduction?(species, position, fishName, partner.fishName)
        }
    }
    
    private func distance(toPoint point: CGPoint) -> CGFloat {
        return hypot(self.position.x - point.x, self.position.y - point.y)
    }
    
    private func distance(to other: FishNode) -> CGFloat {
        return hypot(self.position.x - other.position.x, self.position.y - other.position.y)
    }
    
    /// Hit test with expanded tap target for smaller fish
    /// Minimum tap target of 44pt (Apple HIG recommendation) ensures small fish are tappable
    func hitTest(point: CGPoint) -> Bool {
        let dist = distance(toPoint: point)
        // Fish visual size is approximately species.size * scaleFactor
        let fishRadius = species.size * scaleFactor * 0.5
        // Minimum tap target of 44pt radius (88pt diameter) for accessibility
        // Larger fish use their actual size
        let tapRadius = max(fishRadius, 44.0)
        return dist < tapRadius
    }
    
    // Squared distance - faster when only comparing distances (avoids sqrt)
    @inline(__always)
    private func distanceSquared(to other: FishNode) -> CGFloat {
        let dx = self.position.x - other.position.x
        let dy = self.position.y - other.position.y
        return dx * dx + dy * dy
    }

    // --- New Helper Methods ---
    
    // Wander state - changes very slowly for graceful meandering
    private var wanderAngle: CGFloat = CGFloat.random(in: -.pi ... .pi)
    private var wanderChangeTimer: CGFloat = 0
    private var nextWanderTarget: CGFloat = 0
    
    /// Returns (targetDirection, isDarting, distanceToTarget)
    /// distanceToTarget is the distance to food/prey if chasing, otherwise -1
    private func calculateTargetVelocity(otherFish: [FishNode], food: [SKNode], bounds: CGRect, isNight: Bool, dt: CGFloat) -> (Vector, Bool, CGFloat) {
        
        // Start with current heading as default (maintain course)
        var targetDir = Vector(x: cos(currentHeading), y: sin(currentHeading))
        var shouldDart = false
        var targetDistance: CGFloat = -1  // -1 means no specific target
        
        // --- Layer 1: Wall Avoidance (Gradual Steering) ---
        // Instead of hard override, blend wall avoidance into the target
        let wallInfluence = calculateWallAvoidance(bounds: bounds)
        if wallInfluence.magnitude() > 0.01 {
            // Blend wall avoidance with current direction
            // Stronger influence as we get closer to walls
            let blendFactor = min(wallInfluence.magnitude(), 1.0)
            var normalized = wallInfluence
            normalized.normalize()
            targetDir = targetDir * (1.0 - blendFactor) + normalized * blendFactor
        }
        
        // --- Layer 2: Predator Avoidance ---
        // Optimization: Use squared distance for initial check, only compute sqrt when needed
        if !species.isPredator {
            let predatorRangeSq: CGFloat = 250 * 250
            let dartRangeSq: CGFloat = 150 * 150
            for other in otherFish {
                if other.species.isPredator && !other.isDead {
                    let dx = position.x - other.position.x
                    let dy = position.y - other.position.y
                    let distSq = dx * dx + dy * dy
                    if distSq < predatorRangeSq {
                        let d = sqrt(distSq)  // Only compute sqrt when in range
                        let fleeDir = Vector(x: dx, y: dy)
                        var normalized = fleeDir
                        normalized.normalize()
                        // Stronger influence when closer
                        let urgency = 1.0 - (d / 250)
                        targetDir = targetDir * (1.0 - urgency) + normalized * urgency
                        if distSq < dartRangeSq { shouldDart = true }
                    }
                }
            }
        }
        
        // --- Layer 3: Food Seeking ---
        // All fish can eat food when hungry
        // Predators only eat food when very hungry (< 50) or on hunting cooldown
        // This ensures they still prefer hunting but won't starve
        // Note: foodGiveUpCooldown is decremented in the main update() function
        
        let shouldSeekFood: Bool
        if species.isPredator {
            // Predators eat food only when desperate (< 50 energy) or can't hunt (on cooldown)
            shouldSeekFood = energy < 50 || (energy < 85 && huntingCooldown > 0)
        } else {
            shouldSeekFood = energy < 85
        }
        
        if shouldSeekFood && foodGiveUpCooldown <= 0 {
            var bestFood: FoodNode? = nil
            var bestDist: CGFloat = 500  // Detection range
            
            // Prefer current target for consistency (sticky targeting)
            let maxDistSq: CGFloat = 500 * 500
            var bestDistSq = maxDistSq
            
            if let current = currentFoodTarget, current.parent != nil, !current.eaten {
                let dx = current.position.x - position.x
                let dy = current.position.y - position.y
                let distSq = dx * dx + dy * dy
                let stickyBonus: CGFloat = 200 * 200 + 2 * 200 * sqrt(bestDistSq)
                if distSq < bestDistSq + stickyBonus { bestFood = current; bestDistSq = distSq }
                else { currentFoodTarget = nil }
            }
            
            // Find new target if needed
            if bestFood == nil {
                for node in food {
                    guard let f = node as? FoodNode, !f.eaten, f.targetCount < f.maxTargets else { continue }
                    let dx = f.position.x - position.x
                    let dy = f.position.y - position.y
                    let distSq = dx * dx + dy * dy
                    if distSq < bestDistSq { bestDistSq = distSq; bestFood = f }
                }
            }
            
            // Convert back to distance for later use
            bestDist = sqrt(bestDistSq)
            
            if bestFood !== currentFoodTarget {
                currentFoodTarget = bestFood
                foodChaseTimer = 0  // Reset chase timer for new target
            }
            
            if let f = currentFoodTarget {
                // Increment chase timer
                foodChaseTimer += dt
                
                // Simple eat check - like JS version: eatDist = this.size + 5
                let eatDist = species.size * scaleFactor + 5
                if bestDist < eatDist {
                    let foodPos = f.position
                    f.eaten = true
                    f.removeFromParent()
                    eat(at: foodPos)
                    currentFoodTarget = nil
                    foodChaseTimer = 0
                } else {
                    // Simple steering toward food - matches JS seek() behavior
                    // Just point directly at food, no complex mouth offset calculations
                    let toFood = Vector(x: f.position.x - position.x, y: f.position.y - position.y)
                    var normalized = toFood
                    normalized.normalize()
                    
                    // Strong food influence - fish go straight for food
                    // JS uses influence of 1.0 (full override) via seek()
                    targetDir = normalized
                    
                    // Always dart when chasing food (like JS speedMult = 2.5)
                    shouldDart = true 
                    targetDistance = bestDist
                }
            } else {
                foodChaseTimer = 0  // No target, reset timer
            }
        }
        
        // --- Layer 4: Predator Hunting ---
        // Predators only hunt when hungry (energy < 70) and not on cooldown
        // They are slower than prey normally, but can dart when actively hunting
        if species.isPredator {
            let isHungry = energy < 70
            let canHunt = huntingCooldown <= 0 && isHungry
            
            if canHunt {
                var bestPrey: FishNode? = nil
                var bestDistSq: CGFloat = 300 * 300  // Use squared distance
                let maxSizeForPrey = species.size * 0.8
                
                for other in otherFish {
                    // Only hunt non-predators that are smaller
                    if !other.species.isPredator && !other.isDead && other.species.size < maxSizeForPrey {
                        let dx = other.position.x - position.x
                        let dy = other.position.y - position.y
                        let distSq = dx * dx + dy * dy
                        if distSq < bestDistSq { bestDistSq = distSq; bestPrey = other }
                    }
                }
                
                if let prey = bestPrey {
                    let catchDistSq = maxSizeForPrey * maxSizeForPrey
                    if bestDistSq < catchDistSq {
                        // Catch the prey!
                        let preyAge = Date().timeIntervalSince1970 - prey.birthTime
                        prey.die(reason: "Eaten by \(fishName)", age: preyAge)
                        prey.removeFromParent()
                        if let gameScene = scene as? GameScene {
                            gameScene.spawnBloodMist(at: prey.position)
                        }
                        eat(atePrey: true)  // Big rumble haptic for predator kill
                        // Long cooldown after eating (2-5 minutes)
                        huntingCooldown = CGFloat.random(in: 120...300)
                    } else {
                        // Chase the prey
                        let bestDist = sqrt(bestDistSq)  // Only sqrt when needed for proximity calc
                        let huntDir = Vector(x: prey.position.x - position.x, y: prey.position.y - position.y)
                        var normalized = huntDir
                        normalized.normalize()
                        let proximity = 1.0 - min(bestDist / 300, 1.0)
                        targetDir = targetDir * (1.0 - proximity * 0.8) + normalized * (proximity * 0.8)
                        
                        // Predators dart when actively chasing prey
                        let dartDistSq: CGFloat = 200 * 200
                        if bestDistSq < dartDistSq { 
                            // Play sound when predator starts darting (not every frame)
                            if !wasHuntDarting {
                                SoundManager.shared.playPredatorDart()
                            }
                            shouldDart = true 
                            targetDistance = bestDist
                        }
                    }
                }
            }
        }
        
        // --- Layer 5: V-Formation Schooling ---
        // Fish form schools in a triangle/V pattern like birds and fish in nature.
        // OPTIMIZATION: Skip schooling entirely if actively chasing food/prey
        // This avoids expensive O(n) iteration when fish has a clear objective
        let isChasing = currentFoodTarget != nil || shouldDart
        
        var separationDir = Vector(x: 0, y: 0)
        var sepCount: CGFloat = 0
        var sameSpeciesNearby: [FishNode] = []
        
        // Only do schooling calculations if not actively chasing
        if !isChasing {
            let schoolDistSq: CGFloat = 300 * 300  // School detection range (wider for formation)
            let separationDistSq: CGFloat = pow(30 + species.size * 0.5, 2)  // Personal space
            let separationDist = sqrt(separationDistSq)  // Pre-compute once
            
            // First pass: collect same-species fish and calculate separation
            // OPTIMIZATION: Limit to first 20 fish to cap worst-case performance
            var checkedCount = 0
            let maxToCheck = min(otherFish.count, 40)  // Don't check more than 40 fish
            
            for other in otherFish {
                guard other !== self && !other.isDead else { continue }
                checkedCount += 1
                if checkedCount > maxToCheck { break }
                
                let dx = other.position.x - position.x
                let dy = other.position.y - position.y
                let dSq = dx * dx + dy * dy
                
                // Same species schooling - limit school size to 12 for performance
                if other.species.id == species.id && dSq < schoolDistSq && sameSpeciesNearby.count < 12 {
                    sameSpeciesNearby.append(other)
                }
                
                // Separation from all nearby fish (same or different species)
                if dSq < separationDistSq && dSq > 0.1 {
                    let d = sqrt(dSq)
                    var away = Vector(x: -dx, y: -dy)
                    away.normalize()
                    let strength = 1.0 - (d / separationDist)
                    separationDir = separationDir + (away * strength)
                    sepCount += 1
                }
            }
        }
        
        // Determine rank in school (0 = leader = oldest fish)
        // OPTIMIZATION: Instead of sorting, just count how many fish are older than me
        var myRank = 0
        var oldestFish: FishNode? = self
        var oldestBirthTime = birthTime
        
        for other in sameSpeciesNearby {
            if other.birthTime < birthTime {
                myRank += 1  // This fish is older than me
            }
            if other.birthTime < oldestBirthTime {
                oldestBirthTime = other.birthTime
                oldestFish = other
            }
        }
        
        // Calculate formation direction BEFORE blending
        var formationDir = Vector(x: 0, y: 0)
        var hasFormationTarget = false
        
        if myRank == 0 {
            // LEADER BEHAVIOR: I'm the oldest, wander freely but avoid circling
            let hasFollowers = sameSpeciesNearby.count > 0
            
            // Decrement leader direction change timer
            leaderDirectionChangeTimer -= 1.0 / 60.0
            
            // Anti-circling for leaders with followers
            if hasFollowers {
                // Method 1: If turning too much in one direction, break the pattern
                if abs(recentTurnDirection) > 2.0 {
                    let randomAngle = CGFloat.random(in: -.pi ... .pi)
                    let breakDir = Vector(x: cos(randomAngle), y: sin(randomAngle))
                    formationDir = breakDir
                    hasFormationTarget = true
                    recentTurnDirection *= 0.3
                    leaderDirectionChangeTimer = CGFloat.random(in: 4.0...8.0)
                }
                // Method 2: Periodic subtle direction changes to keep movement interesting
                else if leaderDirectionChangeTimer <= 0 {
                    // Nudge the wander direction slightly
                    let nudgeAmount = CGFloat.random(in: -0.8...0.8)
                    let newAngle = currentHeading + nudgeAmount
                    let nudgeDir = Vector(x: cos(newAngle), y: sin(newAngle))
                    formationDir = nudgeDir
                    hasFormationTarget = true
                    leaderDirectionChangeTimer = CGFloat.random(in: 3.0...6.0)
                }
            }
            
            // Light cohesion to keep school together - look back at followers
            if hasFollowers && !hasFormationTarget {
                var schoolCenter = Vector(x: 0, y: 0)
                for other in sameSpeciesNearby {
                    schoolCenter = schoolCenter + Vector(x: other.position.x, y: other.position.y)
                }
                schoolCenter = schoolCenter * (1.0 / CGFloat(sameSpeciesNearby.count))
                
                var toSchool = Vector(x: schoolCenter.x - position.x, y: schoolCenter.y - position.y)
                let schoolDist = toSchool.magnitude()
                
                // If followers are getting too far behind, turn back toward them
                if schoolDist > 100 && toSchool.magnitude() > 0.01 {
                    toSchool.normalize()
                    formationDir = toSchool
                    hasFormationTarget = true
                }
            }
        } else if let leader = oldestFish, leader !== self {
            // FOLLOWER BEHAVIOR: Position myself in V-formation behind leader
            
            // Calculate which row and position in that row I should be
            var row = 1
            var posInRow = myRank
            while posInRow >= row + 1 {
                posInRow -= (row + 1)
                row += 1
            }
            let fishInThisRow = row + 1
            
            // Get leader's heading direction
            var leaderHeading = atan2(leader.velocity.y, leader.velocity.x)
            if leader.velocity.magnitude() < 0.1 {
                leaderHeading = leader.currentHeading
            }
            
            // Calculate ideal position in V-formation
            let rowSpacing: CGFloat = 45 + species.size * 0.8  // Distance between rows
            let lateralSpacing: CGFloat = 40 + species.size * 0.6  // Distance between fish in a row
            
            let distBehind = CGFloat(row) * rowSpacing
            let lateralOffset = (CGFloat(posInRow) - CGFloat(fishInThisRow - 1) / 2.0) * lateralSpacing
            
            // Calculate target position relative to leader
            let behindX = -cos(leaderHeading) * distBehind
            let behindY = -sin(leaderHeading) * distBehind
            let lateralX = -sin(leaderHeading) * lateralOffset
            let lateralY = cos(leaderHeading) * lateralOffset
            
            let targetX = leader.position.x + behindX + lateralX
            let targetY = leader.position.y + behindY + lateralY
            
            // Direction to formation position
            let toTarget = Vector(x: targetX - position.x, y: targetY - position.y)
            let distToTarget = toTarget.magnitude()
            
            if distToTarget > 10 {
                var moveDir = toTarget
                moveDir.normalize()
                
                // Blend formation position with leader's heading
                // More weight on position when far, more on heading when close
                let positionWeight = min(distToTarget / 80, 1.0)
                var leaderDir = leader.velocity
                if leaderDir.magnitude() > 0.01 {
                    leaderDir.normalize()
                    formationDir = moveDir * positionWeight + leaderDir * (1.0 - positionWeight * 0.5)
                } else {
                    formationDir = moveDir
                }
                formationDir.normalize()
                hasFormationTarget = true
            } else {
                // In position - just match leader heading
                var leaderDir = leader.velocity
                if leaderDir.magnitude() > 0.01 {
                    leaderDir.normalize()
                    formationDir = leaderDir
                    hasFormationTarget = true
                }
            }
        }
        
        // Apply separation (always applies, but weaker)
        if sepCount > 0 {
            separationDir = separationDir * (1.0 / sepCount)
            if separationDir.magnitude() > 0.01 {
                separationDir.normalize()
                targetDir = targetDir + separationDir * 0.2
            }
        }
        
        // CRITICAL: Flocking should NOT override food-seeking or fleeing behavior
        // Only apply formation when fish is NOT actively chasing food or fleeing
        // Note: isChasing was already computed above in Layer 5
        
        if hasFormationTarget && sameSpeciesNearby.count > 0 && !isChasing {
            // The more flockmates, the stronger the formation pull
            let flockStrength = min(CGFloat(sameSpeciesNearby.count) * 0.25, 0.85)
            targetDir = targetDir * (1.0 - flockStrength) + formationDir * flockStrength
        }
        
        // Normalize final direction
        if targetDir.magnitude() > 0.01 {
            targetDir.normalize()
        }
        
        // --- Layer 6: Graceful Wandering with Center Bias ---
        // Wander angle changes very slowly for smooth, meandering paths
        wanderChangeTimer -= 1.0 / 60.0
        if wanderChangeTimer <= 0 {
            // Pick a new wander target occasionally
            wanderChangeTimer = CGFloat.random(in: 2.0...5.0) // seconds between changes
            
            // Bias wander direction toward center when near edges
            let centerX = (bounds.minX + bounds.maxX) / 2
            let centerY = (bounds.minY + bounds.maxY) / 2
            let toCenter = atan2(centerY - position.y, centerX - position.x)
            
            // How far from center? (0 = at center, 1 = at edge)
            let halfWidth = (bounds.maxX - bounds.minX) / 2
            let halfHeight = (bounds.maxY - bounds.minY) / 2
            let distFromCenterX = abs(position.x - centerX) / halfWidth
            let distFromCenterY = abs(position.y - centerY) / halfHeight
            let edgeness = max(distFromCenterX, distFromCenterY)  // 0-1
            
            // When near edges, bias wander toward center
            // When in center, wander freely
            let randomOffset = CGFloat.random(in: -1.2...1.2)
            if edgeness > 0.5 {
                // Blend between random wander and center-seeking based on edgeness
                let centerBias = (edgeness - 0.5) * 2.0  // 0 at 50% from center, 1 at edge
                nextWanderTarget = toCenter * centerBias + (wanderAngle + randomOffset) * (1.0 - centerBias)
            } else {
                nextWanderTarget = wanderAngle + randomOffset
            }
        }
        
        // Slowly drift wander angle towards next target
        var wanderDiff = nextWanderTarget - wanderAngle
        while wanderDiff < -.pi { wanderDiff += 2 * .pi }
        while wanderDiff > .pi { wanderDiff -= 2 * .pi }
        wanderAngle += wanderDiff * 0.02 // Very slow interpolation
        
        let wanderDir = Vector(x: cos(wanderAngle), y: sin(wanderAngle))
        
        // Wander has low influence - just gentle course corrections
        targetDir = targetDir * 0.85 + wanderDir * 0.15
        
        // Normalize final direction
        if targetDir.magnitude() > 0.01 {
            targetDir.normalize()
        }
        
        // Track hunt darting state for sound trigger (only for predators hunting prey, not food)
        // shouldDart is true for both food and prey, but we only want sound for prey hunting
        let isHuntDarting = shouldDart && species.isPredator && currentFoodTarget == nil
        wasHuntDarting = isHuntDarting
        
        return (targetDir, shouldDart, targetDistance)
    }
    
    private func calculateWallAvoidance(bounds: CGRect) -> Vector {
        var avoidance = Vector(x: 0, y: 0)
        let softMargin: CGFloat = 200  // Start turning gently
        let hardMargin: CGFloat = 80   // Turn more urgently
        
        let leftDist = position.x - bounds.minX
        let rightDist = bounds.maxX - position.x
        let bottomDist = position.y - bounds.minY
        let topDist = bounds.maxY - position.y
        
        // Calculate center of bounds for "home" pull
        let centerX = (bounds.minX + bounds.maxX) / 2
        let centerY = (bounds.minY + bounds.maxY) / 2
        
        // --- Standard wall repulsion ---
        if leftDist < softMargin {
            let strength = 1.0 - (leftDist / softMargin)
            avoidance.x += strength * (leftDist < hardMargin ? 2.5 : 1.0)
        }
        if rightDist < softMargin {
            let strength = 1.0 - (rightDist / softMargin)
            avoidance.x -= strength * (rightDist < hardMargin ? 2.5 : 1.0)
        }
        if bottomDist < softMargin {
            let strength = 1.0 - (bottomDist / softMargin)
            avoidance.y += strength * (bottomDist < hardMargin ? 2.5 : 1.0)
        }
        if topDist < softMargin {
            let strength = 1.0 - (topDist / softMargin)
            avoidance.y -= strength * (topDist < hardMargin ? 2.5 : 1.0)
        }
        
        // --- "Parallel scraping" prevention ---
        // If fish is near a wall AND moving parallel to it, add extra inward push
        let minDist = min(leftDist, rightDist, bottomDist, topDist)
        
        // Cache heading components (used multiple times below)
        let headingX = cos(currentHeading)
        let headingY = sin(currentHeading)
        
        if minDist < softMargin {
            // Check if moving mostly parallel to nearest wall
            let isNearVerticalWall = (leftDist < softMargin || rightDist < softMargin)
            let isNearHorizontalWall = (bottomDist < softMargin || topDist < softMargin)
            
            let absHeadingX = abs(headingX)
            let absHeadingY = abs(headingY)
            
            if isNearVerticalWall && absHeadingY > absHeadingX * 1.5 {
                // Moving mostly up/down near left/right wall - push toward center
                let pushStrength = (1.0 - minDist / softMargin) * 1.5
                avoidance.x += (centerX > position.x ? 1 : -1) * pushStrength
            }
            if isNearHorizontalWall && absHeadingX > absHeadingY * 1.5 {
                // Moving mostly left/right near top/bottom wall - push toward center
                let pushStrength = (1.0 - minDist / softMargin) * 1.5
                avoidance.y += (centerY > position.y ? 1 : -1) * pushStrength
            }
        }
        
        // --- Anticipatory avoidance ---
        // If heading TOWARD a wall, start turning earlier
        let lookAhead: CGFloat = 120  // How far ahead to check
        let futureX = position.x + headingX * lookAhead  // Reuse cached values
        let futureY = position.y + headingY * lookAhead
        
        // Will we be outside bounds soon?
        if futureX < bounds.minX + hardMargin {
            avoidance.x += 0.8
        } else if futureX > bounds.maxX - hardMargin {
            avoidance.x -= 0.8
        }
        if futureY < bounds.minY + hardMargin {
            avoidance.y += 0.8
        } else if futureY > bounds.maxY - hardMargin {
            avoidance.y -= 0.8
        }
        
        return avoidance
    }
    
    /// Returns 0-1 indicating how close the fish is to any wall (1 = at the wall)
    private func calculateWallProximity(bounds: CGRect, margin: CGFloat) -> CGFloat {
        let leftDist = position.x - bounds.minX
        let rightDist = bounds.maxX - position.x
        let bottomDist = position.y - bounds.minY
        let topDist = bounds.maxY - position.y
        
        // Find the closest wall distance
        let minDist = min(leftDist, rightDist, bottomDist, topDist)
        
        // Convert to 0-1 proximity (0 = far, 1 = at wall)
        if minDist >= margin {
            return 0
        }
        return 1.0 - (minDist / margin)
    }
    
    /// Detects if fish is moving mostly parallel to the nearest wall (scraping behavior)
    private func isMovingParallelToWall(bounds: CGRect) -> Bool {
        let leftDist = position.x - bounds.minX
        let rightDist = bounds.maxX - position.x
        let bottomDist = position.y - bounds.minY
        let topDist = bounds.maxY - position.y
        
        let margin: CGFloat = 120
        let headingX = cos(currentHeading)
        let headingY = sin(currentHeading)
        
        // Check if near vertical walls (left/right) and moving mostly vertically
        let nearLeftOrRight = leftDist < margin || rightDist < margin
        let movingVertical = abs(headingY) > abs(headingX) * 2.0
        
        // Check if near horizontal walls (top/bottom) and moving mostly horizontally
        let nearTopOrBottom = bottomDist < margin || topDist < margin
        let movingHorizontal = abs(headingX) > abs(headingY) * 2.0
        
        return (nearLeftOrRight && movingVertical) || (nearTopOrBottom && movingHorizontal)
    }
    
    /// Normalize angle to -π...π range
    @inline(__always)
    private func normalizeAngle(_ angle: CGFloat) -> CGFloat {
        var a = angle.truncatingRemainder(dividingBy: .pi * 2)
        if a > .pi { a -= .pi * 2 }
        else if a < -.pi { a += .pi * 2 }
        return a
    }
    
    private func updateRotation() {
        // 1. Smooth Rotation (Full 360 degrees)
        let desiredAngle = atan2(velocity.y, velocity.x)
        
        // Normalize both angles to ensure proper difference calculation
        let normalizedZ = normalizeAngle(zRotation)
        var diff = desiredAngle - normalizedZ
        
        // Normalize the difference to take the shortest path
        if diff > .pi { diff -= .pi * 2 }
        else if diff < -.pi { diff += .pi * 2 }
        
        // Apply smooth rotation
        zRotation = normalizedZ + diff * 0.1
        
        // 2. Flip Sprite Vertically to keep belly down
        // Using hysteresis to avoid jitter at vertical angles
        let vx = velocity.x
        if vx < -0.5 {
            yScale = -scaleFactor
        } else if vx > 0.5 {
            yScale = scaleFactor
        }
        // Note: When -0.5 <= vx <= 0.5, maintain current yScale sign (hysteresis)
        // Only update magnitude if scale changed
        else if abs(abs(yScale) - scaleFactor) > 0.001 {
            yScale = (yScale < 0 ? -1 : 1) * scaleFactor
        }
        
        // Only update xScale if it changed (avoid unnecessary property sets)
        if abs(xScale - scaleFactor) > 0.001 {
            xScale = scaleFactor
        }
    }
    
    private func animateParts() {
        // Slow down all fin animations to match the more leisurely swimming speed
        tailAngle += tailSpeed * 0.4  // Reduced from 1.0x to 0.4x speed
        
        // Amplitude reduction based on size: larger fish have more subtle movements
        let sizeAmplitude = 1.0 - (scaleFactor * 0.5)  // 0.9 at 0.2, 0.5 at 1.0
        
        // Pre-compute sin values to reduce trig calls
        let sinTail = sin(tailAngle)
        let sinPectoral = sin(tailAngle * 0.6)
        let cosPectoral = cos(tailAngle * 0.6)
        let sinPelvic = sin(tailAngle * 0.4)
        
        // Animate each part by setting rotation and recalculating position around pivot
        // Tail: Strong side-to-side motion
        let tailRot = sinTail * 0.25 * sizeAmplitude
        applyRotationToSprite(tailSprite, key: "tail", rotation: tailRot)
        
        // Pectoral fins: Rowing motion
        let pectoralAmp = 0.35 * sizeAmplitude
        applyRotationToSprite(pectoral1Sprite, key: "pectoralFin1", rotation: sinPectoral * pectoralAmp)
        applyRotationToSprite(pectoral2Sprite, key: "pectoralFin2", rotation: -cosPectoral * pectoralAmp * 0.85)
        
        // Pelvic fins: Gentle stabilizing motion
        let pelvicWag = sinPelvic * 0.2 * sizeAmplitude
        applyRotationToSprite(pelvic1Sprite, key: "pelvicFin1", rotation: pelvicWag)
        applyRotationToSprite(pelvic2Sprite, key: "pelvicFin2", rotation: -pelvicWag)
        
        // Dorsal fin: Subtle ripple/wave motion
        applyRotationToSprite(dorsalSprite, key: "dorsalFin", rotation: sinTail * 0.5 * 0.15 * sizeAmplitude)
    }
    
    /// Apply rotation to a sprite, adjusting position to rotate around its pivot point
    @inline(__always)
    private func applyRotationToSprite(_ sprite: SKSpriteNode?, key: String, rotation: CGFloat) {
        guard let sprite = sprite,
              let basePos = partBasePositions[key],
              let pivot = partPivots[key] else { return }
        
        sprite.zRotation = rotation
        
        // Rotate the pivot offset around (0,0) by the rotation angle
        let cosR = cos(rotation)
        let sinR = sin(rotation)
        let rotatedPivotX = pivot.x * cosR - pivot.y * sinR
        let rotatedPivotY = pivot.x * sinR + pivot.y * cosR
        
        sprite.position = CGPoint(x: basePos.x + rotatedPivotX, y: basePos.y + rotatedPivotY)
    }
    
    // MARK: - Setup
    private func setupParts() {
        let config = loadConfig()
        configs["body"] = config.body
        configs["tail"] = config.tail
        configs["dorsalFin"] = config.dorsalFin
        configs["pectoralFin1"] = config.pectoralFin1
        configs["pectoralFin2"] = config.pectoralFin2
        configs["pelvicFin1"] = config.pelvicFin1
        configs["pelvicFin2"] = config.pelvicFin2
        
        let bodyName = "\(species.folderName)_body"
        let bodyTexture = SKTexture(imageNamed: bodyName)
        if bodyTexture.size().width > 0 {
            let maxDimension = max(bodyTexture.size().width, bodyTexture.size().height)
            baseScale = (species.size * 2) / maxDimension
        }

        // Create sprites directly (no intermediate bone nodes)
        for key in partKeys {
            let imageName = "\(species.folderName)_\(key)"
            let texture = SKTexture(imageNamed: imageName)
            if let partConfig = configs[key] {
                let sprite = SKSpriteNode(texture: texture)
                // Scale part zIndex to be tiny (0.0001-0.001 range) so parts only affect
                // ordering within this fish, not between different fish
                // Max zIndex ~10, so max part zPosition = 0.001, well under fish separation of 0.01
                sprite.zPosition = CGFloat(partConfig.zIndex) * 0.0001
                
                let finalScale = baseScale * partConfig.scale
                sprite.xScale = -finalScale
                sprite.yScale = partConfig.flipY ? -finalScale : finalScale
                
                // Store pivot point for rotation calculations
                let pivotX = partConfig.pivotX * finalScale
                let pivotY = partConfig.pivotY * finalScale
                partPivots[key] = CGPoint(x: pivotX, y: pivotY)
                partScales[key] = finalScale
                
                // Calculate base position (where sprite sits when rotation = 0)
                let baseX = -(partConfig.x + partConfig.pivotX) * baseScale
                let baseY = -(partConfig.y + partConfig.pivotY) * baseScale
                partBasePositions[key] = CGPoint(x: baseX, y: baseY)
                
                // Set initial position
                sprite.position = CGPoint(x: baseX + pivotX, y: baseY + pivotY)
                sprite.anchorPoint = CGPoint(x: 0.5, y: 0.5)
                
                addChild(sprite)
                sprites[key] = sprite
            }
        }
        
        // Cache sprite references for faster animation
        tailSprite = sprites["tail"]
        pectoral1Sprite = sprites["pectoralFin1"]
        pectoral2Sprite = sprites["pectoralFin2"]
        pelvic1Sprite = sprites["pelvicFin1"]
        pelvic2Sprite = sprites["pelvicFin2"]
        dorsalSprite = sprites["dorsalFin"]
        bodySprite = sprites["body"]
    }
    
    private func loadConfig() -> FishConfig {
        let fileName = "\(species.folderName)_config"
        guard let url = Bundle.main.url(forResource: fileName, withExtension: "json") else { return FishConfig() }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(FishConfig.self, from: data)
        } catch {
            print("Config Error: \(error)")
            return FishConfig()
        }
    }
}
