import SwiftUI
import UIKit
import StoreKit

// MARK: - iOS 26 Native Liquid Glass UI
// Uses the native .glassEffect() modifier from iOS 26 SDK
// Uses native SwiftUI sheets with presentationDetents for drawer behavior

struct GameOverlayView: View {
    @StateObject var gameData = GameData.shared
    var onPurchase: ((String) -> Void)?
    
    // Toast message state
    @State private var toastMessage: String = ""
    @State private var toastIcon: String = ""
    @State private var toastColor: Color = .white
    @State private var showToast: Bool = false
    
    var body: some View {
        ZStack {
            // Toast Message Layer (at top of screen)
            VStack {
                if showToast {
                    ToastView(message: toastMessage, icon: toastIcon, color: toastColor)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .padding(.top, 60)
                }
                Spacer()
            }
            .zIndex(100)
            
            // Debug Info Layer (top left)
            if gameData.showDebugInfo {
                VStack {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("FPS: \(gameData.currentFPS)")
                                .font(.system(size: 12, weight: .medium, design: .monospaced))
                            Text("Nodes: \(gameData.nodeCount)")
                                .font(.system(size: 12, weight: .medium, design: .monospaced))
                        }
                        .foregroundColor(.white)
                        .padding(8)
                        .background(Color.black.opacity(0.6))
                        .cornerRadius(8)
                        .padding(.leading, 20)
                        .padding(.top, 60)
                        
                        Spacer()
                    }
                    Spacer()
                }
            }
            
            // Main UI Layer
            ZStack(alignment: .bottom) {
                
                // 1. Main HUD Layer
                if gameData.uiVisible {
                    VStack(spacing: 0) {
                        Spacer()
                        
                        // Bottom Control Bar
                        HStack(alignment: .center, spacing: 12) {
                            // Score Pill (tappable to open settings)
                            Button(action: {
                                HapticManager.shared.buttonTap()
                                gameData.showSettings = true
                            }) {
                                HStack(spacing: 6) {
                                    Circle()
                                        .fill(LinearGradient(colors: [.cyan, .white], startPoint: .topLeading, endPoint: .bottomTrailing))
                                        .frame(width: 18, height: 18)
                                    
                                    Text("\(formatScore(gameData.score))")
                                        .font(.system(size: 18, weight: .bold, design: .rounded))
                                        .foregroundColor(.primary)
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .glassEffect(.regular, in: Capsule())
                            }
                            .buttonStyle(.plain)
                            
                            Spacer()
                            
                            // Right Controls
                            HStack(spacing: 10) {
                                GlassButton(icon: "leaf.fill", activeColor: .green, isActive: gameData.isAutoFeed) {
                                    gameData.isAutoFeed.toggle()
                                    showToastMessage(
                                        message: gameData.isAutoFeed ? "Autofeed On – Fish will be fed automatically" : "Autofeed Off – Tap to drop food",
                                        icon: "leaf.fill",
                                        color: .green
                                    )
                                }
                                GlassButton(icon: "sparkles", activeColor: .yellow, isActive: gameData.isTalkMode) {
                                    gameData.isTalkMode.toggle()
                                    showToastMessage(
                                        message: gameData.isTalkMode ? "Spirit Mode On – Tap fish to hear them speak" : "Spirit Mode Off – Tap to drop food",
                                        icon: "sparkles",
                                        color: .yellow
                                    )
                                }
                                GlassButton(icon: "heart.fill", activeColor: .pink, isActive: false, badgeCount: gameData.unreadMemoriesCount) {
                                    gameData.showMemories = true
                                }
                                GlassButton(icon: "cart.fill", activeColor: .blue, isActive: false) {
                                    gameData.showShop = true
                                }
                            }
                            .padding(6)
                            .glassEffect(.regular, in: Capsule())
                        }
                        .padding(.horizontal, 20)
                        .padding(.bottom, 10)
                        .padding(.bottom, 30) // Manual safe area padding
                    }
                }
            }
        }
        .ignoresSafeArea()
        // Native sheet for Shop (simple opaque background for performance)
        .sheet(isPresented: $gameData.showShop) {
            ShopSheetContent(gameData: gameData, onPurchase: onPurchase)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        // Native sheet for Spirit Memories (simple opaque background for performance)
        .sheet(isPresented: $gameData.showMemories) {
            SpiritMemoriesSheetContent(gameData: gameData)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        // Native sheet for Settings
        .sheet(isPresented: $gameData.showSettings) {
            SettingsSheetContent(gameData: gameData)
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
    }
    
    func formatScore(_ score: Int) -> String {
        if score >= 1000 {
            return String(format: "%.1fk", Double(score)/1000.0)
        }
        return "\(score)"
    }
    
    private func showToastMessage(message: String, icon: String, color: Color) {
        toastMessage = message
        toastIcon = icon
        toastColor = color
        
        withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
            showToast = true
        }
        
        // Auto-dismiss after 2.5 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            withAnimation(.easeOut(duration: 0.3)) {
                showToast = false
            }
        }
    }
}

