# In-App Purchase Integration Guide

## Overview

Users can purchase subscriptions directly from iOS App Store or Android Play Store. The backend verifies the receipt and activates the subscription.

---

## How It Works

```
Mobile App (iOS/Android)
         ↓
User selects plan & completes purchase
         ↓
Payment provider (App Store / Play Store)
         ↓
Returns receipt to mobile app
         ↓
Mobile app sends receipt to backend
         ↓
Backend verifies receipt with payment provider
         ↓
Backend activates subscription if valid
         ↓
Mobile app shows subscription activated
```

---

## Mobile Implementation

### iOS (App Store)

#### 1. Setup In-App Purchases in App Store Connect
- Log in to App Store Connect
- Select your app
- Go to Monetization → In-App Purchases
- Create subscription:
  - Product ID: `com.yourapp.subscription.basic` (for basic plan)
  - Subscription: Monthly
  - Price: ₹99.99

#### 2. Implement StoreKit in iOS App
```swift
import StoreKit

class SubscriptionManager: NSObject, SKPaymentTransactionObserver {
    
    static let shared = SubscriptionManager()
    
    override init() {
        super.init()
        SKPaymentQueue.default().add(self)
    }
    
    // Purchase a subscription
    func purchase(productId: String) {
        let request = SKProductsRequest(productIdentifiers: [productId])
        request.delegate = self
        request.start()
    }
    
    // Handle transaction
    func paymentQueue(_ queue: SKPaymentQueue, 
                     updatedTransactions transactions: [SKPaymentTransaction]) {
        for transaction in transactions {
            switch transaction.transactionState {
            case .purchased:
                handlePurchase(transaction)
            case .failed:
                SKPaymentQueue.default().finishTransaction(transaction)
            case .restored:
                handlePurchase(transaction)
            case .deferred, .purchasing:
                break
            }
        }
    }
    
    // Handle successful purchase
    private func handlePurchase(_ transaction: SKPaymentTransaction) {
        if let receiptURL = Bundle.main.appStoreReceiptURL,
           let receiptData = try? Data(contentsOf: receiptURL) {
            
            let receiptString = receiptData.base64EncodedString()
            
            // Send receipt to backend
            verifyReceiptWithBackend(
                receipt: receiptString,
                platform: "app_store",
                bundleId: Bundle.main.bundleIdentifier ?? "",
                productId: transaction.payment.productIdentifier
            )
        }
        
        SKPaymentQueue.default().finishTransaction(transaction)
    }
    
    // Send receipt to backend
    private func verifyReceiptWithBackend(receipt: String, 
                                         platform: String,
                                         bundleId: String,
                                         productId: String) {
        let url = URL(string: "https://yourapi.com/api/subscription/verify-in-app-purchase")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(userToken)", forHTTPHeaderField: "Authorization")
        
        let payload: [String: Any] = [
            "receipt": receipt,
            "platform": platform,
            "bundleId": bundleId,
            "productId": productId
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let data = data,
               let result = try? JSONDecoder().decode(VerificationResponse.self, from: data) {
                if result.success {
                    // Subscription activated
                    print("✅ Subscription activated!")
                    NotificationCenter.default.post(name: NSNotification.Name("SubscriptionActivated"), object: result.subscription)
                } else {
                    print("❌ Verification failed: \(result.message)")
                }
            }
        }.resume()
    }
}

// Response model
struct VerificationResponse: Codable {
    let success: Bool
    let message: String
    let subscription: SubscriptionData?
}

struct SubscriptionData: Codable {
    let id: String
    let status: String
    let expiryDate: String
}
```

---

### Android (Play Store)

#### 1. Setup In-App Purchases in Google Play Console
- Log in to Google Play Console
- Select your app
- Go to Monetization → In-app products
- Create subscription:
  - Product ID: `com.yourapp.subscription.basic`
  - Subscription: Monthly
  - Price: ₹99.99

#### 2. Implement Google Play Billing Library
```kotlin
import com.android.billingclient.api.*

class SubscriptionManager(private val context: Context) {
    
    private lateinit var billingClient: BillingClient
    private val userToken = SharedPreferences.getInstance().getString("auth_token", "")
    
    init {
        billingClient = BillingClient.newBuilder(context)
            .setListener(this::onPurchasesUpdated)
            .enablePendingPurchases()
            .build()
        
        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    // Connection established
                    loadProducts()
                }
            }
            
            override fun onBillingServiceDisconnected() {
                // Retry connection
            }
        })
    }
    
    // Load subscription products
    private fun loadProducts() {
        val productList = listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId("com.yourapp.subscription.basic")
                .setProductType(BillingClient.ProductType.SUBS)
                .build(),
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId("com.yourapp.subscription.premium")
                .setProductType(BillingClient.ProductType.SUBS)
                .build(),
        )
        
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build()
        
        billingClient.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
            // Handle product details
        }
    }
    
    // Launch purchase flow
    fun launchPurchaseFlow(productId: String, activity: Activity) {
        val productDetails = getProductDetails(productId)
        
        val offerToken = productDetails?.subscriptionOfferDetails?.get(0)?.offerToken ?: ""
        val productDetailsParamsList = listOf(
            BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(productDetails)
                .setOfferToken(offerToken)
                .build()
        )
        
        val billingFlowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(productDetailsParamsList)
            .build()
        
        billingClient.launchBillingFlow(activity, billingFlowParams)
    }
    
    // Handle purchase updates
    private fun onPurchasesUpdated(billingResult: BillingResult, purchases: List<Purchase>?) {
        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (purchase in purchases) {
                if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                    verifyPurchaseWithBackend(purchase)
                }
            }
        }
    }
    
    // Verify purchase with backend
    private fun verifyPurchaseWithBackend(purchase: Purchase) {
        val url = "https://yourapi.com/api/subscription/verify-in-app-purchase"
        val client = OkHttpClient()
        
        val payload = JSONObject().apply {
            put("receipt", purchase.originalJson)
            put("platform", "play_store")
            put("packageName", context.packageName)
            put("productId", purchase.skus.first())
        }
        
        val body = RequestBody.create("application/json".toMediaType(), payload.toString())
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $userToken")
            .post(body)
            .build()
        
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("SubscriptionManager", "Verification failed", e)
            }
            
            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    val result = JSONObject(response.body?.string() ?: "")
                    if (result.getBoolean("success")) {
                        Log.d("SubscriptionManager", "✅ Subscription activated!")
                        // Update UI
                    }
                }
            }
        })
    }
}
```

