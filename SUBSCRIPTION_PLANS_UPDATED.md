# Updated Subscription Plans - Revenue Model

## New Plan Structure

### Basic Plan (NOW: Free for 1 Month)
- **Duration**: 30 days
- **Price**: ₹0 (FREE for first month)
- **After Trial**: Converts to ₹0 initially, can be paid subscription later
- **Revenue Split**: 
  - **Writers get: 90%** ✅
  - **App gets: 10%**
- **Auto-Renewal**: Yes (continues after first month)
- **Features**:
  - ✅ Unlimited novels
  - ✅ Unlimited chapters
  - ✅ Monetization enabled (earn 90%)
  - ✅ Custom covers
  - ✅ Basic analytics
  - 20MB max upload per chapter

---

### Premium Plan
- **Price**: ₹299.99/month
- **Revenue Split**: 
  - Writers get: 80% (20% to app)
  - +1.25x earnings multiplier
- **Features**: All Basic + advanced analytics, scheduling, AI, priority support

---

### Pro Plan
- **Price**: ₹599.99/month
- **Revenue Split**:
  - Writers get: 85% (15% to app)
  - +1.5x earnings multiplier
- **Features**: All Premium + enhanced AI, predictive analytics, marketing tools, API access, white label

---

## How It Works

### For New Writers:

```
Sign Up
  ↓
Activate Free Trial (Basic Plan)
  ↓
Gets 1 month FREE with 90% revenue split
  ↓
Can immediately start monetizing
  ↓
After 30 days:
  - Option 1: Continue with Basic plan (upgrade to paid later)
  - Option 2: Upgrade to Premium/Pro for more features
  - Option 3: Let subscription pause
```

### Revenue Calculation:

**Example: Writer earns ₹1000 from readers in first month**

| Plan | Writer Gets | App Gets |
|------|------------|----------|
| Basic | ₹900 (90%) | ₹100 (10%) |
| Premium | ₹800 (80%) | ₹200 (20%) |
| Pro | ₹850 (85%) | ₹150 (15%) |

*Plus multipliers on Premium/Pro (1.25x, 1.5x)*

---

## Database Changes

### Seed Script Updated
Run to create new plans:
```bash
node scripts/seed_subscription_plans.js
```

Will create:
- ✅ Basic Plan (₹0, free for 1 month, 90/10 split)
- ✅ Premium Plan (₹299.99/month, 80/20 split)
- ✅ Pro Plan (₹599.99/month, 85/15 split)

---

## API Response Example

When writer activates free plan:

```json
{
  "success": true,
  "message": "Basic Plan activated for free - 1 month trial (90% revenue for writers)",
  "subscription": {
    "id": "sub_123",
    "plan": {
      "name": "basic",
      "displayName": "Basic Plan",
      "platformFeePercentage": 10
    },
    "status": "active",
    "isFreeTrial": true,
    "daysRemaining": 30,
    "trialEndsAt": "2024-12-07T10:00:00Z",
    "revenueShare": {
      "writerPercentage": 90,
      "appPercentage": 10,
      "message": "You earn 90% of all revenue from your novels"
    }
  }
}
```

---

## Key Benefits

✅ **Writers get maximum revenue** (90%) right from start  
✅ **No initial payment** - 1 month free to try  
✅ **Monetization enabled immediately** - writers earn from day 1  
✅ **Premium/Pro for advanced features** - writers can upgrade anytime  
✅ **Clear revenue transparency** - writers know exactly what they earn  

---

## Implementation Notes

1. **Free Trial**: Uses `isFreeTrial: true` flag
2. **Auto-renewal**: Set to `true` (continues after trial)
3. **Revenue Split**: Controlled by `platformFeePercentage` field
4. **Earnings Multiplier**: 
   - Basic: 1.0x (no bonus)
   - Premium: 1.25x (25% boost)
   - Pro: 1.5x (50% boost)

---

## Testing

To test the new setup:

```bash
# 1. Seed new plans
node scripts/seed_subscription_plans.js

# 2. Activate free trial
curl -X POST http://localhost:3000/api/subscription/activate-free-plan \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Get current subscription
curl -X GET http://localhost:3000/api/subscription/current \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

**Status**: Ready for Production ✅
