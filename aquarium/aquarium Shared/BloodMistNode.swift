import SpriteKit

// MARK: - Blood Mist Node (Matches BloodMist.js exactly)
class BloodMistNode: SKEffectNode {
    // Use class instead of struct to avoid copy-on-write in update loop
    class Particle {
        var vx: CGFloat
        var vy: CGFloat
        var ox: CGFloat // Relative offset from center
        var oy: CGFloat
        let size: CGFloat
        let phase: CGFloat
        let shapeNode: SKShapeNode
        
        init(vx: CGFloat, vy: CGFloat, ox: CGFloat, oy: CGFloat, size: CGFloat, phase: CGFloat, shapeNode: SKShapeNode) {
            self.vx = vx
            self.vy = vy
            self.ox = ox
            self.oy = oy
            self.size = size
            self.phase = phase
            self.shapeNode = shapeNode
        }
    }
    
    private var particles: [Particle] = []
    private var age: CGFloat = 0
    private let maxAge: CGFloat = 600 // JS: 600 frames (10 seconds at 60fps)
    
    init(position: CGPoint) {
        super.init()
        self.position = position
        self.zPosition = 5
        self.name = "bloodMist"
        
        // Optimization: Use a single SKEffectNode container for blur, rasterize for performance
        self.shouldEnableEffects = true
        self.shouldRasterize = true
        if let filter = CIFilter(name: "CIGaussianBlur") {
            filter.setValue(5.0, forKey: kCIInputRadiusKey)
            self.filter = filter
        }
        
        // JS: Create 15 particles
        particles.reserveCapacity(15)
        for _ in 0..<15 {
            let size = CGFloat.random(in: 10...25) // JS: rand(10, 25)
            
            let particleNode = SKShapeNode(circleOfRadius: size)
            // JS: rgba(220, 60, 60, alpha * 0.2) - Initial alpha 0.2
            particleNode.fillColor = SKColor(red: 220/255.0, green: 60/255.0, blue: 60/255.0, alpha: 0.2)
            particleNode.strokeColor = .clear
            particleNode.blendMode = .alpha
            
            addChild(particleNode)
            
            let p = Particle(
                vx: CGFloat.random(in: -0.2...0.2), // JS: rand(-0.2, 0.2)
                vy: CGFloat.random(in: -0.2...0.2),
                ox: CGFloat.random(in: -10...10), // JS: rand(-10, 10)
                oy: CGFloat.random(in: -10...10),
                size: size,
                phase: CGFloat.random(in: 0...(2 * .pi)), // JS: rand(0, Math.PI * 2)
                shapeNode: particleNode
            )
            particles.append(p)
        }
    }
    
    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // Pre-cached base color components (avoid repeated division)
    private static let baseRed: CGFloat = 220.0 / 255.0
    private static let baseGreen: CGFloat = 60.0 / 255.0
    private static let baseBlue: CGFloat = 60.0 / 255.0
    
    func update() {
        age += 1
        let lifePct = age / maxAge
        let alpha = 1.0 - lifePct // JS: Linear fade out
        
        if alpha <= 0 {
            removeFromParent()
            return
        }
        
        // Pre-calculate values used in loop
        let particleAlpha = alpha * 0.2
        let ageOffset = age * 0.02
        let sizeGrowth = age * 0.05
        
        // JS: Update particle positions (no struct copy since Particle is now a class)
        for p in particles {
            // JS: p.ox += p.vx, p.oy += p.vy
            p.ox += p.vx
            p.oy += p.vy
            
            // JS: p.ox += Math.sin(this.age * 0.02 + p.phase) * 0.1 (turbulent motion)
            p.ox += sin(ageOffset + p.phase) * 0.1
            
            // JS: const currentSize = p.size + (this.age * 0.05) (expand over time)
            let scale = (p.size + sizeGrowth) / p.size
            
            // Update node position and size
            p.shapeNode.position = CGPoint(x: p.ox, y: p.oy)
            p.shapeNode.setScale(scale)
            
            // Update alpha only (color components are constant)
            p.shapeNode.fillColor = SKColor(red: BloodMistNode.baseRed, green: BloodMistNode.baseGreen, blue: BloodMistNode.baseBlue, alpha: particleAlpha)
        }
    }
}
