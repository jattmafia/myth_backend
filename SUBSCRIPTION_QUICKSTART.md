# 🚀 Writer Subscription Module - Quick Start Guide

## 5-Minute Setup

### 1. Initialize Database (1 minute)
```bash
cd d:\backends\myth_backend
node scripts/seed_subscription_plans.js
```

✅ Creates 4 subscription plans (Free, Basic, Premium, Pro)

### 2. Get a JWT Token
Use your existing auth system to get a token for testing.

### 3. Test Free Plan Activation (1 minute)
```bash
curl -X POST http://localhost:3000/api/subscription/activate-free-plan \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

✅ Writer gets 1-month free trial

### 4. Check Current Subscription (1 minute)
```bash
curl -X GET http://localhost:3000/api/subscription/current \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

✅ See all subscription details

### 5. Get Available Plans (1 minute)
```bash
curl -X GET http://localhost:3000/api/subscription/plans
```

✅ List all available subscription tiers

---

## 📁 What Was Created

### Models (3 files in `src/models/`)
- `subscriptionPlan.js` - Plan definitions (Free, Basic, Premium, Pro)
- `writerSubscription.js` - Individual writer subscriptions
- `subscriptionPayment.js` - Payment transaction history

### Controller (1 file in `src/controllers/`)
- `subscriptionController.js` - 11 endpoints for subscription management

### Middleware (1 file in `src/middleware/`)
- `subscriptionMiddleware.js` - Reusable auth & feature-checking middleware

### Utilities (1 file in `src/utils/`)
- `subscriptionUtils.js` - 20+ helper functions

### Routes (1 file in `src/routes/`)
- `subscription_route.js` - REST API endpoints

### Scripts (1 file in `scripts/`)
- `seed_subscription_plans.js` - Initialize database with plans

### Documentation (3 files)
- `SUBSCRIPTION_MODULE_SUMMARY.md` - Complete overview (YOU ARE HERE)
- `SUBSCRIPTION_API_DOCUMENTATION.md` - Full API reference
- `SUBSCRIPTION_SETUP_GUIDE.md` - Detailed setup guide

---

## 🎯 Key Features

### ✅ Free Trial
```javascript
// New writers get 1 month free
POST /api/subscription/activate-free-plan
```

### ✅ 4 Subscription Tiers
- **Free**: ₹0, 5 novels, no monetization, 1.0x earnings
- **Basic**: ₹99.99, unlimited novels, can monetize, 1.1x earnings  
- **Premium**: ₹299.99, all features, 1.25x earnings
- **Pro**: ₹599.99, advanced features, 1.5x earnings

### ✅ Multiple Payment Options
- Razorpay
- RevenueCat
- App Store (iOS)
- Play Store (Android)

### ✅ Usage Limits Per Plan
- Max novels (Free: 5, others: unlimited)
- Max chapters per novel
- Upload size limits
- Feature flags (monetize, analytics, AI, etc.)

### ✅ Earnings Multipliers
Higher subscription = more money per view/read

| Plan | Multiplier | Platform Fee |
|------|-----------|--------------|
| Free | 1.0x | 50% |
| Basic | 1.1x | 30% |
| Premium | 1.25x | 20% |
| Pro | 1.5x | 15% |

---

## 🔗 11 API Endpoints

### Public (No Auth)
1. `GET /api/subscription/plans` - List all plans
2. `GET /api/subscription/plans/:planId` - Plan details
3. `POST /api/subscription/webhook` - Payment provider webhook

### Protected (Requires JWT)
4. `POST /api/subscription/activate-free-plan` - Activate free trial
5. `GET /api/subscription/current` - Get my subscription
6. `POST /api/subscription/initiate-payment` - Start payment process
7. `POST /api/subscription/verify-payment` - Complete payment
8. `GET /api/subscription/payment-history` - All my payments
9. `POST /api/subscription/cancel` - Cancel subscription
10. `POST /api/subscription/check-action` - Can I do this action?
11. `GET /api/subscription/earnings-multiplier` - My earnings rate

