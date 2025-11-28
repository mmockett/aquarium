import SpriteKit
import simd

#if os(iOS) || os(tvOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

// MARK: - Time Cycle Structures
struct TimeColors {
    let top: SKColor
    let bottom: SKColor
    let ray: SKColor
    let caustic: SKColor
    let overlay: SKColor
}

struct CycleConfig {
    static let dawn = TimeColors(
        top: SKColor(red: 0.36, green: 0.31, blue: 0.43, alpha: 1.0), // #5D4E6D
        bottom: SKColor(red: 0.16, green: 0.11, blue: 0.24, alpha: 1.0), // #2A1B3D
        ray: SKColor(red: 1.0, green: 0.78, blue: 0.59, alpha: 0.15), // #FFC796
        caustic: SKColor(red: 1.0, green: 0.78, blue: 0.59, alpha: 0.12), // #FFC796 - More visible at dawn
        overlay: SKColor(red: 0.2, green: 0.08, blue: 0.31, alpha: 0.2) // #33144F
    )
    static let day = TimeColors(
        top: SKColor(red: 0.18, green: 0.35, blue: 0.43, alpha: 1.0), // #2F5A6E
        bottom: SKColor(red: 0.09, green: 0.15, blue: 0.17, alpha: 1.0), // #16252B
        ray: SKColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 0.08), // #FFFFFF
        caustic: SKColor(red: 0.64, green: 0.87, blue: 0.86, alpha: 0.15), // #A3DEDB - Most visible during day
        overlay: SKColor(red: 0, green: 0, blue: 0, alpha: 0.0) // #000000
    )
    static let dusk = TimeColors(
        top: SKColor(red: 0.44, green: 0.25, blue: 0.31, alpha: 1.0), // #704050
        bottom: SKColor(red: 0.18, green: 0.12, blue: 0.18, alpha: 1.0), // #2D1E2F
        ray: SKColor(red: 1.0, green: 0.59, blue: 0.39, alpha: 0.1), // #FF9663
        caustic: SKColor(red: 0.78, green: 0.50, blue: 0.40, alpha: 0.08), // #C77F66 (Peach) - Visible at dusk
        overlay: SKColor(red: 0.31, green: 0.16, blue: 0.08, alpha: 0.1) // #4F2914
    )
    static let night = TimeColors(
        top: SKColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0), // #0F172A
        bottom: SKColor(red: 0.01, green: 0.02, blue: 0.09, alpha: 1.0), // #020617
        ray: SKColor(red: 0.39, green: 0.59, blue: 1.0, alpha: 0.03), // #6396FF
        caustic: SKColor(red: 0.2, green: 0.31, blue: 0.59, alpha: 0.01), // #334F96 - Barely visible at night
        overlay: SKColor(red: 0.02, green: 0.04, blue: 0.16, alpha: 0.6) // #050A29
    )
}

class GameScene: SKScene {
    
    // MARK: - Properties
    var fishNodes: [FishNode] = []
    var lastUpdateTime: TimeInterval = 0
    
    /// Call this when app returns from background to prevent "catch-up" animation
    func resetUpdateTime() {
        lastUpdateTime = 0
    }
    
    // Environment
    var gradientNode: SKSpriteNode?
    var gradientShader: SKShader?
    var frontOverlayNode: SKSpriteNode?
    var frontOverlayShader: SKShader?
    
    var weedsLayer: SKNode? // Changed from SKEffectNode to SKNode for performance
    
    var causticsContainer: SKNode? // Changed from SKEffectNode
    private var causticNodes: [SKNode] = [] // Direct references for faster animation
    
    var bubbles: [BubbleNode] = []
    var weeds: [WeedNode] = []
    
    // Cycle
    var timeCycle: CGFloat = 0.0 // 0.0 to 1.0
    var lastAutoFeedTime: TimeInterval = 0
    var isNight: Bool = false
    
    // Caustics controls
    private var causticsTime: CGFloat = 0.0
    
    // Cached visible bounds (updated once per frame)
    private var cachedVisibleBounds: CGRect = .zero
    
    // Tracked nodes for efficient cleanup (avoid enumerateChildNodes)
    private var trackedFoodNodes: [FoodNode] = []
    private var bloodMistNodes: [BloodMistNode] = []
    private let maxFoodNodes = 50  // Prevent excessive food buildup
    private var cleanupCounter = 0  // For periodic deep cleanup
    
    // MARK: - Lifecycle
    override func didMove(to view: SKView) {
        backgroundColor = SKColor(red: 0.1, green: 0.2, blue: 0.3, alpha: 1.0)
        
        physicsWorld.gravity = CGVector(dx: 0, dy: -1.0)
        
        // Pre-generate shared textures for better performance
        FoodNode.generateSharedTexture()
        BubbleNode.generateSharedTextures()
        
        setupBackground()
        setupEnvironment()
        
        // Try to restore saved fish, otherwise spawn initial fish
        if GameData.shared.hasSavedFish {
            restoreSavedFish()
        } else {
            // Spawn one initial fish
            spawnFish()
        }
        
        // Set up callbacks for settings
        GameData.shared.onRestartGame = { [weak self] in
            self?.restartGame()
        }
        GameData.shared.onBackgroundChanged = { [weak self] in
            self?.setupBackground()
        }
    }
    
