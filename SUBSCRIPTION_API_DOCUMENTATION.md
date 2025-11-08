# Writer Subscription Module - API Documentation

## Overview

The Writer Subscription Module enables writers (authors) to subscribe to different plans that unlock various features and monetization capabilities. The module supports:

- **Free Trial**: 1 month free plan for new writers
- **Tiered Plans**: Basic, Premium, and Pro plans with increasing features
- **Flexible Payments**: Support for Razorpay, RevenueCat, App Store, and Play Store
- **Earnings Multipliers**: Different earnings rates based on subscription tier
- **Usage Limits**: Plan-specific limits on novels, chapters, storage, etc.

## Features by Plan

### Free Plan
- Duration: 1 month (30 days)
- Price: ₹0
- Features:
  - Create up to 5 novels
  - Up to 50 chapters per novel
  - 10MB upload size per chapter
  - No monetization
  - Basic platform access
  - Earnings multiplier: 1.0x
  - Platform fee: 50%

### Basic Plan
- Duration: 1 month (30 days)
- Price: ₹99.99
- Features:
  - Unlimited novels
  - Unlimited chapters
  - 20MB upload size per chapter
  - Monetization enabled
  - Custom cover support
  - Basic analytics
  - Earnings multiplier: 1.1x
  - Platform fee: 30%

### Premium Plan
- Duration: 1 month (30 days)
- Price: ₹299.99
- Features:
  - Unlimited everything
  - 50MB upload size per chapter
  - Advanced monetization
  - Advanced analytics
  - Chapter scheduling
  - AI assistance
  - Priority support
  - Earnings multiplier: 1.25x
  - Platform fee: 20%

### Pro Plan
- Duration: 1 month (30 days)
- Price: ₹599.99
- Features:
  - All Premium features
  - 100MB upload size per chapter
  - Enhanced AI suite
  - Predictive analytics
  - Marketing tools
  - 24/7 dedicated support
  - API access
  - White label options
  - Earnings multiplier: 1.5x
  - Platform fee: 15%

---

## API Endpoints

### 1. Get All Available Plans

```http
GET /api/subscription/plans
```

**Description**: Retrieve all active subscription plans

**Authentication**: Not required

**Response**:
```json
{
  "success": true,
  "plans": [
    {
      "id": "plan_id",
      "name": "free",
      "displayName": "Free Plan",
      "description": "Perfect for trying out the platform",
      "durationDays": 30,
      "price": {
        "raw": 0,
        "formatted": "₹0.00"
      },
      "currency": "INR",
      "features": [
        {
          "name": "Create Novels",
          "description": "Create and publish novels",
          "limit": null
        }
      ],
      "limits": {
        "maxNovels": 5,
        "maxChaptersPerNovel": 50,
        "maxChapterUploadSizeMB": 10,
        "canMonetize": false,
        "canUseCustomCover": false,
        "hasAnalytics": false,
        "canScheduleChapters": false,
        "hasAIAssistance": false,
        "earningsMultiplier": 1.0
      },
      "displayOrder": 1
    }
  ]
}
```

---

### 2. Get Plan Details

```http
GET /api/subscription/plans/:planId
```

**Description**: Get detailed information about a specific plan

**Authentication**: Not required

**Parameters**:
- `planId` (path, required): The ID of the subscription plan

**Response**:
```json
{
  "success": true,
  "plan": {
    "id": "plan_id",
    "name": "premium",
    "displayName": "Premium Plan",
    "description": "For serious writers",
    "durationDays": 30,
    "price": {
      "raw": 299.99,
      "formatted": "₹299.99"
    },
    "currency": "INR",
    "features": [
      {
        "name": "Unlimited Everything",
        "description": "Unlimited novels, chapters, and storage",
        "limit": null
      }
    ],
    "limits": {
      "maxNovels": null,
      "maxChaptersPerNovel": null,
      "maxChapterUploadSizeMB": 50,
      "canMonetize": true,
      "canUseCustomCover": true,
      "hasAnalytics": true,
      "canScheduleChapters": true,
      "hasAIAssistance": true,
      "earningsMultiplier": 1.25
    }
  }
}
```

---

### 3. Activate Free Plan

```http
POST /api/subscription/activate-free-plan
```

**Description**: Activate the free 1-month trial for a new writer

**Authentication**: Required (Bearer token)

**Request Body**: (empty)

