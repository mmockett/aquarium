import SpriteKit

// MARK: - Food Node (SKSpriteNode for better performance)
class FoodNode: SKSpriteNode {
    var vel: CGVector = CGVector(dx: 0, dy: 0)
    var acc: CGVector = CGVector(dx: 0, dy: 0.015) // Very slow fall - gives fish time to catch it
    var wobbleSpeed: CGFloat = 0
    var wobbleDist: CGFloat = 0
    var timeOffset: CGFloat = 0
    var eaten: Bool = false
    
    // Targeting Logic
    var targetCount: Int = 0
    let maxTargets: Int = 3
    
    // Shared texture for all food nodes (generated once)
    private static var sharedTexture: SKTexture?
    
    /// Generate the shared food texture (call once at app startup)
    static func generateSharedTexture() {
        // Create a small circle texture programmatically
        let size: CGFloat = 8  // Texture size (4px radius * 2)
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
        let image = renderer.image { context in
            let ctx = context.cgContext
            
            // Fill color (darker brown)
            ctx.setFillColor(SKColor(red: 0.75, green: 0.55, blue: 0.35, alpha: 1.0).cgColor)
            ctx.fillEllipse(in: CGRect(x: 1, y: 1, width: size - 2, height: size - 2))
            
            // Stroke color (darker)
            ctx.setStrokeColor(SKColor(red: 0.5, green: 0.3, blue: 0.15, alpha: 1.0).cgColor)
            ctx.setLineWidth(1)
            ctx.strokeEllipse(in: CGRect(x: 1, y: 1, width: size - 2, height: size - 2))
        }
        
        sharedTexture = SKTexture(image: image)
    }
    
    /// Generate texture only if not already generated (for fallback use)
    static func generateSharedTextureIfNeeded() {
        guard sharedTexture == nil else { return }
        generateSharedTexture()
    }
    
    init(position: CGPoint) {
        // Ensure shared texture exists
        if FoodNode.sharedTexture == nil {
            FoodNode.generateSharedTexture()
        }
        
        super.init(texture: FoodNode.sharedTexture, color: .clear, size: CGSize(width: 4, height: 4))
        self.position = position
        self.name = "food"
        self.zPosition = 5
        
        // Random wobble properties
        wobbleSpeed = CGFloat.random(in: 0.003...0.006)
        wobbleDist = CGFloat.random(in: 0.2...0.6)
        timeOffset = CGFloat.random(in: 0...1000)
    }
    
    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // Pre-calculated multiplier for wobble
    private static let timeToMillis: CGFloat = 1000.0
    
    func update(height: CGFloat, currentTime: TimeInterval) {
        // Match JS: vel.add(acc), vel.mult(0.95), pos.add(vel)
        vel.dx += acc.dx
        vel.dy += acc.dy
        vel.dx *= 0.95
        vel.dy *= 0.95
        
        // Apply velocity (Note: SpriteKit Y-up, JS Y-down, so we invert dy)
        position.x += vel.dx
        position.y -= vel.dy
        
        // Wobble
        let wobble = sin(CGFloat(currentTime) * FoodNode.timeToMillis * wobbleSpeed + timeOffset) * wobbleDist
        position.x += wobble
        
        // Mark as eaten when below screen
        if position.y < 0 {
            eaten = true
        }
    }
}