    /// Restart the game - remove all fish and reset
    private func restartGame() {
        // Remove all fish and their labels
        for fish in fishNodes {
            fish.removeLabels()
            fish.removeFromParent()
        }
        fishNodes.removeAll()
        
        // Remove all food
        for food in trackedFoodNodes {
            food.removeFromParent()
        }
        trackedFoodNodes.removeAll()
        
        // Remove all blood mist
        for mist in bloodMistNodes {
            mist.removeFromParent()
        }
        bloodMistNodes.removeAll()
        
        // Spawn one initial fish
        spawnFish()
    }
    
    /// Restore fish from saved state
    private func restoreSavedFish() {
        for savedState in GameData.shared.savedFishStates {
            if let fish = FishNode(savedState: savedState) {
                fish.onReproduction = { [weak self] (parentSpecies, parentPos, parent1Name, parent2Name) in
                    self?.spawnBaby(species: parentSpecies, position: parentPos, parent1Name: parent1Name, parent2Name: parent2Name)
                }
                addChild(fish)
                fish.addLabelsToScene()
                fishNodes.append(fish)
            }
        }
        GameData.shared.clearSavedFishStates()
        print("GameScene: Restored \(fishNodes.count) fish from saved state")
    }
    
    /// Save current fish states to GameData for persistence
    func saveFishStates() {
        GameData.shared.savedFishStates = fishNodes.filter { !$0.isDead }.map { $0.toSavedState() }
    }
    
    private var bubblesNeedStart = true
    
    func setupEnvironment() {
        // Create bubbles (animation will start once we have valid visible bounds)
        for _ in 0..<20 {
            let b = BubbleNode()
            b.alpha = 0  // Hidden until animation starts
            addChild(b)
            bubbles.append(b)
        }
        bubblesNeedStart = true
        
        // Calculate initial visible bounds (will be refined in update loop)
        var visibleBounds = CGRect(origin: .zero, size: size)
        if let view = view {
            let topLeft = convertPoint(fromView: .zero)
            let bottomRight = convertPoint(fromView: CGPoint(x: view.bounds.width, y: view.bounds.height))
            visibleBounds = CGRect(x: topLeft.x, y: bottomRight.y, width: bottomRight.x - topLeft.x, height: topLeft.y - bottomRight.y)
        }
        
        // Weeds (Optimized: Use pre-blurred textures for parity without live-blur cost)
        let wLayer = SKNode()
        wLayer.zPosition = -95
        addChild(wLayer)
        self.weedsLayer = wLayer
        
        let weedImages = ["Weeds", "Weeds 2", "Weed 3"]
        var blurredWeedTextures: [String: SKTexture] = [:]
        
        // Pre-generate blurred textures
        for imgName in weedImages {
            if let blurred = createBlurredTexture(imageNamed: imgName, radius: 10.0) {
                blurredWeedTextures[imgName] = blurred
            }
        }
        
        // Spread weeds across visible screen width
        let weedWidth = visibleBounds.width
        let weedMinX = visibleBounds.minX
        
        for i in 0..<8 {
            let imgName = weedImages.randomElement()!
            
            // Use blurred texture if available, otherwise standard (fallback)
            var w: WeedNode
            if let tex = blurredWeedTextures[imgName] {
                w = WeedNode(texture: tex)
            } else {
                w = WeedNode(texture: SKTexture(imageNamed: imgName))
            }
            
            let x = weedMinX + CGFloat(i) * (weedWidth / 8.0) + CGFloat.random(in: -20...20)
            w.position = CGPoint(x: x, y: visibleBounds.minY - 40)
            wLayer.addChild(w) 
            weeds.append(w)
        }
    }
        
    // Helper to create a blurred texture from an image name
    func createBlurredTexture(imageNamed name: String, radius: CGFloat) -> SKTexture? {
        let texture = SKTexture(imageNamed: name)
        let sprite = SKSpriteNode(texture: texture)
        sprite.anchorPoint = CGPoint(x: 0.5, y: 0.5) // Center in effect node
        
        let effectNode = SKEffectNode()
        effectNode.shouldEnableEffects = true
        if let filter = CIFilter(name: "CIGaussianBlur") {
            filter.setValue(radius, forKey: kCIInputRadiusKey)
            effectNode.filter = filter
        }
        effectNode.addChild(sprite)
        
        // Render texture (requires view to be attached)
        return self.view?.texture(from: effectNode)
    }
    