// MARK: - Toast View

struct ToastView: View {
    let message: String
    let icon: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(color)
            
            Text(message)
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundColor(.primary)
                .multilineTextAlignment(.leading)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            Capsule()
                .fill(Color(.systemBackground).opacity(0.95))
                .shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 4)
        )
    }
}

// MARK: - Settings Sheet Content

struct SettingsSheetContent: View {
    @ObservedObject var gameData: GameData
    @State private var showRestartConfirmation = false
    
    let backgrounds = [
        (id: 1, name: "Ocean Depths"),
        (id: 2, name: "Coral Reef"),
        (id: 3, name: "Twilight Waters"),
        (id: 4, name: "Mystic Lagoon")
    ]
    
    var body: some View {
        NavigationStack {
            List {
                // Background Selection
                Section {
                    ForEach(backgrounds, id: \.id) { bg in
                        Button(action: {
                            HapticManager.shared.selectionChanged()
                            gameData.selectedBackground = bg.id
                            gameData.onBackgroundChanged?()
                        }) {
                            HStack {
                                Image("Background\(bg.id)")
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 60, height: 40)
                                    .cornerRadius(8)
                                    .clipped()
                                
                                Text(bg.name)
                                    .font(.system(size: 15, design: .rounded))
                                    .foregroundColor(.primary)
                                
                                Spacer()
                                
                                if gameData.selectedBackground == bg.id {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.blue)
                                }
                            }
                            .contentShape(Rectangle())  // Make entire row tappable
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text("Background")
                }
                
                // Time Speed
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "clock.fill")
                                .foregroundColor(.purple)
                            Text("Day/Night Cycle Speed")
                            Spacer()
                            Text(gameData.timeSpeedLabel)
                                .font(.system(size: 14, design: .rounded))
                                .foregroundColor(.secondary)
                        }
                        
                        Slider(
                            value: Binding(
                                get: { gameData.timeSpeed },
                                set: { newValue in
                                    let rounded = newValue.rounded()
                                    // Only trigger haptic when value actually changes to a new step
                                    if rounded != gameData.timeSpeed {
                                        HapticManager.shared.selectionChanged()
                                        gameData.timeSpeed = rounded
                                    }
                                }
                            ),
                            in: 0...3,
                            step: 1
                        )
                        
                        HStack {
                            Text("Stopped")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                            Spacer()
                            Text("Fast")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                        }
                    }
                } header: {
                    Text("Time")
                } footer: {
                    Text("Controls how fast the day/night cycle progresses. Normal is a 5-minute cycle, Real Time syncs with a 24-hour day.")
                }
                
                // Debug Toggle
                Section {
                    Toggle(isOn: Binding(
                        get: { gameData.showDebugInfo },
                        set: { newValue in
                            HapticManager.shared.toggleChanged()
                            gameData.showDebugInfo = newValue
                        }
                    )) {
                        HStack {
                            Image(systemName: "ant.fill")
                                .foregroundColor(.orange)
                            Text("Show Debug Info")
                        }
                    }
                } header: {
                    Text("Developer")
                } footer: {
                    Text("Shows FPS and node count in the top left corner")
                }
                
                // Restart Game
                Section {
                    Button(action: {
                        HapticManager.shared.buttonTap()
                        showRestartConfirmation = true
                    }) {
                        HStack {
                            Image(systemName: "arrow.counterclockwise")
                                .foregroundColor(.red)
                            Text("Restart Game")
                                .foregroundColor(.red)
                        }
                    }
                } footer: {
                    Text("Removes all fish and resets your progress. This cannot be undone.")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .alert("Restart Game?", isPresented: $showRestartConfirmation) {
                Button("Cancel", role: .cancel) { }
                Button("Restart", role: .destructive) {
                    gameData.restartGame()
                    gameData.showSettings = false
                }
            } message: {
                Text("This will remove all fish and reset your progress. Are you sure?")
            }
        }
    }
}

