//
//  SceneDelegate.swift
//  aquarium iOS
//
//  Created by Max Mockett on 23/11/2025.
//

import UIKit
import SpriteKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        
        // Create window with the scene
        window = UIWindow(windowScene: windowScene)
        
        // Load the GameViewController from storyboard
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        if let viewController = storyboard.instantiateInitialViewController() {
            window?.rootViewController = viewController
            window?.makeKeyAndVisible()
        }
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        // Called when the scene is being released by the system.
        // Save game state when disconnecting
        saveGameState()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        // Called when the scene has moved from an inactive state to an active state.
        // Reset update time to prevent "catch-up" animation
        if let gameScene = findGameScene() {
            gameScene.resetUpdateTime()
        }
    }

    func sceneWillResignActive(_ scene: UIScene) {
        // Called when the scene will move from an active state to an inactive state.
        // Save game state when going inactive
        saveGameState()
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        // Called as the scene transitions from the background to the foreground.
        // Reset update time to prevent "catch-up" animation
        if let gameScene = findGameScene() {
            gameScene.resetUpdateTime()
        }
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        // Called as the scene transitions from the foreground to the background.
        // Save game state when entering background
        saveGameState()
    }
    
    /// Save fish states and then persist to UserDefaults
    private func saveGameState() {
        if let gameScene = findGameScene() {
            gameScene.saveFishStates()
        }
        GameData.shared.saveState()
    }
    
    /// Helper to find the GameScene from the view hierarchy
    private func findGameScene() -> GameScene? {
        guard let rootVC = window?.rootViewController else { return nil }
        
        // Try to find SKView in the view hierarchy
        func findSKView(in view: UIView) -> SKView? {
            if let skView = view as? SKView {
                return skView
            }
            for subview in view.subviews {
                if let found = findSKView(in: subview) {
                    return found
                }
            }
            return nil
        }
        
        if let skView = findSKView(in: rootVC.view),
           let gameScene = skView.scene as? GameScene {
            return gameScene
        }
        return nil
    }
}

