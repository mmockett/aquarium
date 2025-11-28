import SpriteKit
import CoreImage

// MARK: - Bubble Node (SKSpriteNode + SKAction for best performance)
class BubbleNode: SKSpriteNode {
    private var visibleBounds: CGRect = CGRect(x: 0, y: 0, width: 400, height: 800)
    
    // Shared texture for all bubbles (generated once)
    private static var sharedTexture: SKTexture?
    
    /// Generate shared bubble texture (call once at app startup)
    static func generateSharedTextures() {
        guard sharedTexture == nil else { return }
        
        // Generate a single white circle texture, we'll scale it per-bubble
        let texSize: CGFloat = 16  // Base texture size
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: texSize, height: texSize))
        let image = renderer.image { context in
            let ctx = context.cgContext
            // Draw a soft white circle
            ctx.setFillColor(UIColor.white.cgColor)
            ctx.fillEllipse(in: CGRect(x: 1, y: 1, width: texSize - 2, height: texSize - 2))
        }
        sharedTexture = SKTexture(image: image)
    }
    
    init() {
        // Ensure shared texture exists
        if BubbleNode.sharedTexture == nil {
            BubbleNode.generateSharedTextures()
        }
        
        // Random size (2-8 points displayed - 2x bigger than before)
        let displaySize = CGFloat.random(in: 2...8)
        
        super.init(texture: BubbleNode.sharedTexture, color: .clear, size: CGSize(width: displaySize, height: displaySize))
        
        // Semi-transparent white
        self.alpha = 0.15
        zPosition = -50
    }
    
    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    /// Update visible bounds (call when screen size changes)
    func updateVisibleBounds(_ bounds: CGRect) {
        self.visibleBounds = bounds
    }
    
    /// Call this after adding to scene to start the animation
    func startAnimation(visibleBounds: CGRect, startFromRandom: Bool = true) {
        self.visibleBounds = visibleBounds
        startBubbleLoop(startFromRandom: startFromRandom)
    }
    
    private func startBubbleLoop(startFromRandom: Bool) {
        // Stop any existing actions
        removeAllActions()
        
        // Randomize size (2-8 points - 2x bigger than original 1-4)
        let displaySize = CGFloat.random(in: 2...8)
        size = CGSize(width: displaySize, height: displaySize)
        
        // Random X position within visible bounds
        let safeMinX = visibleBounds.minX + 10
        let safeMaxX = visibleBounds.maxX - 10
        position.x = CGFloat.random(in: safeMinX...max(safeMinX, safeMaxX))
        
        // Starting Y position - either random (initial spawn) or at bottom (loop)
        if startFromRandom {
            position.y = CGFloat.random(in: visibleBounds.minY...visibleBounds.maxY)
        } else {
            position.y = visibleBounds.minY - 10
        }
        
        // Random rise speed (pixels per second)
        let riseSpeed = CGFloat.random(in: 30...80)
        
        // Calculate distance to top and duration
        let distanceToTop = visibleBounds.maxY + 20 - position.y
        let riseDuration = TimeInterval(distanceToTop / riseSpeed)
        
        // Wobble parameters
        let wobbleAmount = CGFloat.random(in: 8...20)
        let wobbleDuration = Double.random(in: 1.5...3.0)
        
        // Create rise action
        let rise = SKAction.moveBy(x: 0, y: distanceToTop, duration: riseDuration)
        rise.timingMode = .linear
        
        // Create wobble action (runs concurrently with rise)
        let wobbleRight = SKAction.moveBy(x: wobbleAmount, y: 0, duration: wobbleDuration / 2)
        wobbleRight.timingMode = .easeInEaseOut
        let wobbleLeft = SKAction.moveBy(x: -wobbleAmount, y: 0, duration: wobbleDuration / 2)
        wobbleLeft.timingMode = .easeInEaseOut
        let wobbleSequence = SKAction.sequence([wobbleRight, wobbleLeft])
        let wobbleForever = SKAction.repeatForever(wobbleSequence)
        
        // Combine rise with wobble
        let riseWithWobble = SKAction.group([rise, wobbleForever])
        
        // After reaching top, reset to bottom and start again
        let resetAndLoop = SKAction.run { [weak self] in
            self?.startBubbleLoop(startFromRandom: false)
        }
        
        // Run the full sequence
        run(SKAction.sequence([riseWithWobble, resetAndLoop]), withKey: "bubbleLoop")
    }
    
    // Legacy update method - now a no-op
    func update(currentTime: TimeInterval) { }
}

// MARK: - Weed Node (SKAction-based animation)
class WeedNode: SKSpriteNode {
    
    init(texture: SKTexture) {
        super.init(texture: texture, color: .clear, size: texture.size())
        
        self.anchorPoint = CGPoint(x: 0.5, y: 0.0) // Anchor at bottom
        
        // Initial scale randomization
        let s = CGFloat.random(in: 0.25...0.5)
        setScale(s)
        
        alpha = 1.0
        
        // Start sway animation immediately
        startSwayAnimation()
    }
    
    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func startSwayAnimation() {
        // Random sway parameters
        let swaySpeed = CGFloat.random(in: 0.5...1.5)
        let swayAmplitude: CGFloat = 0.08  // Max rotation in radians
        let swayDuration = TimeInterval(1.0 / swaySpeed)  // Period of oscillation
        
        // Random starting phase (rotate to random position first)
        let startPhase = CGFloat.random(in: -swayAmplitude...swayAmplitude)
        zRotation = startPhase
        
        // Create smooth oscillating sway
        let swayRight = SKAction.rotate(toAngle: swayAmplitude, duration: swayDuration / 2)
        swayRight.timingMode = .easeInEaseOut
        let swayLeft = SKAction.rotate(toAngle: -swayAmplitude, duration: swayDuration)
        swayLeft.timingMode = .easeInEaseOut
        let swayBack = SKAction.rotate(toAngle: swayAmplitude, duration: swayDuration / 2)
        swayBack.timingMode = .easeInEaseOut
        
        // First go from current position to one side, then oscillate
        let initialMove = SKAction.rotate(toAngle: swayAmplitude, duration: swayDuration / 4)
        initialMove.timingMode = .easeOut
        
        let oscillate = SKAction.repeatForever(SKAction.sequence([swayLeft, swayRight]))
        
        run(SKAction.sequence([initialMove, oscillate]))
    }
    
    // Legacy update method - now a no-op since animations are action-based
    func update(currentTime: TimeInterval) {
        // No longer needed - animations handled by SKAction
    }
}

// Note: RippleNode moved to ShaderRippleNode.swift with shader-based water effect
