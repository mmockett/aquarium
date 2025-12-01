# Spirit Aquarium — iOS App

A native iOS virtual aquarium built with SpriteKit and SwiftUI.

## Overview

Spirit Aquarium is a relaxing, interactive aquarium simulation where you nurture and grow a collection of beautiful fish spirits. Watch them swim, feed, breed, and thrive in a peaceful underwater world.

## Features

### 🐟 Fish Simulation
- **Realistic Behaviors** — Fish school together, flee from predators, seek food, and breed
- **Growth System** — Baby fish eat frequently and gradually grow to adulthood
- **Species Variety** — 9 unique species with distinct appearances, sizes, and behaviors
- **Predator/Prey Dynamics** — Rainbow Spirit hunts smaller fish while also eating regular food

### 🌊 Environment
- **Day/Night Cycle** — Dynamic lighting that transitions through dawn, day, dusk, and night
- **Caustic Lighting** — Shimmering light beams like real underwater scenes
- **Animated Bubbles** — Continuous stream of bubbles rising from the depths
- **Swaying Seaweed** — Gentle plant animations at the bottom

### 🎮 Gameplay
- **Tap to Feed** — Drop food anywhere; fish dart toward it
- **Auto-Feed Mode** — Automatic feeding when you're away
- **Talk Mode** — See fish names, hunger levels, and age
- **Spirit Memories** — Chronicle of births and deaths in your aquarium

### 💎 Monetization
- **In-App Purchase** — Rainbow Spirit (premium predator fish)
- **Restore Purchases** — Sync purchases across devices

## Technical Details

### Requirements
- iOS 15.0+
- iPhone or iPad

### Frameworks Used
- **SpriteKit** — Game rendering and physics
- **SwiftUI** — UI overlay with liquid glass effects
- **StoreKit 2** — In-app purchases
- **CoreHaptics** — Tactile feedback

### Architecture
- `FishNode.swift` — Fish entity with AI behaviors (flocking, hunting, fleeing)
- `GameScene.swift` — Main SpriteKit scene managing all entities
- `GameData.swift` — Observable state and UserDefaults persistence
- `GameOverlayView.swift` — SwiftUI HUD, shop, settings, and memories
- `SpeciesCatalog.swift` — Fish species definitions
- `StoreManager.swift` — StoreKit 2 purchase handling

### Performance Optimizations
- Shared textures for bubbles and food particles
- Spatial hashing for efficient neighbor lookups
- SKAction-based animations (no per-frame updates for environment)
- Fixed z-ordering to prevent fish part interleaving
- Pre-rendered caustic textures

## Building

1. Open `aquarium.xcodeproj` in Xcode
2. Select the "aquarium iOS" scheme
3. Choose your target device or simulator
4. Build and run (⌘R)

### In-App Purchase Testing
- Use the included `Products.storekit` configuration for local testing
- Set StoreKit Configuration to "Products" in scheme settings (for Simulator)
- Set to "None" when testing on physical devices with sandbox accounts

## Product IDs

| Product | ID | Type |
|---------|-----|------|
| Rainbow Spirit | `com.aquarium.rainbow_spirit` | Non-Consumable |

## Privacy

This app collects no personal data. All game state is stored locally via UserDefaults. See [Privacy Policy](../privacy-policy.html).

## Contact

mmockett@gmail.com
