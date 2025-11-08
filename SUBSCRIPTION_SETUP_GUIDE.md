# Subscription Module - Setup & Configuration Guide

## Overview
This guide helps you set up the Writer Subscription Module for your project.

## Installation

### 1. Install Dependencies (if not already installed)
```bash
npm install
```

All required packages are already in package.json:
- `mongoose`: ^8.13.2 (for database models)
- `express`: ^5.1.0 (for routing)
- `jsonwebtoken`: ^9.0.2 (for authentication)

### 2. Environment Variables

Add these variables to your `.env` file:

```env
# Existing variables
MONGO_URI=mongodb://your_mongo_uri
JWT_SECRET=your_jwt_secret
PORT=3000

# Razorpay Configuration (if using Razorpay)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# RevenueCat Configuration (if using RevenueCat)
REVENUCAT_API_KEY=your_revenucat_api_key
REVENUCAT_SECRET=your_revenucat_secret

# App Store Configuration (if using App Store)
APP_STORE_BUNDLE_ID=com.yourapp.ios
APP_STORE_SHARED_SECRET=your_app_store_shared_secret

# Play Store Configuration (if using Play Store)
PLAY_STORE_PACKAGE_NAME=com.yourapp.android
PLAY_STORE_SERVICE_ACCOUNT=your_service_account_json

# Email Configuration (for payment receipts, etc)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Application URLs
APP_URL=https://yourapp.com
API_URL=https://api.yourapp.com
WEBHOOK_SECRET=your_webhook_secret_key
```

### 3. Database Initialization

#### Initialize the database with default subscription plans:

```bash
# From project root
node scripts/seed_subscription_plans.js
```

This will create 4 subscription plans:
- **Free Plan**: ₹0 for 30 days (1-month trial)
- **Basic Plan**: ₹99.99 for 30 days
- **Premium Plan**: ₹299.99 for 30 days
- **Pro Plan**: ₹599.99 for 30 days

## Module Structure

```
src/
├── models/
│   ├── subscriptionPlan.js      # Subscription plan schema
│   ├── writerSubscription.js    # Writer subscription schema
│   └── subscriptionPayment.js   # Payment transaction schema
├── controllers/
│   └── subscriptionController.js # Business logic
├── routes/
│   └── subscription_route.js    # API endpoints
├── middleware/
│   └── subscriptionMiddleware.js # Auth & feature checking
└── utils/
    └── subscriptionUtils.js     # Helper functions

scripts/
└── seed_subscription_plans.js   # Database seeding script
```

## API Endpoints Summary

### Public Endpoints (No Auth Required)
- `GET /api/subscription/plans` - Get all plans
- `GET /api/subscription/plans/:planId` - Get plan details
- `POST /api/subscription/webhook` - Payment provider webhook

### Protected Endpoints (Auth Required)
- `POST /api/subscription/activate-free-plan` - Activate free trial
- `GET /api/subscription/current` - Get current subscription
- `POST /api/subscription/initiate-payment` - Start payment process
- `POST /api/subscription/verify-payment` - Complete payment
- `GET /api/subscription/payment-history` - Payment records
- `POST /api/subscription/cancel` - Cancel subscription
- `POST /api/subscription/check-action` - Verify action permission
- `GET /api/subscription/earnings-multiplier` - Get earnings rate

## Integration with Existing Code

### 1. Using Subscription Middleware in Routes

```javascript
// In your chapter_route.js or novel_route.js
const { checkActiveSubscription, checkFeature } = require('../middleware/subscriptionMiddleware');
const { verifyToken } = require('../middleware/authMiddleware');

// Require active subscription to publish
router.post('/publish', verifyToken, checkActiveSubscription, publishChapter);

// Require monetization feature
router.post('/monetize', verifyToken, checkFeature('canMonetize'), monetizeNovel);
```

### 2. Using Subscription Utils in Controllers

```javascript
// In your novelController.js
const { canPerformAction, getEarningsMultiplier } = require('../utils/subscriptionUtils');

exports.createNovel = async (req, res) => {
  try {
    const writerId = req.user.id;
    
    // Check if writer can create another novel
    const novelCount = await Novel.countDocuments({ author: writerId });
    const permission = await canPerformAction(writerId, 'create_novel', novelCount);
    
    if (!permission.allowed) {
      return res.status(403).json({
        success: false,
        message: permission.reason
      });
    }
    
    // Get earnings multiplier for future revenue calculations
    const multiplier = await getEarningsMultiplier(writerId);
    
    // Create novel with multiplier info
    const novel = new Novel({
      ...novelData,
      author: writerId,
      earningsMultiplier: multiplier
    });
    
    await novel.save();
    res.json({ success: true, novel });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
```

### 3. Using Subscription in User Controller

When a user signs up as a writer, initialize their subscription:

```javascript
const WriterSubscription = require('../models/writerSubscription');
const SubscriptionPlan = require('../models/subscriptionPlan');

exports.becomeWriter = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if already a writer
    const existing = await WriterSubscription.findOne({ writer: userId });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Already a writer' 
      });
    }
    
    // Get free plan
    const freePlan = await SubscriptionPlan.findOne({ name: 'free' });
    
    // Auto-activate free trial for new writers
    const subscription = new WriterSubscription({
      writer: userId,
      currentPlan: freePlan._id,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'active',
      isFreeTrial: true,
      freeTrialUsageCount: 1
    });
    
    await subscription.save();
    
    // Update user record
    const user = await User.findById(userId);
    user.isWriter = true;
    user.writerSubscription = subscription._id;
    user.writerStatus = 'active';
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Welcome! You have activated 1 month free trial',
      subscription 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
```

