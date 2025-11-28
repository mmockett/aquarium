import Foundation
import StoreKit
import Combine

// MARK: - Product Identifiers
// These must match the product IDs configured in App Store Connect
enum StoreProduct: String, CaseIterable {
    case rainbowSpirit = "com.aquarium.rainbow_spirit"
    
    var speciesId: String {
        switch self {
        case .rainbowSpirit: return "rainbow"
        }
    }
    
    static func fromSpeciesId(_ speciesId: String) -> StoreProduct? {
        return allCases.first { $0.speciesId == speciesId }
    }
}

// MARK: - Store Manager
@MainActor
class StoreManager: ObservableObject {
    static let shared = StoreManager()
    
    // Available products from App Store
    @Published private(set) var products: [Product] = []
    
    // Purchased product IDs
    @Published private(set) var purchasedProductIDs: Set<String> = []
    
    // Loading state
    @Published private(set) var isLoading = false
    
    // Error state
    @Published var errorMessage: String?
    
    private var updateListenerTask: Task<Void, Error>?
    
    private init() {
        // Start listening for transaction updates
        updateListenerTask = listenForTransactions()
        
        // Load products and check existing purchases
        Task {
            await loadProducts()
            await updatePurchasedProducts()
        }
    }
    
    deinit {
        updateListenerTask?.cancel()
    }
    
    // MARK: - Load Products
    
    /// Fetch products from App Store
    func loadProducts() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let productIDs = StoreProduct.allCases.map { $0.rawValue }
            products = try await Product.products(for: productIDs)
            print("StoreManager: Loaded \(products.count) products")
        } catch {
            print("StoreManager: Failed to load products: \(error)")
            errorMessage = "Failed to load store products"
        }
    }
    
    // MARK: - Purchase
    
    /// Purchase a product
    func purchase(_ product: Product) async throws -> Bool {
        let result = try await product.purchase()
        
        switch result {
        case .success(let verification):
            // Check if transaction is verified
            let transaction = try checkVerified(verification)
            
            // Update purchased products
            await updatePurchasedProducts()
            
            // Finish the transaction
            await transaction.finish()
            
            print("StoreManager: Purchase successful for \(product.id)")
            return true
            
        case .userCancelled:
            print("StoreManager: User cancelled purchase")
            return false
            
        case .pending:
            print("StoreManager: Purchase pending (e.g., parental approval)")
            return false
            
        @unknown default:
            print("StoreManager: Unknown purchase result")
            return false
        }
    }
    
    /// Purchase a species by its ID
    func purchaseSpecies(_ speciesId: String) async -> Bool {
        guard let storeProduct = StoreProduct.fromSpeciesId(speciesId),
              let product = products.first(where: { $0.id == storeProduct.rawValue }) else {
            print("StoreManager: Product not found for species \(speciesId)")
            errorMessage = "Product not available"
            return false
        }
        
        do {
            return try await purchase(product)
        } catch {
            print("StoreManager: Purchase failed: \(error)")
            errorMessage = "Purchase failed: \(error.localizedDescription)"
            return false
        }
    }
    
    // MARK: - Restore Purchases
    
    /// Restore previous purchases
    /// Returns: (success: Bool, restoredCount: Int)
    func restorePurchases() async -> (success: Bool, restoredCount: Int) {
        isLoading = true
        defer { isLoading = false }
        
        let previousCount = purchasedProductIDs.count
        
        do {
            // Sync with App Store to get latest entitlements
            try await AppStore.sync()
            await updatePurchasedProducts()
            
            let restoredCount = purchasedProductIDs.count - previousCount
            print("StoreManager: Purchases restored, \(restoredCount) new items")
            return (true, max(0, restoredCount))
        } catch {
            print("StoreManager: Failed to restore purchases: \(error)")
            errorMessage = "Failed to restore purchases"
            return (false, 0)
        }
    }
    
    /// Check and restore purchases silently on app launch
    func checkExistingPurchases() async {
        await updatePurchasedProducts()
    }
    
    // MARK: - Check Purchase Status
    
    /// Check if a species has been purchased via IAP
    func isSpeciesPurchased(_ speciesId: String) -> Bool {
        guard let storeProduct = StoreProduct.fromSpeciesId(speciesId) else {
            return true // Not an IAP species, so it's "purchased" (unlockable via in-game currency)
        }
        return purchasedProductIDs.contains(storeProduct.rawValue)
    }
    
    /// Get the product for a species
    func product(for speciesId: String) -> Product? {
        guard let storeProduct = StoreProduct.fromSpeciesId(speciesId) else {
            return nil
        }
        return products.first { $0.id == storeProduct.rawValue }
    }
    
    /// Check if a species requires IAP
    func requiresIAP(_ speciesId: String) -> Bool {
        return StoreProduct.fromSpeciesId(speciesId) != nil
    }
    
    // MARK: - Private Helpers
    
    /// Listen for transaction updates (e.g., purchases made on other devices)
    private func listenForTransactions() -> Task<Void, Error> {
        return Task.detached {
            for await result in Transaction.updates {
                do {
                    let transaction = try await self.checkVerified(result)
                    await self.updatePurchasedProducts()
                    await transaction.finish()
                } catch {
                    print("StoreManager: Transaction verification failed: \(error)")
                }
            }
        }
    }
    
    /// Update the set of purchased product IDs
    private func updatePurchasedProducts() async {
        var purchased: Set<String> = []
        
        for await result in Transaction.currentEntitlements {
            do {
                let transaction = try checkVerified(result)
                purchased.insert(transaction.productID)
            } catch {
                print("StoreManager: Failed to verify transaction: \(error)")
            }
        }
        
        purchasedProductIDs = purchased
        print("StoreManager: Updated purchased products: \(purchased)")
        
        // Sync with GameData
        for productID in purchased {
            if let storeProduct = StoreProduct.allCases.first(where: { $0.rawValue == productID }) {
                GameData.shared.unlockIAPSpecies(storeProduct.speciesId)
            }
        }
    }
    
    /// Verify a transaction
    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error):
            throw error
        case .verified(let safe):
            return safe
        }
    }
}