    func setupBackground() {
        // Full Background Setup with Blur Parity
        // Clean up existing background layers
        gradientNode?.removeFromParent()
        frontOverlayNode?.removeFromParent()
        causticsContainer?.removeFromParent()
        
        // Remove old background blur nodes (they have zPosition -100 and -99)
        children.filter { $0.zPosition == -100 || $0.zPosition == -99 }.forEach { $0.removeFromParent() }
        
        // Use selected background from settings
        let backgroundName = "Background\(GameData.shared.selectedBackground)"
        let bgTex = SKTexture(imageNamed: backgroundName)
        let bgSize = coverSize(imageSize: bgTex.size(), viewSize: size)
        
        // 1. Layer 1: Light Blur (10px)
        let lightBlurNode = SKEffectNode()
        lightBlurNode.zPosition = -100
        if let filter = CIFilter(name: "CIGaussianBlur") {
            filter.setValue(6.0, forKey: kCIInputRadiusKey) // Increased for parity
            lightBlurNode.filter = filter
            lightBlurNode.shouldEnableEffects = true
            lightBlurNode.shouldRasterize = true
        }
        let bg1 = SKSpriteNode(texture: bgTex, size: bgSize)
        lightBlurNode.addChild(bg1)
        lightBlurNode.position = CGPoint(x: size.width/2, y: size.height/2)
        addChild(lightBlurNode)
        
        // 2. Layer 2: Heavy Blur (20px) Masked by Gradient
        let heavyBlurNode = SKEffectNode()
        if let filter = CIFilter(name: "CIGaussianBlur") {
            filter.setValue(12.0, forKey: kCIInputRadiusKey) // Increased for parity
            heavyBlurNode.filter = filter
            heavyBlurNode.shouldEnableEffects = true
            heavyBlurNode.shouldRasterize = true
        }
        let bg2 = SKSpriteNode(texture: bgTex, size: bgSize)
        heavyBlurNode.addChild(bg2)
        
        // Mask: Top (1.0) Opaque -> Bottom (0.0) Transparent
        let maskSprite = SKSpriteNode(color: .white, size: bgSize)
        let maskShader = SKShader(source: """
        void main() {
            float y = v_tex_coord.y;
            gl_FragColor = vec4(1.0, 1.0, 1.0, y);
        }
        """)
        maskSprite.shader = maskShader
        
        let cropNode = SKCropNode()
        cropNode.zPosition = -99
        cropNode.position = CGPoint(x: size.width/2, y: size.height/2)
        cropNode.maskNode = maskSprite
        cropNode.addChild(heavyBlurNode)
        addChild(cropNode)
        
        // 3. Gradient Overlay (Merged with Night Overlay)
        createGradientNode()
        
        // 4. Caustics
        setupCausticsLayer()
        }
        
    // Helper for Aspect Fill
    func coverSize(imageSize: CGSize, viewSize: CGSize) -> CGSize {
        let aspect = imageSize.width / imageSize.height
        let viewAspect = viewSize.width / viewSize.height
        if aspect > viewAspect {
            return CGSize(width: viewSize.height * aspect, height: viewSize.height)
        } else {
            return CGSize(width: viewSize.width, height: viewSize.width / aspect)
        }
    }
    
    private func createGradientNode() {
        // BACK OVERLAY (behind fish) - reduced from 0.8 to 0.72 intensity
        let sprite = SKSpriteNode(color: .white, size: size)
        sprite.position = CGPoint(x: size.width/2, y: size.height/2)
        sprite.zPosition = -90 // Covers everything behind (weeds, bg, caustics)
        sprite.blendMode = .multiply
        sprite.alpha = 1.0
        
        let backShaderSource = """
        void main() {
            vec4 top = u_top_color;
            vec4 bottom = u_bottom_color;
            float night = u_night_alpha;
            float y = v_tex_coord.y;
            
            vec4 c = mix(bottom, top, y);
            
            // Gamma Correction
            vec3 srgbC = pow(c.rgb, vec3(1.0/2.2));
            
            // Base Gradient Factor (reduced from 0.8 to 0.72 - 90% of original)
            vec3 factor = srgbC * 0.72;
            
            // Night Logic: Darken further based on night alpha
            vec3 nightMultiplier = mix(vec3(1.0), vec3(0.35, 0.35, 0.55), night);
            
            gl_FragColor = vec4(factor * nightMultiplier, 1.0);
        }
        """
        
        let shader = SKShader(source: backShaderSource)
        shader.uniforms = [
            SKUniform(name: "u_top_color", vectorFloat4: vector_float4(0,0,0,0)),
            SKUniform(name: "u_bottom_color", vectorFloat4: vector_float4(0,0,0,0)),
            SKUniform(name: "u_night_alpha", float: 0.0)
        ]
        
        sprite.shader = shader
        addChild(sprite)
        self.gradientNode = sprite
        self.gradientShader = shader
        
        // FRONT OVERLAY (in front of fish) - 10% intensity for depth effect
        let frontSprite = SKSpriteNode(color: .white, size: size)
        frontSprite.position = CGPoint(x: size.width/2, y: size.height/2)
        frontSprite.zPosition = 50 // Above fish (10) but below labels (199+)
        frontSprite.blendMode = .multiply
        frontSprite.alpha = 1.0
        
        let frontShaderSource = """
        void main() {
            vec4 top = u_top_color;
            vec4 bottom = u_bottom_color;
            float night = u_night_alpha;
            float y = v_tex_coord.y;
            
            vec4 c = mix(bottom, top, y);
            
            // Gamma Correction
            vec3 srgbC = pow(c.rgb, vec3(1.0/2.2));
            
            // Overlay intensity: 2% during day, ramps up to 30% at night
            // This lets fish stand out more during the day, with stronger depth at night
            float intensity = mix(0.02, 0.30, night);
            vec3 factor = mix(vec3(1.0), srgbC, intensity);
            
            // Night Logic: Slightly darken at night
            vec3 nightMultiplier = mix(vec3(1.0), vec3(0.85, 0.85, 0.9), night);
            
            gl_FragColor = vec4(factor * nightMultiplier, 1.0);
        }
        """
        
        let frontShader = SKShader(source: frontShaderSource)
        frontShader.uniforms = [
            SKUniform(name: "u_top_color", vectorFloat4: vector_float4(0,0,0,0)),
            SKUniform(name: "u_bottom_color", vectorFloat4: vector_float4(0,0,0,0)),
            SKUniform(name: "u_night_alpha", float: 0.0)
        ]
        
        frontSprite.shader = frontShader
        addChild(frontSprite)
        self.frontOverlayNode = frontSprite
        self.frontOverlayShader = frontShader
    }
    