## Testing the Module

### Test with cURL

#### 1. Get all plans
```bash
curl -X GET http://localhost:3000/api/subscription/plans
```

#### 2. Activate free plan
```bash
curl -X POST http://localhost:3000/api/subscription/activate-free-plan \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

#### 3. Get current subscription
```bash
curl -X GET http://localhost:3000/api/subscription/current \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 4. Check action permission
```bash
curl -X POST http://localhost:3000/api/subscription/check-action \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "create_novel",
    "currentCount": 0
  }'
```

### Test with Postman

1. Create a new collection
2. Add requests to the endpoints
3. Set `Authorization` header with your JWT token
4. Use the responses provided in the documentation

## Payment Provider Integration

### Razorpay Setup

1. Create account at [razorpay.com](https://razorpay.com)
2. Get your Key ID and Key Secret from dashboard
3. Add to `.env`:
   ```
   RAZORPAY_KEY_ID=your_key_id
   RAZORPAY_KEY_SECRET=your_key_secret
   ```

4. In your frontend, install Razorpay:
   ```javascript
   <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
   ```

### RevenueCat Setup

1. Create account at [revenuecat.com](https://revenuecat.com)
2. Get your API Key
3. Add to `.env`:
   ```
   REVENUCAT_API_KEY=your_api_key
   ```

4. Install RevenueCat SDK in your mobile app

### App Store Setup

1. Configure in-app purchases in App Store Connect
2. Get shared secret
3. Add to `.env`:
   ```
   APP_STORE_SHARED_SECRET=your_shared_secret
   ```

### Play Store Setup

1. Configure in-app billing in Google Play Console
2. Create service account
3. Add to `.env`:
   ```
   PLAY_STORE_SERVICE_ACCOUNT=your_service_account_json
   ```

## Monitoring & Maintenance

### Check Subscription Expiry

Add a cron job to update expired subscriptions:

```javascript
// In a separate cron job file
const cron = require('node-cron');
const WriterSubscription = require('../models/writerSubscription');

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  const expiredCount = await WriterSubscription.updateMany(
    {
      status: 'active',
      expiryDate: { $lte: new Date() }
    },
    {
      status: 'expired'
    }
  );
  console.log(`Updated ${expiredCount.modifiedCount} expired subscriptions`);
});
```

### View Subscription Stats

```javascript
// Add this endpoint to admin routes
router.get('/admin/subscription-stats', verifyToken, checkIsAdmin, async (req, res) => {
  const stats = await WriterSubscription.aggregate([
    {
      $group: {
        _id: '$currentPlan',
        count: { $sum: 1 },
        activeCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'subscriptionplans',
        localField: '_id',
        foreignField: '_id',
        as: 'plan'
      }
    }
  ]);
  
  res.json({ success: true, stats });
});
```

## Common Issues & Solutions

### Issue: Free plan not found when seeding
**Solution**: Make sure MongoDB is connected and clean before running seed script

```bash
# First verify connection
node -e "require('mongoose').connect(process.env.MONGO_URI).then(() => console.log('Connected')).catch(e => console.log('Error:', e))"

# Then seed
node scripts/seed_subscription_plans.js
```

### Issue: Payment verification failing
**Solution**: Verify that:
1. Payment ID is correct
2. Transaction ID matches payment provider
3. User authentication token is valid
4. Payment record exists in database

### Issue: Subscription status not updating
**Solution**: Check that:
1. Expiry date is set correctly
2. Cron job for checking expiry is running
3. Database indexes are created (run again: `npm run seed-plans`)

## Performance Optimization

### Add Database Indexes (Already in models)
```javascript
// In WriterSubscription schema
WriterSubscriptionSchema.index({ writer: 1 });
WriterSubscriptionSchema.index({ expiryDate: 1 });
WriterSubscriptionSchema.index({ status: 1, expiryDate: 1 });
```

### Cache Subscription Plans
```javascript
// In subscriptionUtils.js
const cache = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

exports.getCachedPlans = async () => {
  const cacheKey = 'subscription_plans';
  
  if (cache[cacheKey] && Date.now() - cache[cacheKey].time < CACHE_TTL) {
    return cache[cacheKey].data;
  }
  
  const plans = await subscriptionUtils.getAllPlans();
  cache[cacheKey] = { data: plans, time: Date.now() };
  
  return plans;
};
```

## Security Considerations

1. **Verify webhook signatures** from payment providers
2. **Use HTTPS** for all payment operations
3. **Never expose API keys** in frontend code
4. **Validate payment amounts** before processing
5. **Implement rate limiting** on payment endpoints
6. **Log all payment transactions** for audit trails
7. **Use environment variables** for sensitive data
8. **Implement CSRF protection** for payment forms

## Next Steps

1. ✅ Seed subscription plans: `node scripts/seed_subscription_plans.js`
2. ✅ Test free plan activation with your auth token
3. ✅ Integrate middleware in existing routes
4. ✅ Set up payment provider webhooks
5. ✅ Create frontend payment flow
6. ✅ Test end-to-end subscription flow
7. ✅ Monitor subscription expiry
8. ✅ Set up email notifications

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the API documentation
3. Check MongoDB logs
4. Review payment provider logs
5. Check application logs

---

**Module Created**: Subscription System v1.0
**Last Updated**: November 2025
**Status**: Ready for Production
