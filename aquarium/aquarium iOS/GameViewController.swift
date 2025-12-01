import UIKit
import SpriteKit
import GameplayKit
import SwiftUI

class GameViewController: UIViewController {
    
    private var loadingView: UIView?
    private var skView: SKView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Setup SKView immediately
        skView = self.view as? SKView
        skView.ignoresSiblingOrder = true
        skView.showsFPS = false
        skView.showsNodeCount = false
        skView.preferredFramesPerSecond = 120
        
        // Show loading screen
        showLoadingScreen()
        
        // Load game asynchronously
        Task {
            await loadGame()
        }
    }
    
    private func showLoadingScreen() {
        let loading = UIView(frame: view.bounds)
        loading.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        loading.backgroundColor = UIColor(red: 0.05, green: 0.1, blue: 0.2, alpha: 1.0)
        
        // Background image with blur
        if let bgImage = UIImage(named: "Background1") {
            let imageView = UIImageView(image: bgImage)
            imageView.frame = loading.bounds
            imageView.contentMode = .scaleAspectFill
            imageView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            loading.addSubview(imageView)
            
            let blurEffect = UIBlurEffect(style: .dark)
            let blurView = UIVisualEffectView(effect: blurEffect)
            blurView.frame = loading.bounds
            blurView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            loading.addSubview(blurView)
        }
        
        // Title label
        let titleLabel = UILabel()
        titleLabel.text = "Spirit Aquarium"
        titleLabel.font = UIFont.systemFont(ofSize: 32, weight: .bold)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        loading.addSubview(titleLabel)
        
        // Loading indicator
        let spinner = UIActivityIndicatorView(style: .medium)
        spinner.color = UIColor.white.withAlphaComponent(0.7)
        spinner.startAnimating()
        spinner.translatesAutoresizingMaskIntoConstraints = false
        loading.addSubview(spinner)
        
        // Loading text
        let loadingLabel = UILabel()
        loadingLabel.text = "Loading..."
        loadingLabel.font = UIFont.systemFont(ofSize: 14, weight: .regular)
        loadingLabel.textColor = UIColor.white.withAlphaComponent(0.6)
        loadingLabel.textAlignment = .center
        loadingLabel.translatesAutoresizingMaskIntoConstraints = false
        loading.addSubview(loadingLabel)
        
        NSLayoutConstraint.activate([
            titleLabel.centerXAnchor.constraint(equalTo: loading.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: loading.centerYAnchor, constant: -20),
            
            spinner.centerXAnchor.constraint(equalTo: loading.centerXAnchor),
            spinner.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 24),
            
            loadingLabel.centerXAnchor.constraint(equalTo: loading.centerXAnchor),
            loadingLabel.topAnchor.constraint(equalTo: spinner.bottomAnchor, constant: 12)
        ])
        
        view.addSubview(loading)
        self.loadingView = loading
    }
    
    private func loadGame() async {
        // Allow the loading screen to render first
        try? await Task.sleep(nanoseconds: 50_000_000)  // 50ms
        
        // Initialize StoreManager (don't wait for it)
        Task {
            await StoreManager.shared.checkExistingPurchases()
        }
        
        // Warm up haptic engine to prevent delay on first haptic
        HapticManager.shared.warmUp()
        
        // Pre-generate textures on main thread (UIGraphicsImageRenderer requires main thread)
        FoodNode.generateSharedTexture()
        BubbleNode.generateSharedTextures()
        
        // Small yield to keep UI responsive
        try? await Task.sleep(nanoseconds: 10_000_000)  // 10ms
        
        // Create and present scene
        let scene = GameScene.newGameScene()
        
        // Present scene with fade transition
        let transition = SKTransition.fade(withDuration: 0.4)
        skView.presentScene(scene, transition: transition)
        
        // Setup SwiftUI Overlay
        var overlayView = GameOverlayView()
        overlayView.onPurchase = { [weak scene] speciesId in
            scene?.spawnFish(speciesId: speciesId)
        }
        
        let hostingController = UIHostingController(rootView: overlayView)
        hostingController.view.backgroundColor = .clear
        
        addChild(hostingController)
        view.addSubview(hostingController.view)
        
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: view.topAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        
        hostingController.didMove(toParent: self)
        
        // Fade out loading screen
        UIView.animate(withDuration: 0.3, delay: 0.1, options: .curveEaseOut) {
            self.loadingView?.alpha = 0
        } completion: { _ in
            self.loadingView?.removeFromSuperview()
            self.loadingView = nil
        }
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