    private var causticsNeedSetup = true
    private var causticGradientTexture: SKTexture?
    
    private func setupCausticsLayer() {
        // Remove any existing caustics first
        for node in causticNodes {
            node.removeFromParent()
        }
        causticNodes.removeAll()
        causticsContainer?.removeFromParent()
        causticsContainer = nil
        
        // Create a soft gradient texture programmatically (no blur needed)
        if causticGradientTexture == nil {
            causticGradientTexture = createSoftGradientTexture()
        }
        
        guard let gradientTexture = causticGradientTexture else {
            #if DEBUG
            print("Warning: Failed to create caustic gradient texture")
            #endif
            causticsNeedSetup = false
            return
        }
        
        // Calculate visible bounds for caustics positioning
        var visibleBounds = CGRect(origin: .zero, size: size)
        if let view = view {
            let topLeft = convertPoint(fromView: .zero)
            let bottomRight = convertPoint(fromView: CGPoint(x: view.bounds.width, y: view.bounds.height))
            visibleBounds = CGRect(x: topLeft.x, y: bottomRight.y, width: bottomRight.x - topLeft.x, height: topLeft.y - bottomRight.y)
        }
        
        // Create caustic sprites using the gradient texture (3 is enough for visible screen width)
        for i in 0..<3 {
            let causticSprite = SKSpriteNode(texture: gradientTexture)
            causticSprite.name = "caustic_\(i)"
            
            // Varying scale for natural look - tall and narrow beams
            let scaleX = CGFloat.random(in: 1.0...1.8)
            let scaleY = visibleBounds.height * CGFloat.random(in: 2.0...3.0) / gradientTexture.size().height
            causticSprite.xScale = scaleX
            causticSprite.yScale = scaleY
            
            // Screen blend mode - brightens underlying pixels (like light)
            causticSprite.blendMode = .screen
            
            // Slight rotation for diagonal light rays (~15-25 degrees)
            causticSprite.zRotation = CGFloat.random(in: 0.26...0.44)
            
            // Position spread across visible screen with some randomness
            causticSprite.position = CGPoint(
                x: visibleBounds.minX + CGFloat(i) * (visibleBounds.width / 2) + CGFloat.random(in: -30...30),
                y: visibleBounds.midY
            )
            
            // Z-position: Above back overlay (-90), below fish (10)
            causticSprite.zPosition = 5
            
            // Use a simple SKNode wrapper for animation
            let wrapper = SKNode()
            wrapper.position = causticSprite.position
            wrapper.zPosition = 5
            causticSprite.position = .zero
            wrapper.addChild(causticSprite)
            
            addChild(wrapper)
            causticNodes.append(wrapper)
        }
        
        #if DEBUG
        print("Caustics setup complete - \(causticNodes.count) caustic beams using gradient texture")
        #endif
        
        causticsNeedSetup = false
    }
    
