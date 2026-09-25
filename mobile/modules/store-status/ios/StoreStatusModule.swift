import ExpoModulesCore
import StoreKit

/// What this device's Apple ID currently holds, read straight from StoreKit.
///
/// READ-ONLY, AND THAT IS THE WHOLE POINT
///
/// RevenueCat can answer "what does this Apple ID own", but only by syncing
/// the purchases to whoever is signed in, and the project transfers a
/// subscription to the account that syncs it. Asking that way would move a
/// subscription from one Revely account to another just by opening the
/// paywall. `Transaction.currentEntitlements` is the App Store's own answer,
/// kept on the device: no sign-in prompt, no network call we make, nothing
/// sent to RevenueCat, nothing moved.
public class StoreStatusModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StoreStatus")

    /// Auto-renewable subscriptions this Apple ID is entitled to right now.
    /// Only transactions StoreKit verified, and none that were refunded.
    AsyncFunction("activeSubscriptions") { () async -> [[String: Any]] in
      var active: [[String: Any]] = []
      for await result in Transaction.currentEntitlements {
        guard case .verified(let transaction) = result else { continue }
        guard transaction.productType == .autoRenewable,
              transaction.revocationDate == nil else { continue }
        if let expires = transaction.expirationDate, expires <= Date() { continue }
        active.append([
          "productId": transaction.productID,
          "expiresAt": (transaction.expirationDate?.timeIntervalSince1970 ?? 0) * 1000,
          "familyShared": transaction.ownershipType == .familyShared,
        ])
      }
      return active
    }
  }
}
