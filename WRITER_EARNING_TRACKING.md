# Writer Earning Tracking System

## Overview
The writer earning tracking system now includes complete subscription status, platform fee percentages, and monetization eligibility tracking.

---

## Earning Rules by Subscription Status

### **WITH PREMIUM SUBSCRIPTION (₹199/month)**
- ✅ **No view requirements** on chapters 1-5
- ✅ **Earnings start immediately from chapter 6**
- ✅ **Platform fee: 10%**
- ✅ **Writer earning: 90%**
- ✅ **Stored directly in WriterEarning record**

**Example:**
- Coin unlock: ₹100 → Writer gets ₹90 (90%), App gets ₹10 (10%)
- Ad unlock: Count recorded, eCPM calculated with 90% share

---

### **WITHOUT SUBSCRIPTION (Free)**
- ❌ **Must have 1,000 views on chapters 1-5**
- ✅ **Earnings ONLY from chapter 6+** (after 1K view requirement met)
- ✅ **Platform fee: 30%**
- ✅ **Writer earning: 70%**
- ✅ **View requirement tracked in record**

**Example:**
- Chapter 1-5 total views < 1,000 → No earnings recorded
- Chapter 1-5 total views ≥ 1,000 → Chapter 6+ earnings recorded
- Coin unlock: ₹100 → Writer gets ₹70 (70%), App gets ₹30 (30%)

---

## WriterEarning Record Structure

### **Core Fields**
```javascript
{
  writer: ObjectId,           // Writer ID
  novel: ObjectId,            // Novel ID
  chapter: ObjectId,          // Chapter ID
  earningType: String,        // "coin", "ad", or "interstitial"
  amount: Number,             // Total amount earned by writer
  count: Number,              // Unlock count (for ads) or 1 (for coin)
  impressions: Number         // For interstitial ads
}
```

### **NEW: Subscription & Monetization Tracking**
```javascript
{
  // SUBSCRIPTION STATUS AT TIME OF EARNING
  hasSubscription: Boolean,                    // true/false
  subscriptionId: ObjectId,                    // Link to WriterSubscription
  
  // PLATFORM FEE & REVENUE SPLIT
  platformFeePercentage: Number,               // 10% (with sub) or 30% (without)
  writerPercentageEarned: Number,              // 90% (with sub) or 70% (without)
  
  // MONETIZATION ELIGIBILITY
  viewsRequirementMet: Boolean,                // true if meets criteria
  totalViewsOnFreeChapters: Number,            // Views on chapters 1-5
  chapterNumber: Number,                       // Chapter number for quick filtering
  
  // FOR COIN EARNINGS
  coinPrice: Number,                           // Total coin price of unlock
  coinsRequiredToUnlock: Number,               // Coins user paid to unlock
  
  // TIMESTAMPS
  createdAt: Date,
  updatedAt: Date
}
```

---

## Example Records

### **Scenario 1: Subscribed Writer - Coin Unlock (Chapter 8)**
```json
{
  "writer": "user123",
  "novel": "novel456",
  "chapter": "ch789",
  "earningType": "coin",
  "amount": 90,                           // ₹90 (90% of ₹100)
  "count": 1,
  "hasSubscription": true,
  "subscriptionId": "sub123",
  "platformFeePercentage": 10,
  "writerPercentageEarned": 90,
  "viewsRequirementMet": true,            // No requirement with subscription
  "totalViewsOnFreeChapters": 500,        // Not required to check, but stored
  "coinPrice": 100,                       // Reader paid ₹100
  "coinsRequiredToUnlock": 80,
  "chapterNumber": 8,
  "createdAt": "2025-11-08T10:30:00Z"
}
```

### **Scenario 2: Non-Subscribed Writer - Coin Unlock (Chapter 8, Views Met)**
```json
{
  "writer": "user456",
  "novel": "novel789",
  "chapter": "ch101",
  "earningType": "coin",
  "amount": 70,                           // ₹70 (70% of ₹100)
  "count": 1,
  "hasSubscription": false,
  "subscriptionId": null,
  "platformFeePercentage": 30,
  "writerPercentageEarned": 70,
  "viewsRequirementMet": true,            // ✅ Has 1,050 views on chapters 1-5
  "totalViewsOnFreeChapters": 1050,       // Meets 1K requirement
  "coinPrice": 100,                       // Reader paid ₹100
  "coinsRequiredToUnlock": 80,
  "chapterNumber": 8,
  "createdAt": "2025-11-08T10:35:00Z"
}
```

### **Scenario 3: Non-Subscribed Writer - Ad Unlock (Chapter 6, Views NOT Met)**
```json
{
  "earningType": "ad",
  "count": 0,                             // NOT RECORDED
  "hasSubscription": false,
  "platformFeePercentage": 30,
  "writerPercentageEarned": 70,
  "viewsRequirementMet": false,           // ❌ Only 850 views on chapters 1-5
  "totalViewsOnFreeChapters": 850,        // Does NOT meet 1K requirement
  "chapterNumber": 6
  // This earning is NOT stored at all
}
```