    /// Creates a soft radial gradient texture that fades from center to edges
    /// This gives a "blurred" look without any actual blur processing
    private func createSoftGradientTexture() -> SKTexture? {
        let textureWidth = 128
        let textureHeight = 256
        
        // Create a CGContext to draw the gradient
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: nil,
            width: textureWidth,
            height: textureHeight,
            bitsPerComponent: 8,
            bytesPerRow: textureWidth * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        
        // Draw a horizontal gradient that fades from transparent -> white -> transparent
        // This creates the soft beam effect
        for x in 0..<textureWidth {
            // Calculate alpha based on distance from center (bell curve / gaussian-like)
            let centerX = CGFloat(textureWidth) / 2.0
            let distFromCenter = abs(CGFloat(x) - centerX) / centerX  // 0 at center, 1 at edges
            
            // Smooth falloff using cosine (softer than linear)
            let alpha = cos(distFromCenter * .pi / 2)  // 1 at center, 0 at edges
            let alphaByte = UInt8(max(0, min(255, alpha * 255)))
            
            // Draw vertical line at this x position
            context.setFillColor(red: 1.0, green: 1.0, blue: 1.0, alpha: CGFloat(alphaByte) / 255.0)
            context.fill(CGRect(x: x, y: 0, width: 1, height: textureHeight))
        }
        
        // Also add vertical fade at top and bottom for softer edges
        for y in 0..<textureHeight {
            let centerY = CGFloat(textureHeight) / 2.0
            let distFromCenterY = abs(CGFloat(y) - centerY) / centerY
            
            // Only fade the outer 20% at top and bottom
            if distFromCenterY > 0.8 {
                let fadeAmount = (distFromCenterY - 0.8) / 0.2  // 0 to 1 in outer 20%
                let alpha = 1.0 - fadeAmount
                
                // Overlay a semi-transparent black to fade out the edges
                context.setFillColor(red: 0, green: 0, blue: 0, alpha: 1.0 - alpha)
                context.setBlendMode(.destinationOut)
                context.fill(CGRect(x: 0, y: y, width: textureWidth, height: 1))
                context.setBlendMode(.normal)
            }
        }
        
        guard let cgImage = context.makeImage() else { return nil }
        
        #if DEBUG
        print("Created soft gradient caustic texture: \(textureWidth)x\(textureHeight)")
        #endif
        
        return SKTexture(cgImage: cgImage)
    }
    
    // Cache Calendar for performance (avoid repeated allocations)
    private let calendar = Calendar.current
    
    func updateTimeCycle(dt: CGFloat) {
        let timeSpeed = GameData.shared.timeSpeed
        
        if timeSpeed == 1.0 {
            // Real Time mode: Use device time to determine time of day
            // Map 24-hour clock to 0.0-1.0 cycle
            // Midnight = 0.9 (middle of night), Noon = 0.4 (middle of day)
            let now = Date()
            let hour = CGFloat(calendar.component(.hour, from: now))
            let minute = CGFloat(calendar.component(.minute, from: now))
            let second = CGFloat(calendar.component(.second, from: now))
            
            // Convert to fraction of day (0.0 = midnight, 0.5 = noon, 1.0 = midnight)
            let dayFraction = (hour + minute / 60.0 + second / 3600.0) / 24.0
            
            // Remap so that:
            // 6am (0.25 of day) = dawn start (0.0 in cycle)
            // 12pm (0.5 of day) = midday (0.4 in cycle)
            // 6pm (0.75 of day) = dusk (0.6 in cycle)
            // 12am (0.0 of day) = midnight (0.9 in cycle)
            // Shift by 6 hours (0.25) so 6am = cycle start
            var adjustedFraction = dayFraction - 0.25
            if adjustedFraction < 0 { adjustedFraction += 1.0 }
            timeCycle = adjustedFraction
        } else if timeSpeed == 0.0 {
            // Stopped: don't update timeCycle
        } else {
            // Normal/Fast: Use cycleDuration-based progression
            let cycleDuration = GameData.shared.cycleDuration
            if cycleDuration.isFinite {
                timeCycle += dt / cycleDuration
                if timeCycle > 1.0 { timeCycle -= 1.0 }
            }
        }
        
        var phase: TimeColors
        var nextPhase: TimeColors
        var t: CGFloat = 0
        var nightFade: CGFloat = 0
        
        // Cycle Logic (Matches JS)
        if timeCycle < 0.25 { // Dawn -> Day
            phase = CycleConfig.dawn
            nextPhase = CycleConfig.day
            t = timeCycle / 0.25
            isNight = false
        } else if timeCycle < 0.6 { // Day
            phase = CycleConfig.day
            nextPhase = CycleConfig.day
            t = 0
            isNight = false
        } else if timeCycle < 0.75 { // Day -> Dusk
            phase = CycleConfig.day
            nextPhase = CycleConfig.dusk
            t = (timeCycle - 0.6) / 0.15
            isNight = false
        } else if timeCycle < 0.85 { // Dusk -> Night
            phase = CycleConfig.dusk
            nextPhase = CycleConfig.night
            t = (timeCycle - 0.75) / 0.1
            isNight = t > 0.5
            nightFade = t
        } else if timeCycle < 0.9 { // Full Night
            phase = CycleConfig.night
            nextPhase = CycleConfig.night
            t = 0
            isNight = true
            nightFade = 1.0
        } else { // Night -> Dawn
            phase = CycleConfig.night
            nextPhase = CycleConfig.dawn
            t = (timeCycle - 0.9) / 0.1
            isNight = true
            nightFade = 1.0 - t
        }
        
        // Interpolate
        let top = SKColor.lerp(start: phase.top, end: nextPhase.top, t: t)
        let bottom = SKColor.lerp(start: phase.bottom, end: nextPhase.bottom, t: t)
        let caustic = SKColor.lerp(start: phase.caustic, end: nextPhase.caustic, t: t)
        
        // Update Back Gradient Shader & Night Alpha
        if let uTop = gradientShader?.uniformNamed("u_top_color"),
           let uBot = gradientShader?.uniformNamed("u_bottom_color"),
           let uNight = gradientShader?.uniformNamed("u_night_alpha") {
            uTop.vectorFloat4Value = top.toVector4()
            uBot.vectorFloat4Value = bottom.toVector4()
            uNight.floatValue = Float(nightFade)
        }
        
        // Update Front Overlay Shader (same colors, different intensity handled in shader)
        if let uTop = frontOverlayShader?.uniformNamed("u_top_color"),
           let uBot = frontOverlayShader?.uniformNamed("u_bottom_color"),
           let uNight = frontOverlayShader?.uniformNamed("u_night_alpha") {
            uTop.vectorFloat4Value = top.toVector4()
            uBot.vectorFloat4Value = bottom.toVector4()
            uNight.floatValue = Float(nightFade)
        }
        
        // Update Caustics Color & Alpha based on time of day
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        caustic.getRed(&r, green: &g, blue: &b, alpha: &a)
        
        // Alpha from CycleConfig controls intensity (dawn: 0.12, day: 0.15, dusk: 0.08, night: 0.01)
        // Reduced to ~20% of previous intensity
        let finalAlpha = min(a * 1.0, 0.1)
        let shouldHide = finalAlpha < 0.005
        
        // Update caustic sprites with time-appropriate color and alpha
        for wrapper in causticNodes {
            if let sprite = wrapper.children.first as? SKSpriteNode {
                // Tint the caustic with the time-of-day color
                sprite.color = SKColor(red: r, green: g, blue: b, alpha: 1.0)
                sprite.colorBlendFactor = 1.0
                sprite.alpha = finalAlpha
            }
            wrapper.isHidden = shouldHide
        }
    }
    