// MARK: - Shop Sheet Content

struct ShopSheetContent: View {
    @ObservedObject var gameData: GameData
    @StateObject private var storeManager = StoreManager.shared
    var onPurchase: ((String) -> Void)?
    
    @State private var isRestoring = false
    @State private var restoreMessage: String?
    @State private var showRestoreAlert = false
    
    var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(spacing: 12) {
                    ForEach(gameData.shopItems) { item in
                        if item.isIAP {
                            // IAP item - special handling
                            IAPShopItemRow(
                                item: item,
                                isPurchased: gameData.isSpeciesUnlocked(item.id),
                                aliveCount: gameData.aliveFishBySpecies[item.id] ?? 0,
                                storeManager: storeManager
                            ) {
                                // After successful IAP, spawn the fish
                                onPurchase?(item.id)
                            }
                        } else {
                            // Regular in-game currency item
                            ShopItemRow(
                                item: item,
                                canAfford: gameData.score >= item.cost,
                                aliveCount: gameData.aliveFishBySpecies[item.id] ?? 0,
                                isNewUnlock: !gameData.isSpeciesUnlocked(item.id)
                            ) {
                                if gameData.purchase(cost: item.cost, speciesId: item.id) {
                                    onPurchase?(item.id)
                                }
                            }
                        }
                    }
                    
                    // Show unlock hint if there are locked species that aren't yet affordable
                    if gameData.hasLockedSpecies {
                        UnlockHintView(nextSpecies: gameData.nextLockedSpecies, currentScore: gameData.score)
                    }
                    
                    // Restore purchases button
                    Button(action: {
                        isRestoring = true
                        Task {
                            let (success, restoredCount) = await storeManager.restorePurchases()
                            isRestoring = false
                            
                            if success {
                                if restoredCount > 0 {
                                    restoreMessage = "Restored \(restoredCount) purchase\(restoredCount == 1 ? "" : "s")!"
                                    HapticManager.shared.success()
                                } else if gameData.iapPurchasedSpecies.isEmpty {
                                    restoreMessage = "No previous purchases found."
                                } else {
                                    restoreMessage = "All purchases already restored."
                                }
                            } else {
                                restoreMessage = "Failed to restore purchases. Please try again."
                                HapticManager.shared.error()
                            }
                            showRestoreAlert = true
                        }
                    }) {
                        HStack(spacing: 8) {
                            if isRestoring {
                                ProgressView()
                                    .scaleEffect(0.8)
                            }
                            Text(isRestoring ? "Restoring..." : "Restore Purchases")
                                .font(.system(size: 14, design: .rounded))
                                .foregroundColor(.blue)
                        }
                    }
                    .disabled(isRestoring)
                    .padding(.top, 10)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .padding(.bottom, 20)
            }
            .scrollContentBackground(.hidden)
            .background(.clear)
            .navigationTitle("Shop")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .alert("Restore Purchases", isPresented: $showRestoreAlert) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(restoreMessage ?? "")
            }
        }
    }
}

// MARK: - Unlock Hint View

struct UnlockHintView: View {
    let nextSpecies: Species?
    let currentScore: Int
    
    var body: some View {
        VStack(spacing: 12) {
            Divider()
                .padding(.vertical, 8)
            
            HStack(spacing: 8) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 14))
                    .foregroundColor(.secondary)
                