---

## 💻 Usage Examples

### Protect a Route with Subscription
```javascript
const { checkActiveSubscription } = require('./middleware/subscriptionMiddleware');

// Only active subscribers can publish
router.post('/publish-novel', checkActiveSubscription, publishNovel);
```

### Check Feature Permission
```javascript
const { checkFeature } = require('./middleware/subscriptionMiddleware');

// Only Premium+ can use AI
router.post('/ai-assist', checkFeature('hasAIAssistance'), useAI);
```

### Check Action Limits
```javascript
const { canPerformAction } = require('./utils/subscriptionUtils');

const novelCount = await Novel.count({ author: userId });
const result = await canPerformAction(userId, 'create_novel', novelCount);

if (!result.allowed) {
  return res.status(403).json({ 
    message: result.reason,  // "Maximum novels limit reached (5)"
    limit: result.limit      // 5
  });
}
```

### Get Earnings Multiplier
```javascript
const { getEarningsMultiplier } = require('./utils/subscriptionUtils');

const multiplier = await getEarningsMultiplier(writerId);
const earnings = baseEarnings * multiplier;
```

---

## 📊 Subscription Plans Explained

### Free Plan (₹0/month)
```
✅ 1 month trial (non-renewable)
✅ Create up to 5 novels
✅ 50 chapters per novel
✅ Basic reader interaction
❌ Cannot monetize
❌ No analytics
❌ No AI assistance
→ Earnings: 1.0x multiplier
→ Platform takes: 50%
```

### Basic Plan (₹99.99/month)
```
✅ Unlimited novels
✅ Unlimited chapters
✅ Can monetize novels
✅ Basic analytics
✅ Custom covers
❌ No chapter scheduling
❌ No AI assistance
→ Earnings: 1.1x multiplier (10% bonus)
→ Platform takes: 30%
```

### Premium Plan (₹299.99/month)
```
✅ Everything in Basic
✅ Advanced analytics
✅ Chapter scheduling
✅ AI assistance
✅ Priority support
❌ No white-label
→ Earnings: 1.25x multiplier (25% bonus)
→ Platform takes: 20%
```

### Pro Plan (₹599.99/month)
```
✅ Everything in Premium
✅ Advanced AI suite
✅ Predictive analytics
✅ Marketing tools
✅ 24/7 support
✅ API access
✅ White-label options
→ Earnings: 1.5x multiplier (50% bonus)
→ Platform takes: 15%
```

---

## 🔄 Payment Flow

### Step 1: Initiate Payment
```javascript
const response = await fetch('/api/subscription/initiate-payment', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    planId: 'premium_plan_id',
    paymentMethod: 'razorpay'
  })
});
const { payment } = await response.json();
```

### Step 2: Process Payment on Frontend
Using Razorpay, RevenueCat, or App Store - payment gateway handles this

### Step 3: Verify Payment
```javascript
const verify = await fetch('/api/subscription/verify-payment', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    paymentId: payment.paymentId,
    transactionId: 'razorpay_transaction_id',
    paymentMethod: 'razorpay',
    gatewayResponse: { /* ... */ }
  })
});
const result = await verify.json();
// result.subscription now has active status
```

---

## 📋 Updated User Model

New writer-related fields added to User:

```javascript
{
  // Writer identification
  isWriter: Boolean,
  writerSubscription: ObjectId,
  penName: String,
  writerBio: String,
  writerStatus: String,
  
  // Earnings
  totalEarnings: Number,
  publishedNovels: Number,
  lastEarningsWithdrawalDate: Date,
  
  // Payment preferences
  preferredPaymentMethod: String,
  bankDetails: {
    accountNumber: String,
    accountHolderName: String,
    ifscCode: String,
    bankName: String
  }
}
```

---

## 🧪 Testing Checklist