    class func newGameScene() -> GameScene {
        let scene = GameScene(size: CGSize(width: 1024, height: 768))
        scene.scaleMode = .aspectFill
        return scene
    }
    
    func spawnFish(speciesId: String = "basic") {
        guard let spec = SpeciesCatalog.shared.species(for: speciesId) else { return }
        // Use cached visible bounds to spawn within screen
        let bounds = cachedVisibleBounds.isEmpty ? CGRect(origin: .zero, size: size) : cachedVisibleBounds
        let x = CGFloat.random(in: (bounds.minX + 100)...(bounds.maxX - 100))
        let y = CGFloat.random(in: (bounds.minY + 100)...(bounds.maxY - 100))
        let fish = FishNode(species: spec, position: CGPoint(x: x, y: y))
        fish.onReproduction = { [weak self] (parentSpecies, parentPos, parent1Name, parent2Name) in
            self?.spawnBaby(species: parentSpecies, position: parentPos, parent1Name: parent1Name, parent2Name: parent2Name)
        }
        addChild(fish)
        fish.addLabelsToScene()  // Add labels to scene (not fish) for efficiency
        fishNodes.append(fish)
    }
    
    func spawnBaby(species: Species, position: CGPoint, parent1Name: String? = nil, parent2Name: String? = nil) {
        // Hard cap at 200 fish for performance
        if fishNodes.count >= 200 { return }
        
        let baby = FishNode(species: species, position: position)
        baby.scaleFactor = 0.2 // Start very small (0.2x)
        // baby.setScale is handled by updateRotation in first update
        baby.position.x += CGFloat.random(in: -10...10)
        baby.position.y += CGFloat.random(in: -10...10)
        baby.onReproduction = { [weak self] (s, p, p1, p2) in
            self?.spawnBaby(species: s, position: p, parent1Name: p1, parent2Name: p2)
        }
        addChild(baby)
        baby.addLabelsToScene()  // Add labels to scene (not fish) for efficiency
        fishNodes.append(baby)
        
        // Log birth event to Spirit Memories
        if let p1 = parent1Name, let p2 = parent2Name {
            GameData.shared.addBirthEvent(
                parent1: p1,
                parent2: p2,
                babyNames: [baby.fishName],
                speciesName: species.name
            )
        }
    }
    
    // For FPS calculation
    private var frameCount = 0
    private var fpsUpdateTime: TimeInterval = 0
    