---

## Backend Endpoint

### POST `/api/subscription/verify-in-app-purchase`

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "receipt": "base64_encoded_receipt",
  "platform": "app_store",
  "bundleId": "com.yourapp.ios",
  "productId": "com.yourapp.subscription.basic"
}
```

Or for Play Store:
```json
{
  "receipt": "purchase_json",
  "platform": "play_store",
  "packageName": "com.yourapp.android",
  "productId": "com.yourapp.subscription.basic"
}
```

**Response**:
```json
{
  "success": true,
  "message": "In-app purchase verified and subscription activated",
  "subscription": {
    "id": "sub_123",
    "plan": {
      "id": "plan_123",
      "name": "basic",
      "displayName": "Basic Plan"
    },
    "status": "active",
    "startDate": "2024-11-07T10:00:00Z",
    "expiryDate": "2024-12-07T10:00:00Z",
    "daysRemaining": 30,
    "autoRenew": true
  }
}
```

---

## Product ID Mapping

Map your product IDs to plans:

| Platform | Product ID | Maps To | Price |
|----------|-----------|---------|-------|
| App Store / Play Store | `*.basic` | Basic Plan | ₹99.99 |
| App Store / Play Store | `*.premium` | Premium Plan | ₹299.99 |
| App Store / Play Store | `*.pro` | Pro Plan | ₹599.99 |

Examples:
- `com.mythapp.subscription.basic`
- `com.mythapp.subscription.premium`
- `com.mythapp.subscription.pro`

---

## Flow Diagram

```
iOS/Android App
    ↓
User taps "Subscribe to Basic"
    ↓
App launches in-app purchase UI
    ↓
User completes payment
    ↓
Payment provider returns receipt
    ↓
App sends receipt to:
POST /api/subscription/verify-in-app-purchase
    ↓
Backend verifies with:
- App Store (iOS) or
- Play Store (Android)
    ↓
If valid:
  - Create subscription record
  - Create payment record
  - Return subscription details
    ↓
App receives subscription
    ↓
Show "Subscription Active!" message
    ↓
Update UI with features
```

---

## Error Handling

### Common Errors

**Invalid Receipt**
```json
{
  "success": false,
  "message": "Invalid receipt",
  "error": "Receipt verification failed"
}
```

**Already Purchased**
```json
{
  "success": false,
  "message": "Subscription already active",
  "subscription": { /* existing subscription */ }
}
```

**Product Not Found**
```json
{
  "success": false,
  "message": "Unknown product ID"
}
```

---

## Testing

### iOS - Sandbox Testing
1. Create test user in App Store Connect
2. Sign out of App Store on device
3. Sign in with test user account
4. Purchase in app (won't be charged)
5. Verify receipt sent to backend

### Android - Sandbox Testing
1. Add test accounts in Play Console
2. Install app on device
3. Go to device Settings → Apps → Google Play Services → Manage Storage → Manage All Files
4. Clear cache
5. Purchase with test account (won't be charged)

---

## Security Notes

✅ Always verify receipts on backend  
✅ Check bundle ID / package name matches  
✅ Verify expiry dates  
✅ Prevent double-processing of receipts  
✅ Use HTTPS only  
✅ Store shared secrets securely  

---

## Configuration

Add to `.env`:
```env
APP_STORE_BUNDLE_ID=com.yourapp.ios
APP_STORE_SHARED_SECRET=your_app_store_shared_secret
PLAY_STORE_PACKAGE_NAME=com.yourapp.android
PLAY_STORE_SERVICE_ACCOUNT=your_google_service_account_json
```

---

## Utilities

Backend provides helper functions in `src/utils/inAppPurchaseUtils.js`:
- `verifyAppStoreReceipt()` - Verify iOS receipt
- `verifyPlayStoreReceipt()` - Verify Android receipt
- `isSubscriptionValid()` - Check if subscription is current
- `getDaysRemaining()` - Calculate remaining days
- `mapProductToPlan()` - Map product ID to plan

---

## Auto-Renewal

Both App Store and Play Store support auto-renewal:
- Subscription automatically renews on expiry date
- Backend receives notification via webhook
- New `SubscriptionPayment` record created
- Subscription extended automatically

---

## Refunds

If user requests refund:
1. User initiates refund in App Store / Play Store
2. Payment provider sends webhook to backend
3. Backend marks payment as `refunded`
4. Subscription status updated to `expired` or `cancelled`
5. User loses access to subscription features

---

## Support

For issues:
1. Check receipt is valid base64
2. Verify bundle ID / package name matches
3. Check shared secret is correct
4. Review backend logs for verification errors
5. Test in sandbox environment first