                Text("More Species Locked")
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundColor(.secondary)
            }
            
            Text("Earn spirit orbs by feeding fish and keeping them alive to unlock new species.")
                .font(.system(size: 12, design: .rounded))
                .foregroundColor(.secondary.opacity(0.8))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 20)
            
            if let next = nextSpecies {
                HStack(spacing: 6) {
                    Text("Next unlock:")
                        .font(.system(size: 11, design: .rounded))
                        .foregroundColor(.secondary.opacity(0.7))
                    
                    Text(next.name)
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(.primary.opacity(0.8))
                    
                    Text("•")
                        .foregroundColor(.secondary.opacity(0.5))
                    
                    Text("\(next.cost) orbs")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundColor(currentScore >= next.cost ? .green : .orange)
                }
                .padding(.top, 4)
            }
        }
        .padding(.vertical, 12)
    }
}

// MARK: - Spirit Memories Sheet Content

struct SpiritMemoriesSheetContent: View {
    @ObservedObject var gameData: GameData
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Stats Section
                HStack(spacing: 20) {
                    StatPill(icon: "fish.fill", value: gameData.currentAliveFish, label: "Alive", color: .blue)
                    StatPill(icon: "sparkles", value: gameData.totalBirths, label: "Born", color: .yellow)
                    StatPill(icon: "heart.slash", value: gameData.totalDeaths, label: "Passed", color: .pink)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                
                Divider()
                    .padding(.horizontal, 20)
                
                // Events List
                if gameData.spiritEvents.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "heart.circle")
                            .font(.system(size: 40))
                            .foregroundColor(.secondary.opacity(0.5))
                        Text("No events yet")
                            .font(.system(size: 14, design: .rounded))
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView(.vertical, showsIndicators: false) {
                        LazyVStack(spacing: 12) {
                            ForEach(gameData.spiritEvents) { event in
                                SpiritEventRow(event: event)
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .padding(.bottom, 20)
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .background(.clear)
            .navigationTitle("Spirit Memories")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
        }
    }
}

// MARK: - Stat Pill

struct StatPill: View {
    let icon: String
    let value: Int
    let label: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundColor(color)
                Text("\(value)")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundColor(.primary)
            }
            Text(label)
                .font(.system(size: 11, design: .rounded))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Glass Button with Native Liquid Glass

struct GlassButton: View {
    let icon: String
    let activeColor: Color
    let isActive: Bool
    var badgeCount: Int = 0
    let action: () -> Void
    
    var body: some View {
        Button(action: {
            HapticManager.shared.buttonTap()
            action()
        }) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(isActive ? activeColor : .white)
                    .frame(width: 40, height: 40)
                
                // Badge for count (only show if > 0)
                if badgeCount > 0 {
                    Text(badgeCount > 99 ? "99+" : "\(badgeCount)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(activeColor)
                        .clipShape(Capsule())
                        .offset(x: 8, y: -4)
                }
            }
        }
        .buttonStyle(.plain)
        .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isActive)
    }
}

// MARK: - Shop Item Row

struct ShopItemRow: View {
    let item: Species
    let canAfford: Bool
    let aliveCount: Int
    var isNewUnlock: Bool = false
    let action: () -> Void
    
    @State private var isPressed = false
    