**Response**:
```json
{
  "success": true,
  "message": "Free plan activated successfully",
  "subscription": {
    "id": "subscription_id",
    "plan": {
      "id": "plan_id",
      "name": "free",
      "displayName": "Free Plan",
      "limits": {}
    },
    "status": "active",
    "startDate": "2024-01-15T10:00:00.000Z",
    "expiryDate": "2024-02-14T10:00:00.000Z",
    "daysRemaining": 30
  }
}
```

**Error Responses**:
```json
{
  "success": false,
  "message": "You have already used the free trial",
  "code": "FREE_TRIAL_ALREADY_USED"
}
```

---

### 4. Get Current Subscription

```http
GET /api/subscription/current
```

**Description**: Get the currently active subscription for the authenticated writer

**Authentication**: Required (Bearer token)

**Response**:
```json
{
  "success": true,
  "subscription": {
    "id": "subscription_id",
    "plan": {
      "id": "plan_id",
      "name": "premium",
      "displayName": "Premium Plan",
      "limits": {
        "maxNovels": null,
        "canMonetize": true,
        "earningsMultiplier": 1.25
      }
    },
    "status": "active",
    "isActive": true,
    "startDate": "2024-01-15T10:00:00.000Z",
    "expiryDate": "2024-02-14T10:00:00.000Z",
    "daysRemaining": 25,
    "isFreeTrial": false,
    "autoRenew": true,
    "usageStats": {
      "novelsCreated": 3,
      "chaptersPublished": 45,
      "totalWords": 125000
    },
    "freeTrialUsageCount": 0
  }
}
```

**Error Responses**:
```json
{
  "success": false,
  "message": "No subscription found",
  "code": "NO_SUBSCRIPTION"
}
```

---

### 5. Initiate Payment

```http
POST /api/subscription/initiate-payment
```

**Description**: Prepare a subscription upgrade for payment. Call this before initiating payment on the frontend.

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "planId": "plan_id",
  "paymentMethod": "razorpay"
}
```

**Parameters**:
- `planId` (required): The ID of the plan to upgrade to
- `paymentMethod` (required): One of: `razorpay`, `revenucat`, `app_store`, `play_store`

**Response**:
```json
{
  "success": true,
  "message": "Payment initiation successful. Proceed with payment on frontend.",
  "payment": {
    "paymentId": "payment_record_id",
    "orderId": "SUB_a1b2c3_xyz123",
    "amount": {
      "raw": 299.99,
      "formatted": "₹299.99"
    },
    "currency": "INR",
    "plan": {
      "id": "plan_id",
      "name": "premium",
      "displayName": "Premium Plan"
    },
    "paymentMethod": "razorpay",
    "subscriptionStartDate": "2024-02-15T10:00:00.000Z",
    "subscriptionEndDate": "2024-03-15T10:00:00.000Z"
  }
}
```

---

### 6. Verify Payment

```http
POST /api/subscription/verify-payment
```

**Description**: Verify and activate subscription after payment is completed on the frontend

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "paymentId": "payment_record_id",
  "transactionId": "razorpay_payment_id_or_receipt_id",
  "paymentMethod": "razorpay",
  "gatewayResponse": {
    "razorpay_order_id": "order_123",
    "razorpay_payment_id": "pay_123",
    "razorpay_signature": "signature"
  },
  "metadata": {
    "deviceId": "device_123",
    "appVersion": "1.0.0"
  }
}
```

**Parameters**:
- `paymentId` (required): The payment record ID from initiate-payment response
- `transactionId` (required): Transaction ID from payment provider
- `paymentMethod` (required): The payment method used
- `gatewayResponse` (optional): Response from payment gateway
- `metadata` (optional): Additional metadata

**Response**:
```json
{
  "success": true,
  "message": "Payment verified and subscription activated",
  "subscription": {
    "id": "subscription_id",
    "plan": {
      "id": "plan_id",
      "name": "premium",
      "displayName": "Premium Plan"
    },
    "status": "active",
    "startDate": "2024-02-15T10:00:00.000Z",
    "expiryDate": "2024-03-15T10:00:00.000Z",
    "daysRemaining": 30
  }
}
```

---

### 7. Get Payment History

```http
GET /api/subscription/payment-history?limit=10&skip=0
```

**Description**: Get all payment transactions for the authenticated writer

**Authentication**: Required (Bearer token)

**Query Parameters**:
- `limit` (optional, default: 10): Number of records per page
- `skip` (optional, default: 0): Number of records to skip (for pagination)