```bash
# 1. Seed plans
node scripts/seed_subscription_plans.js

# 2. Get all plans (no auth needed)
curl http://localhost:3000/api/subscription/plans

# 3. Activate free plan (need JWT token)
curl -X POST http://localhost:3000/api/subscription/activate-free-plan \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Check current subscription
curl -X GET http://localhost:3000/api/subscription/current \
  -H "Authorization: Bearer YOUR_TOKEN"

# 5. Check if action allowed
curl -X POST http://localhost:3000/api/subscription/check-action \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"actionType":"create_novel","currentCount":0}'

# 6. Get earnings multiplier
curl -X GET http://localhost:3000/api/subscription/earnings-multiplier \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔐 Security

✅ JWT token verification on all protected endpoints  
✅ Payment transaction verification  
✅ Webhook signature validation  
✅ Subscription status checks  
✅ Feature permission validation  

---

## 📂 File Structure

```
src/
├── models/
│   ├── subscriptionPlan.js
│   ├── writerSubscription.js
│   └── subscriptionPayment.js
├── controllers/
│   └── subscriptionController.js
├── middleware/
│   └── subscriptionMiddleware.js
├── routes/
│   └── subscription_route.js
└── utils/
    └── subscriptionUtils.js

scripts/
└── seed_subscription_plans.js

Documentation:
├── SUBSCRIPTION_MODULE_SUMMARY.md (overview)
├── SUBSCRIPTION_API_DOCUMENTATION.md (full reference)
├── SUBSCRIPTION_SETUP_GUIDE.md (setup guide)
└── SUBSCRIPTION_QUICKSTART.md (this file)
```

---

## 💡 Common Tasks

### Task: Check if user can create a novel
```javascript
const { canPerformAction } = require('./utils/subscriptionUtils');

const result = await canPerformAction(userId, 'create_novel', currentNovelCount);
if (!result.allowed) {
  // Show error: result.reason
}
```

### Task: Get user's earnings multiplier
```javascript
const { getEarningsMultiplier } = require('./utils/subscriptionUtils');

const multiplier = await getEarningsMultiplier(userId);
const totalEarnings = baseEarnings * multiplier;
```

### Task: Protect a feature
```javascript
router.post('/monetize', checkFeature('canMonetize'), monetizeNovel);
```

### Task: Require active subscription
```javascript
router.post('/publish', checkActiveSubscription, publishNovel);
```

---

## 🚀 Environment Setup

Create/update `.env`:
```env
MONGO_URI=mongodb://localhost:27017/myth_backend
JWT_SECRET=your_jwt_secret_key
PORT=3000

# Payment Provider Keys (add only ones you use)
RAZORPAY_KEY_ID=your_key
RAZORPAY_KEY_SECRET=your_secret
REVENUCAT_API_KEY=your_api_key
APP_STORE_SHARED_SECRET=your_secret
PLAY_STORE_SERVICE_ACCOUNT=your_json
```

---

## 📞 Need Help?

See full documentation:
1. **API Docs**: `SUBSCRIPTION_API_DOCUMENTATION.md`
2. **Setup Guide**: `SUBSCRIPTION_SETUP_GUIDE.md`
3. **Full Summary**: `SUBSCRIPTION_MODULE_SUMMARY.md`

---

## ✅ What's Ready

- ✅ 3 Database models
- ✅ 1 Controller with 11 endpoints
- ✅ 1 Middleware with 4 functions
- ✅ 20+ Utility functions
- ✅ Full REST API
- ✅ 4 Subscription plans (Free, Basic, Premium, Pro)
- ✅ Free 1-month trial
- ✅ Multi-provider payment support
- ✅ Usage limits and feature gating
- ✅ Earnings multipliers
- ✅ Complete documentation

---

## 🎉 You're Ready!

1. Run: `node scripts/seed_subscription_plans.js`
2. Get your JWT token
3. Test endpoints
4. Integrate middleware in existing routes
5. Build frontend payment flow
6. Deploy! 🚀

---

**Happy coding!** 💻

Created: November 2025  
Status: Production Ready ✅