    var body: some View {
        Button(action: {
            // Haptic feedback for purchase
            HapticManager.shared.success()
            
            // Trigger purchase with visual feedback
            withAnimation(.easeOut(duration: 0.1)) {
                isPressed = true
            }
            // Brief delay then execute action
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                action()
                withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                    isPressed = false
                }
            }
        }) {
            HStack(spacing: 12) {
                // Thumbnail with NEW badge overlay
                ZStack(alignment: .topTrailing) {
                    Image(item.thumbnailName)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 50, height: 50)
                        .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)
                        .opacity(canAfford ? 1.0 : 0.6)
                        .saturation(canAfford ? 1.0 : 0.0)
                    
                    // NEW badge for species not yet unlocked
                    if isNewUnlock {
                        Text("NEW")
                            .font(.system(size: 8, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 2)
                            .background(Color.green)
                            .clipShape(Capsule())
                            .offset(x: 4, y: -4)
                    }
                }
                
                // Details
                VStack(alignment: .leading, spacing: 4) {
                    // Row 1: Name, Predator Badge, and Cost
                    HStack {
                        Text(item.name)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .foregroundColor(.primary)
                        
                        if item.isPredator {
                            Text("Predator")
                                .font(.system(size: 9, weight: .semibold, design: .rounded))
                                .foregroundColor(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.red.opacity(0.8))
                                .clipShape(Capsule())
                        }
                        
                        Spacer()
                        
                        Text("\(item.cost)")
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(canAfford ? .orange : .gray)
                    }
                    
                    // Row 2: Personality and Alive Count
                    HStack(spacing: 6) {
                        Text(item.personality.rawValue.capitalized)
                            .font(.system(size: 12, design: .rounded))
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        if aliveCount > 0 {
                            HStack(spacing: 4) {
                                Image(systemName: "fish.fill")
                                    .font(.system(size: 10))
                                    .foregroundColor(.blue)
                                Text("\(aliveCount) alive")
                                    .font(.system(size: 11, design: .rounded))
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
                
                Spacer(minLength: 0)
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(isPressed ? Color.green.opacity(0.3) : Color(.systemBackground).opacity(0.8))
                    .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(isPressed ? Color.green : Color.clear, lineWidth: 2)
            )
            .scaleEffect(isPressed ? 0.97 : 1.0)
        }
        .buttonStyle(.plain)
        .disabled(!canAfford)
        .opacity(canAfford ? 1.0 : 0.6)
    }
}

// MARK: - IAP Shop Item Row

struct IAPShopItemRow: View {
    let item: Species
    let isPurchased: Bool
    let aliveCount: Int
    @ObservedObject var storeManager: StoreManager
    let onSpawn: () -> Void
    
    @State private var isPressed = false
    @State private var isPurchasing = false
    
    var product: Product? {
        storeManager.product(for: item.id)
    }
    
    // Extracted to help Swift type checker
    @ViewBuilder
    private var iapRowBackground: some View {
        if isPurchased {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(isPressed ? Color.green.opacity(0.3) : Color(.systemBackground).opacity(0.8))
                .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
        } else {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color.purple.opacity(0.1), Color.pink.opacity(0.1)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
        }
    }
    
    @ViewBuilder
    private var iapRowBorder: some View {
        if isPurchased {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(isPressed ? Color.green : Color.clear, lineWidth: 2)
        } else {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [Color.purple.opacity(0.5), Color.pink.opacity(0.5)],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    lineWidth: 1
                )
        }
    }
    
    var body: some View {
        Button(action: {
            if isPurchased {
                // Already purchased - just spawn the fish
                HapticManager.shared.success()
                withAnimation(.easeOut(duration: 0.1)) {
                    isPressed = true
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    onSpawn()
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                        isPressed = false
                    }
                }
            } else {
                // Need to purchase via IAP
                isPurchasing = true
                Task {
                    let success = await storeManager.purchaseSpecies(item.id)
                    isPurchasing = false
                    if success {
                        HapticManager.shared.success()
                        // After purchase, spawn the fish
                        onSpawn()
                    }
                }
            }
        }) {
            HStack(spacing: 12) {
                // Thumbnail with PREMIUM badge overlay
                ZStack(alignment: .topTrailing) {
                    Image(item.thumbnailName)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 50, height: 50)
                        .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)
                    
                    // Premium badge
                    if !isPurchased {
                        Image(systemName: "star.fill")
                            .font(.system(size: 12))
                            .foregroundColor(.yellow)
                            .shadow(color: .black.opacity(0.3), radius: 1, x: 0, y: 1)
                            .offset(x: 4, y: -4)
                    }
                }
                
                // Details
                VStack(alignment: .leading, spacing: 4) {
                    // Row 1: Name and Price/Owned
                    HStack {
                        Text(item.name)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .foregroundColor(.primary)
                        
                        Text("Premium")
                            .font(.system(size: 9, weight: .semibold, design: .rounded))
                            .foregroundColor(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                LinearGradient(
                                    colors: [.purple, .pink],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .clipShape(Capsule())
                        
                        Spacer()
                        
                        if isPurchased {
                            Text("Owned")
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                                .foregroundColor(.green)
                        } else if let product = product {
                            Text(product.displayPrice)
                                .font(.system(size: 14, weight: .bold, design: .rounded))
                                .foregroundColor(.purple)
                        } else {
                            ProgressView()
                                .scaleEffect(0.7)
                        }
                    }
                    
                    // Row 2: Description and Alive Count
                    HStack(spacing: 6) {
                        Text(item.description)
                            .font(.system(size: 12, design: .rounded))
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        if aliveCount > 0 {
                            HStack(spacing: 4) {
                                Image(systemName: "fish.fill")
                                    .font(.system(size: 10))
                                    .foregroundColor(.blue)
                                Text("\(aliveCount) alive")
                                    .font(.system(size: 11, design: .rounded))
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
                
                Spacer(minLength: 0)
            }
            .padding(12)
            .background(iapRowBackground)
            .overlay(iapRowBorder)
            .scaleEffect(isPressed ? 0.97 : 1.0)
        }
        .buttonStyle(.plain)
        .disabled(isPurchasing)
        .overlay {
            if isPurchasing {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.black.opacity(0.3))
                ProgressView()
                    .tint(.white)
            }
        }
    }
}

// MARK: - Spirit Event Row

struct SpiritEventRow: View {
    let event: SpiritEvent
    
    // Look up the species to get the thumbnail
    private var speciesThumbnail: String? {
        guard let speciesName = event.speciesName else { return nil }
        return SpeciesCatalog.shared.allSpecies.first { $0.name == speciesName }?.thumbnailName
    }
    
    var body: some View {
        HStack(spacing: 12) {
            // Icon or Thumbnail
            ZStack {
                // Background circle
                Circle()
                    .fill(event.type == .death ? Color.pink.opacity(0.15) : Color.yellow.opacity(0.15))
                    .frame(width: 36, height: 36)
                
                // Fish thumbnail if available, otherwise icon
                if let thumbnail = speciesThumbnail {
                    Image(thumbnail)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 28, height: 28)
                } else {
                    Image(systemName: event.type == .death ? "heart.slash.fill" : "sparkles")
                        .font(.system(size: 18))
                        .foregroundColor(event.type == .death ? .pink.opacity(0.8) : .yellow)
                }
            }
            .frame(width: 36, height: 36)
            
            // Details
            VStack(alignment: .leading, spacing: 4) {
                if event.type == .death {
                    // Death event - name with passed icon
                    HStack(spacing: 4) {
                        Image(systemName: "heart.slash.fill")
                            .font(.system(size: 12))
                            .foregroundColor(.pink.opacity(0.8))
                        Text(event.deceasedName ?? "Unknown")
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .foregroundColor(.primary)
                    }
                    
                    HStack(spacing: 6) {
                        Text(event.speciesName ?? "")
                            .font(.system(size: 12, design: .rounded))
                            .foregroundColor(.secondary)
                        
                        Text("•")
                            .foregroundColor(.secondary.opacity(0.5))
                        
                        Text(event.deathReason ?? "Unknown")
                            .font(.system(size: 12, design: .rounded))
                            .foregroundColor(.secondary)
                        
                        if let age = event.formattedAge {
                            Text("•")
                                .foregroundColor(.secondary.opacity(0.5))
                            
                            Text("Age: \(age)")
                                .font(.system(size: 12, design: .rounded))
                                .foregroundColor(.secondary)
                        }
                    }
                } else {
                    // Birth event - name with born icon
                    let babyNames = event.babyNames?.joined(separator: ", ") ?? "baby"
                    HStack(spacing: 4) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 12))
                            .foregroundColor(.yellow)
                        Text("\(babyNames) was born!")
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .foregroundColor(.primary)
                    }
                    
                    HStack(spacing: 6) {
                        Text(event.speciesName ?? "")
                            .font(.system(size: 12, design: .rounded))
                            .foregroundColor(.secondary)
                        
                        Text("•")
                            .foregroundColor(.secondary.opacity(0.5))
                        
                        Text("Parents: \(event.parent1Name ?? "?") & \(event.parent2Name ?? "?")")
                            .font(.system(size: 12, design: .rounded))
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            Spacer()
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.systemBackground).opacity(0.8))
                .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
        )
    }
}
