import UIKit
import SpriteKit
import GameplayKit
import SwiftUI

class GameViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        
        // 0. Initialize StoreManager early to check for existing IAP purchases
        Task {
            await StoreManager.shared.checkExistingPurchases()
        }
        
        // 1. Load SpriteKit Scene
        let scene = GameScene.newGameScene()
        
        let skView = self.view as! SKView
        skView.presentScene(scene)
        
        skView.ignoresSiblingOrder = true
        skView.showsFPS = false
        skView.showsNodeCount = false
        skView.preferredFramesPerSecond = 120 // Unlock 120fps on ProMotion devices
        
        // 2. Setup SwiftUI Overlay
        // We pass a closure to handle purchases that calls back into the GameScene
        var overlayView = GameOverlayView()
        overlayView.onPurchase = { [weak scene] speciesId in
            scene?.spawnFish(speciesId: speciesId)
        }
        
        let hostingController = UIHostingController(rootView: overlayView)
        hostingController.view.backgroundColor = .clear // Transparent background
        
        // 3. Add as Child View Controller
        addChild(hostingController)
        view.addSubview(hostingController.view)
        
        // Layout Constraints (Fill Screen)
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: view.topAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        
        hostingController.didMove(toParent: self)
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        if UIDevice.current.userInterfaceIdiom == .phone {
            return .allButUpsideDown
        } else {
            return .all
        }
    }

    override var prefersStatusBarHidden: Bool {
        return true
    }
}