**Response**:
```json
{
  "success": true,
  "payments": [
    {
      "id": "payment_id",
      "orderId": "SUB_a1b2c3_xyz123",
      "transactionId": "razorpay_pay_123",
      "amount": {
        "raw": 299.99,
        "formatted": "₹299.99"
      },
      "currency": "INR",
      "status": "completed",
      "paymentMethod": "razorpay",
      "plan": "premium",
      "planDisplayName": "Premium Plan",
      "subscriptionStartDate": "2024-02-15T10:00:00.000Z",
      "subscriptionEndDate": "2024-03-15T10:00:00.000Z",
      "paymentAttemptedAt": "2024-02-15T09:00:00.000Z",
      "paymentCompletedAt": "2024-02-15T09:05:00.000Z",
      "failureReason": null
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 10,
    "skip": 0
  }
}
```

---

### 8. Cancel Subscription

```http
POST /api/subscription/cancel
```

**Description**: Cancel the current subscription

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "cancellationReason": "Too expensive"
}
```

**Parameters**:
- `cancellationReason` (optional): Reason for cancellation

**Response**:
```json
{
  "success": true,
  "message": "Subscription cancelled successfully",
  "subscription": {
    "id": "subscription_id",
    "status": "cancelled",
    "cancelledAt": "2024-02-20T10:00:00.000Z"
  }
}
```

---

### 9. Check Action Permission

```http
POST /api/subscription/check-action
```

**Description**: Check if the writer can perform a specific action based on their subscription plan

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "actionType": "create_novel",
  "currentCount": 3
}
```

**Parameters**:
- `actionType` (required): One of: `create_novel`, `create_chapter`, `upload_chapter`, `monetize`
- `currentCount` (optional): Current count of the resource (for limit checking)

**Response** (Success):
```json
{
  "success": true,
  "allowed": true
}
```

**Response** (Blocked by limit):
```json
{
  "success": false,
  "allowed": false,
  "reason": "Maximum novels limit reached (5)",
  "limit": 5
}
```

---

### 10. Get Earnings Multiplier

```http
GET /api/subscription/earnings-multiplier
```

**Description**: Get the earnings multiplier for the authenticated writer based on their subscription

**Authentication**: Required (Bearer token)

**Response**:
```json
{
  "success": true,
  "multiplier": 1.25,
  "percentage": "125%"
}
```

---

### 11. Payment Webhook

```http
POST /api/subscription/webhook
```

**Description**: Webhook endpoint for payment providers to send payment status updates

**Authentication**: Not required (but should be verified based on provider signature)

**Request Body** (example from Razorpay):
```json
{
  "event": "payment.authorized",
  "data": {
    "payment": {
      "id": "pay_123",
      "entity": "payment",
      "amount": 29999,
      "currency": "INR",
      "status": "captured"
    }
  },
  "provider": "razorpay"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Webhook received"
}
```

---

## Implementation Guide

### Frontend Implementation with Payment Providers

#### Using Razorpay

```javascript
// 1. Initiate payment
const response = await fetch('/api/subscription/initiate-payment', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    planId: planId,
    paymentMethod: 'razorpay'
  })
});

const { payment } = await response.json();

// 2. Open Razorpay checkout
const options = {
  key: 'YOUR_RAZORPAY_KEY',
  amount: payment.amount.raw * 100,
  currency: 'INR',
  order_id: payment.orderId,
  handler: async function(response) {
    // 3. Verify payment
    const verifyResponse = await fetch('/api/subscription/verify-payment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentId: payment.paymentId,
        transactionId: response.razorpay_payment_id,
        paymentMethod: 'razorpay',
        gatewayResponse: response
      })
    });
    
    const result = await verifyResponse.json();
    if (result.success) {
      // Update UI with new subscription
    }
  }
};

const rzp = new Razorpay(options);
rzp.open();
```

#### Using RevenueCat