    // MARK: - Update Loop
    override func update(_ currentTime: TimeInterval) {
        if lastUpdateTime == 0 { lastUpdateTime = currentTime }
        let dt = currentTime - lastUpdateTime
        lastUpdateTime = currentTime
        
        // Update debug info (only count every second to avoid performance hit)
        frameCount += 1
        if currentTime - fpsUpdateTime >= 1.0 {
            if GameData.shared.showDebugInfo {
                // Simple node count estimate (direct children + fish parts estimate)
                let nodeEstimate = children.count + fishNodes.count * 10
                let fps = frameCount
                GameData.shared.currentFPS = fps
                GameData.shared.nodeCount = nodeEstimate
            }
            frameCount = 0
            fpsUpdateTime = currentTime
        }
        
        // Retry caustics setup if it failed initially (view wasn't ready)
        if causticsNeedSetup && view != nil {
            setupCausticsLayer()
        }
        
        updateTimeCycle(dt: CGFloat(dt))
        
        // Animate Caustics (use cached references, no name lookup)
        // Animate caustics - gentle horizontal sway within visible bounds
        causticsTime += CGFloat(dt) * 0.5
        for (i, causticNode) in causticNodes.enumerated() {
            let baseX = cachedVisibleBounds.minX + CGFloat(i) * (cachedVisibleBounds.width / 2) + 50
            let offset = sin(causticsTime + CGFloat(i) * 0.7) * 60.0
            causticNode.position.x = baseX + offset
        }
        
        // Calculate visible bounds early (needed for autofeed and fish updates)
        if let view = view {
            let topLeft = convertPoint(fromView: .zero)
            let bottomRight = convertPoint(fromView: CGPoint(x: view.bounds.width, y: view.bounds.height))
            cachedVisibleBounds = CGRect(x: topLeft.x, y: bottomRight.y, width: bottomRight.x - topLeft.x, height: topLeft.y - bottomRight.y)
        } else {
            cachedVisibleBounds = CGRect(origin: .zero, size: size)
        }
        
        // Start bubble animations once we have valid visible bounds
        if bubblesNeedStart && !cachedVisibleBounds.isEmpty && cachedVisibleBounds.width > 0 {
            bubblesNeedStart = false
            for bubble in bubbles {
                bubble.alpha = 0.15  // Make visible
                bubble.startAnimation(visibleBounds: cachedVisibleBounds, startFromRandom: true)
            }
        }
        
        if GameData.shared.isAutoFeed {
            // Auto-feed rate scales with population to keep fish alive
            // 
            // Math (with slower energy drain of 0.4/sec):
            // - Fish have 100 energy, drain 0.4/sec, so 250 seconds to starve
            // - Eating gives +20 energy
            // - Each fish needs ~1 food per 50 seconds to maintain energy
            // - But not all food is caught (some sinks off screen, competition)
            // - So we feed roughly 1 food per 25 seconds per fish
            //
            // Formula: 0.04 food/sec/fish (1 food per 25 sec)
            // Plus a base rate to ensure there's always some food available
            // Plus extra for hungry fish (below 40% energy)
            
            // Single pass to count alive and hungry fish
            var aliveCount = 0
            var hungryCount = 0
            for fish in fishNodes where !fish.isDead {
                aliveCount += 1
                if fish.energy < 40 { hungryCount += 1 }
            }
            
            // Base rate + per-fish rate + hungry bonus
            let baseRate = 0.05  // Gentle baseline
            let perFishRate = 0.04 * Double(aliveCount)  // ~1 food per 25 sec per fish
            let hungryBonus = 0.08 * Double(hungryCount)  // Extra for hungry fish
            
            let rate = baseRate + perFishRate + hungryBonus
            let interval = 1.0 / max(rate, 0.05)  // Minimum rate of 1 food per 20 sec
            
            if currentTime - lastAutoFeedTime > interval {
                // Drop 1-2 pieces of food at a time for variety
                let dropCount = (aliveCount > 15 || hungryCount > 5) ? 2 : 1
                // Drop food from middle 80% of visible screen width to avoid fish chasing to edges
                let visibleWidth = cachedVisibleBounds.width
                let visibleMinX = cachedVisibleBounds.minX
                let margin = visibleWidth * 0.1
                for _ in 0..<dropCount {
                    let x = CGFloat.random(in: (visibleMinX + margin)...(visibleMinX + visibleWidth - margin))
                    spawnFood(at: CGPoint(x: x, y: cachedVisibleBounds.maxY + 10), fromAutoFeed: true)
        }
                // Sound effects disabled - will add audio files later
                lastAutoFeedTime = currentTime
        }
    }
    
        // Environment updates no longer needed - bubbles and weeds use SKAction-based animation
        
        // Update and clean up food (use tracked array instead of enumerateChildNodes)
        var activeFood: [FoodNode] = []
        activeFood.reserveCapacity(trackedFoodNodes.count)  // Pre-allocate
        var removedFood: [FoodNode] = []  // Track removed food to clear targets later
        
        for food in trackedFoodNodes {
            if food.eaten || food.parent == nil {
                removedFood.append(food)
                food.removeFromParent()
            } else {
                food.update(height: self.size.height, currentTime: currentTime)
                activeFood.append(food)
            }
        }
        trackedFoodNodes = activeFood
        
        // Clear fish targets for removed food (only if any food was removed)
        if !removedFood.isEmpty {
            for fish in fishNodes {
                if let target = fish.currentFoodTarget, removedFood.contains(where: { $0 === target }) {
                    fish.currentFoodTarget = nil
        }
    }
        }
        
        // Update and clean up blood mist (use tracked array)
        bloodMistNodes.removeAll { mist in
            mist.update()
            return mist.parent == nil  // Remove from tracking if it removed itself
        }
        
        // Update fish
        let isTalkMode = GameData.shared.isTalkMode
        let currentTimestamp = isTalkMode ? Date().timeIntervalSince1970 : 0  // Only get timestamp if needed
        for fish in fishNodes {
            fish.update(deltaTime: dt, bounds: cachedVisibleBounds, otherFish: fishNodes, food: activeFood, isNight: isNight)
            if isTalkMode {
                fish.updateLabels(isTalkMode: true, currentTime: currentTimestamp)
                fish.updateSpeechTimer(deltaTime: dt)
            } else {
                // When talk mode is off, just hide labels (cheap operation)
                fish.hideLabels()
            }
        }
        
        // Clean up dead fish - ensure labels are removed before removing from array
        fishNodes.removeAll { fish in
            if fish.parent == nil {
                fish.removeLabels()  // Clean up any orphaned labels
                return true
            }
            return false
        }
        
        // Update alive fish counts for stats display (single pass)
        var aliveCount = 0
        var speciesCounts: [String: Int] = [:]
        for fish in fishNodes where !fish.isDead {
            aliveCount += 1
            speciesCounts[fish.species.id, default: 0] += 1
        }
        GameData.shared.currentAliveFish = aliveCount
        GameData.shared.aliveFishBySpecies = speciesCounts
        
        // Periodic deep cleanup (every ~5 seconds at 60fps)
        cleanupCounter += 1
        if cleanupCounter >= 300 {
            cleanupCounter = 0
            performDeepCleanup()
        }
    }
    
