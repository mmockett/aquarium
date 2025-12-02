# 🐠 Spirit Aquarium

A beautiful, relaxing virtual aquarium experience available on iOS and Web.

## ✨ Features

- **Peaceful Gameplay** — Watch your fish swim, eat, grow, and thrive in a serene underwater environment
- **Diverse Species** — Collect and nurture various fish species, each with unique appearances and behaviors
- **Dynamic Ecosystem** — Fish interact naturally: schooling, breeding, hunting, and avoiding predators
- **Day/Night Cycle** — Experience beautiful lighting transitions as time passes
- **Spirit Memories** — Chronicle the lives of your fish with birth and memorial events
- **Customizable Backgrounds** — Choose from multiple underwater scenes
- **Relaxing Animations** — Gentle bubbles, swaying weeds, and shimmering caustic light effects

## 🎮 Platforms

### iOS App (Native)
Built with SpriteKit and SwiftUI for optimal performance on iPhone and iPad.

- **Requirements:** iOS 15.0+
- **Features:** Haptic feedback, liquid glass UI effects, StoreKit 2 in-app purchases

[View iOS Documentation](aquarium/README_IOS.md)

### Web Version
A JavaScript/Canvas implementation that runs in any modern browser.

- **Requirements:** Modern browser with Canvas support
- **Features:** Responsive design, localStorage persistence, glassmorphism UI

[Play Web Version](index.html)

## 🐟 Fish Species

| Species | Type | Description |
|---------|------|-------------|
| Basic Spirit | Prey | A gentle, common fish perfect for beginners |
| Golden Shimmer | Prey | Graceful fish with a golden glow |
| Azure Drift | Prey | Calm blue fish that loves to school |
| Crimson Fin | Prey | Bold red fish with elegant fins |
| Emerald Glider | Prey | Swift green fish, hard to catch |
| Violet Whisper | Prey | Mysterious purple fish |
| Sunset Dancer | Prey | Orange fish with flowing movements |
| Silver Stream | Prey | Quick, silvery schooling fish |
| Rainbow Spirit | Predator | ✨ Premium — Majestic predator with rainbow scales |

## 🎯 Gameplay

1. **Feed Your Fish** — Tap to drop food; fish will swim to eat it
2. **Watch Them Grow** — Baby fish eat more frequently and grow over time
3. **Earn Points** — Gain currency as your fish thrive
4. **Expand Your Collection** — Purchase new species from the shop
5. **Enable Auto-Feed** — Let the aquarium sustain itself automatically

## 🔧 Development

### iOS Build

```bash
cd aquarium
open aquarium.xcodeproj
# Build and run in Xcode
```

### Web Version

```bash
# Simply open index.html in a browser
# Or serve with any static file server
python -m http.server 8000
```

## 📁 Project Structure

```
aquarium/
├── aquarium/                    # iOS Xcode project
│   ├── aquarium Shared/         # Shared game logic (SpriteKit)
│   │   ├── FishNode.swift       # Fish behavior and rendering
│   │   ├── GameScene.swift      # Main game scene
│   │   ├── GameData.swift       # Persistence and state
│   │   ├── SpeciesCatalog.swift # Fish species definitions
│   │   └── ...
│   └── aquarium iOS/            # iOS-specific code
├── js/                          # Web version JavaScript
│   ├── main.js                  # Game loop and initialization
│   ├── classes/Fish.js          # Fish class
│   ├── config.js                # Species and settings
│   └── ui.js                    # UI management
├── css/                         # Web version styles
├── assets/                      # Shared assets
├── index.html                   # Web entry point
└── privacy-policy.html          # Privacy policy for App Store
```

## 📜 Privacy

Spirit Aquarium collects **no personal data**. All game progress is stored locally on your device. See our [Privacy Policy](privacy-policy.html) for details.

## 📄 License

© 2025 Max Mockett. All rights reserved.

## 📧 Contact

For questions or support: mmockett@gmail.com