```javascript
// 1. Initiate payment
const response = await fetch('/api/subscription/initiate-payment', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    planId: planId,
    paymentMethod: 'revenucat'
  })
});

const { payment } = await response.json();

// 2. Make purchase through RevenueCat SDK
const revenueCat = new Purchases.default();
try {
  const purchaseResult = await revenueCat.purchasePackage(package);
  
  // 3. Verify payment
  const verifyResponse = await fetch('/api/subscription/verify-payment', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      paymentId: payment.paymentId,
      transactionId: purchaseResult.transaction.transactionIdentifier,
      paymentMethod: 'revenuect',
      gatewayResponse: purchaseResult
    })
  });
} catch (e) {
  console.error(e);
}
```

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| NO_SUBSCRIPTION | 404 | User doesn't have a subscription |
| FREE_TRIAL_ALREADY_USED | 400 | User has already used the free trial |
| PLAN_NOT_FOUND | 404 | Specified plan doesn't exist |
| INSUFFICIENT_PERMISSIONS | 403 | Feature not available in current plan |
| PAYMENT_VERIFICATION_FAILED | 400 | Payment verification failed |
| SUBSCRIPTION_EXPIRED | 403 | Current subscription has expired |

---

## Database Models

### WriterSubscription
```javascript
{
  writer: ObjectId,           // Reference to User
  currentPlan: ObjectId,      // Reference to SubscriptionPlan
  status: String,             // active, expired, cancelled, pending, paused
  startDate: Date,            // When subscription started
  expiryDate: Date,           // When subscription expires
  isFreeTrial: Boolean,       // Is this a free trial?
  autoRenew: Boolean,         // Auto-renew after expiry?
  lastPaymentTransactionId: String,
  paymentProvider: String,    // razorpay, revenucat, app_store, play_store
  freeTrialUsageCount: Number,
  usageStats: {
    novelsCreated: Number,
    chaptersPublished: Number,
    totalWords: Number
  }
}
```

### SubscriptionPlan
```javascript
{
  name: String,               // free, basic, premium, pro
  displayName: String,
  description: String,
  durationDays: Number,       // Duration in days
  price: Number,              // In paisa/cents
  currency: String,           // INR, USD, etc
  features: Array,            // List of features
  limits: {
    maxNovels: Number,
    maxChaptersPerNovel: Number,
    maxChapterUploadSizeMB: Number,
    canMonetize: Boolean,
    canUseCustomCover: Boolean,
    hasAnalytics: Boolean,
    canScheduleChapters: Boolean,
    hasAIAssistance: Boolean,
    earningsMultiplier: Number
  }
}
```

### SubscriptionPayment
```javascript
{
  writer: ObjectId,
  subscription: ObjectId,
  plan: ObjectId,
  amount: Number,
  currency: String,
  status: String,             // pending, completed, failed, refunded
  paymentMethod: String,
  transactionId: String,
  orderId: String,
  gatewayResponse: Object,
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  paymentCompletedAt: Date
}
```

---

## Middleware Usage

### Check Active Subscription
```javascript
const { checkActiveSubscription } = require('../middleware/subscriptionMiddleware');

router.post('/publish-novel', checkActiveSubscription, publishNovel);
```

### Check Specific Feature
```javascript
const { checkFeature } = require('../middleware/subscriptionMiddleware');

router.post('/monetize-novel', 
  checkFeature('canMonetize'), 
  monetizeNovel
);
```

### Attach Subscription Info
```javascript
const { attachSubscriptionInfo } = require('../middleware/subscriptionMiddleware');

router.get('/dashboard', attachSubscriptionInfo, (req, res) => {
  if (req.hasActiveSubscription) {
    // User has active subscription
  }
});
```

---

## Best Practices

1. **Always verify payments** on the backend before activating subscriptions
2. **Check subscription expiry** regularly and update status
3. **Store payment provider IDs** for refund/support purposes
4. **Implement webhook handling** for payment updates
5. **Log all subscription changes** for audit trails
6. **Cache plan information** to reduce database queries
7. **Use transaction IDs** for all payment operations
8. **Implement rate limiting** on payment endpoints
9. **Validate payment signatures** from payment providers
10. **Handle subscription renewal** gracefully

---

## Testing

### Seed Subscription Plans
```bash
npm run seed-plans
```

or manually:
```bash
node scripts/seed_subscription_plans.js
```

### Test Free Plan Activation
```bash
curl -X POST http://localhost:3000/api/subscription/activate-free-plan \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Get Available Plans
```bash
curl http://localhost:3000/api/subscription/plans
```

---

## Future Enhancements

1. Add subscription renewal reminders
2. Implement family/group plans
3. Add promotional codes and discounts
4. Support multi-currency payments
5. Add subscription analytics dashboard
6. Implement plan migration strategies
7. Add referral bonuses
8. Create tier-based rewards program
9. Support annual subscriptions
10. Add usage analytics and recommendations