    /// Periodic cleanup to catch any orphaned nodes that slipped through
    private func performDeepCleanup() {
        // Build sets of known labels/bubbles for O(1) lookup instead of O(n) per child
        var knownLabels = Set<ObjectIdentifier>()
        var knownBubbles = Set<ObjectIdentifier>()
        
        for fish in fishNodes {
            // Info label (name + hunger, no shadow)
            if let label = fish.infoLabel { knownLabels.insert(ObjectIdentifier(label)) }
            // Speech UI (may be nil if fish never spoke)
            if let label = fish.speechLabel { knownLabels.insert(ObjectIdentifier(label)) }
            if let bubble = fish.speechBubble { knownBubbles.insert(ObjectIdentifier(bubble)) }
    }
    
        var nodesToRemove: [SKNode] = []
        for child in children {
            // Check for orphaned labels
            if let label = child as? SKLabelNode, label.name == nil {
                if !knownLabels.contains(ObjectIdentifier(label)) {
                    nodesToRemove.append(label)
                }
            }
            // Check for orphaned speech bubbles (SKShapeNode with no name, small size, hidden)
            else if let shape = child as? SKShapeNode, shape.name == nil {
                if !knownBubbles.contains(ObjectIdentifier(shape)) {
                    if shape.frame.width < 200 && shape.frame.height < 100 && shape.alpha == 0 {
                        nodesToRemove.append(shape)
                    }
                }
            }
        }
        
        for node in nodesToRemove {
            node.removeFromParent()
        }
        
        #if DEBUG
        if !nodesToRemove.isEmpty {
            print("Deep cleanup removed \(nodesToRemove.count) orphaned nodes")
        }
        #endif
    }
    
    override func didChangeSize(_ oldSize: CGSize) {
        // Full rebuild safer on resize for CropNodes
        setupBackground()
    }
    
    func spawnFood(at position: CGPoint, fromAutoFeed: Bool = false) {
        // Limit max food nodes to prevent buildup
        guard trackedFoodNodes.count < maxFoodNodes else { return }
        
        // Match JS: new Food(x, y) - spawns at position
        let food = FoodNode(position: position)
        addChild(food)
        trackedFoodNodes.append(food)
        
        // Haptic feedback only for manual food drops (not autofeed)
        if !fromAutoFeed {
            HapticManager.shared.foodDropped()
        }
    }
    
    func spawnBloodMist(at position: CGPoint) {
        let mist = BloodMistNode(position: position)
        addChild(mist)
        bloodMistNodes.append(mist)
        }
    
    }
    
#if os(iOS) || os(tvOS)
extension GameScene {
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        for t in touches {
            let loc = t.location(in: self)
            if GameData.shared.isTalkMode {
                // Check if we tapped on a fish
                for fish in fishNodes {
                    if fish.contains(loc) && !fish.isDead {
                        fish.speak()
                        return
        }
    }
            } else {
                spawnFood(at: loc)
        }
    }
    }
}
#endif

#if os(OSX)
import AppKit
extension GameScene {
    override func mouseDown(with event: NSEvent) {
        let loc = event.location(in: self)
        spawnFood(at: loc)
    }
}
#endif

extension SKColor {
    func toVector4() -> vector_float4 {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        self.getRed(&r, green: &g, blue: &b, alpha: &a)
        return vector_float4(Float(r), Float(g), Float(b), Float(a))
    }
}