### **Scenario 4: Subscribed Writer - Ad Unlock (Chapter 6)**
```json
{
  "writer": "user789",
  "novel": "novel101",
  "chapter": "ch202",
  "earningType": "ad",
  "count": 1,
  "hasSubscription": true,
  "subscriptionId": "sub456",
  "platformFeePercentage": 10,
  "writerPercentageEarned": 90,
  "viewsRequirementMet": true,            // No requirement with subscription
  "totalViewsOnFreeChapters": 200,        // Requirement ignored
  "chapterNumber": 6,
  "createdAt": "2025-11-08T10:40:00Z"
  // Amount calculated based on eCPM: (count/1000) * ecpm * 0.9
}
```

---

## Revenue Calculation Examples

### **Coin Unlock - Subscribed Writer (₹100 coin price)**
| Item | Amount |
|------|--------|
| Coin Price | ₹100 |
| Writer (90%) | ₹90 ✅ |
| Platform (10%) | ₹10 |

### **Coin Unlock - Non-Subscribed Writer (₹100 coin price)**
| Item | Amount |
|------|--------|
| Coin Price | ₹100 |
| Writer (70%) | ₹70 ✅ |
| Platform (30%) | ₹30 |

### **Ad Unlock - Subscribed Writer (eCPM: ₹40 per 1000 unlocks)**
| Item | Amount |
|------|--------|
| 1,000 Ad Unlocks | ₹40 (eCPM) |
| Writer (90%) | ₹36 ✅ |
| Platform (10%) | ₹4 |

### **Ad Unlock - Non-Subscribed Writer (eCPM: ₹40 per 1000 unlocks)**
| Item | Amount |
|------|--------|
| 1,000 Ad Unlocks | ₹40 (eCPM) |
| Writer (70%) | ₹28 ✅ |
| Platform (30%) | ₹12 |

---

## API Response: Get Writer Earnings

```json
{
  "success": true,
  "data": {
    "totalEarnings": 160,
    "byType": {
      "coin": 160,
      "ad": 0,
      "interstitial": 0
    },
    "allEarnings": [
      {
        "novelId": "novel456",
        "novelTitle": "My Novel",
        "chapterId": "ch789",
        "chapterNumber": 8,
        "chapterTitle": "Chapter 8",
        "earningType": "coin",
        "amount": 90,
        "count": 1,
        "hasSubscription": true,
        "platformFeePercentage": 10,
        "writerPercentageEarned": 90,
        "viewsRequirementMet": true,
        "totalViewsOnFreeChapters": 500,
        "coinPrice": 100,
        "coinsRequiredToUnlock": 80,
        "createdAt": "2025-11-08T10:30:00Z"
      },
      {
        "novelId": "novel789",
        "novelTitle": "Another Novel",
        "chapterId": "ch101",
        "chapterNumber": 8,
        "chapterTitle": "Chapter 8",
        "earningType": "coin",
        "amount": 70,
        "count": 1,
        "hasSubscription": false,
        "platformFeePercentage": 30,
        "writerPercentageEarned": 70,
        "viewsRequirementMet": true,
        "totalViewsOnFreeChapters": 1050,
        "coinPrice": 100,
        "coinsRequiredToUnlock": 80,
        "createdAt": "2025-11-08T10:35:00Z"
      }
    ]
  }
}
```

---

## Monetization Eligibility Check (Existing Endpoint)

```
GET /api/writer-earning/check-monetization/:novelId
```

Response includes:
- View count on each of chapters 1-5
- Total published chapters
- Monetization status (true/false)
- Issues if not eligible

**Note:** Subscription bypass—if writer has active subscription, they bypass the 1K view requirement.

---

## Code Logic Summary

### **recordCoinEarning()**
1. Check if novel is paid ✅
2. Check writer's subscription status
3. If subscribed:
   - ✅ Allow chapter 6+ earnings immediately
   - ✅ Use 90% writer, 10% platform
4. If not subscribed:
   - ❌ Check 1K view requirement on chapters 1-5
   - ✅ Only allow chapter 6+ if requirement met
   - ✅ Use 70% writer, 30% platform
5. Store all metadata in record

### **recordAdEarning()**
- Same logic as coin earnings
- Increment count instead of calculating amount
- Amount calculated via eCPM rate later

---

## Database Indexes
```javascript
WriterEarningSchema.index({ writer: 1, novel: 1 });
WriterEarningSchema.index({ writer: 1, earningType: 1 });
WriterEarningSchema.index({ writer: 1, hasSubscription: 1 });  // NEW
WriterEarningSchema.index({ writer: 1, createdAt: -1 });
WriterEarningSchema.index({ novel: 1, earningType: 1 });
WriterEarningSchema.index({ viewsRequirementMet: 1 });         // NEW
```

---

## Testing Checklist

- [ ] Non-subscribed writer with <1K views cannot earn on chapter 6
- [ ] Non-subscribed writer with ≥1K views can earn on chapter 6+
- [ ] Subscribed writer can earn on chapter 6+ regardless of views
- [ ] Coin unlock stores correct platform fee (10% or 30%)
- [ ] Coin unlock calculates correct writer percentage (90% or 70%)
- [ ] Ad unlock increments count with correct fee structure
- [ ] WriterEarning record includes all metadata fields
- [ ] GET earnings endpoint returns all new fields

