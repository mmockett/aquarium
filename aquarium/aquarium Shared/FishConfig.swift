import Foundation
import SpriteKit

// MARK: - Fish Part Configuration
struct FishPartConfig: Codable {
    var x: CGFloat = 0
    var y: CGFloat = 0
    var pivotX: CGFloat = 0
    var pivotY: CGFloat = 0
    var scale: CGFloat = 1.0
    var zIndex: Int = 0
    var flipY: Bool = false
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        x = try container.decodeIfPresent(CGFloat.self, forKey: .x) ?? 0
        y = try container.decodeIfPresent(CGFloat.self, forKey: .y) ?? 0
        pivotX = try container.decodeIfPresent(CGFloat.self, forKey: .pivotX) ?? 0
        pivotY = try container.decodeIfPresent(CGFloat.self, forKey: .pivotY) ?? 0
        scale = try container.decodeIfPresent(CGFloat.self, forKey: .scale) ?? 1.0
        zIndex = try container.decodeIfPresent(Int.self, forKey: .zIndex) ?? 0
        flipY = try container.decodeIfPresent(Bool.self, forKey: .flipY) ?? false
    }
    
    init() {}
}

// MARK: - Fish Species Configuration
struct FishConfig: Codable {
    var body: FishPartConfig = FishPartConfig()
    var tail: FishPartConfig = FishPartConfig()
    var dorsalFin: FishPartConfig = FishPartConfig()
    var pectoralFin1: FishPartConfig = FishPartConfig()
    var pectoralFin2: FishPartConfig = FishPartConfig()
    var pelvicFin1: FishPartConfig = FishPartConfig()
    var pelvicFin2: FishPartConfig = FishPartConfig()
}

// MARK: - Vector Helper (SIMD-accelerated)
// Using SIMD2<Float> for hardware-accelerated vector math
import simd

struct Vector {
    // Internal SIMD storage for hardware acceleration
    var simd: SIMD2<Float>
    
    // CGFloat accessors for compatibility
    var x: CGFloat {
        get { CGFloat(simd.x) }
        set { simd.x = Float(newValue) }
    }
    
    var y: CGFloat {
        get { CGFloat(simd.y) }
        set { simd.y = Float(newValue) }
    }
    
    init(x: CGFloat, y: CGFloat) {
        self.simd = SIMD2<Float>(Float(x), Float(y))
    }
    
    init(_ point: CGPoint) {
        self.simd = SIMD2<Float>(Float(point.x), Float(point.y))
    }
    
    init(simd: SIMD2<Float>) {
        self.simd = simd
    }
    
    // SIMD-accelerated operations
    static func + (left: Vector, right: Vector) -> Vector {
        return Vector(simd: left.simd + right.simd)
    }
    
    static func - (left: Vector, right: Vector) -> Vector {
        return Vector(simd: left.simd - right.simd)
    }
    
    static func * (left: Vector, scalar: CGFloat) -> Vector {
        return Vector(simd: left.simd * Float(scalar))
    }
    
    @inline(__always)
    func magnitude() -> CGFloat {
        return CGFloat(simd_length(simd))
    }
    
    @inline(__always)
    func magnitudeSquared() -> CGFloat {
        return CGFloat(simd_length_squared(simd))
    }
    
    func normalized() -> Vector {
        let len = simd_length(simd)
        guard len > 0 else { return Vector(x: 0, y: 0) }
        return Vector(simd: simd / len)
    }
    
    mutating func normalize() {
        let len = simd_length(simd)
        if len > 0 {
            simd /= len
        }
    }
    
    mutating func limit(_ max: CGFloat) {
        let lenSq = simd_length_squared(simd)
        let maxF = Float(max)
        if lenSq > maxF * maxF {
            simd = simd_normalize(simd) * maxF
        }
    }
    
    func toCGPoint() -> CGPoint {
        return CGPoint(x: CGFloat(simd.x), y: CGFloat(simd.y))
    }
    
    // Additional SIMD-accelerated helpers
    @inline(__always)
    func dot(_ other: Vector) -> CGFloat {
        return CGFloat(simd_dot(simd, other.simd))
    }
    
    @inline(__always)
    static func distance(_ a: Vector, _ b: Vector) -> CGFloat {
        return CGFloat(simd_distance(a.simd, b.simd))
    }
    
    @inline(__always)
    static func distanceSquared(_ a: Vector, _ b: Vector) -> CGFloat {
        return CGFloat(simd_distance_squared(a.simd, b.simd))
    }
}

// MARK: - Color Helper
extension SKColor {
    static func lerp(start: SKColor, end: SKColor, t: CGFloat) -> SKColor {
        // Get RGBA components
        var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0
        var r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0
        
        start.getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        end.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        
        let r = r1 + (r2 - r1) * t
        let g = g1 + (g2 - g1) * t
        let b = b1 + (b2 - b1) * t
        let a = a1 + (a2 - a1) * t
        
        return SKColor(red: r, green: g, blue: b, alpha: a)
    }
}
