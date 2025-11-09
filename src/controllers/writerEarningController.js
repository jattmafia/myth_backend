const mongoose = require('mongoose');
const Chapter = require('../models/chapter');
const Novel = require('../models/novel');
const WriterEarning = require('../models/writerEarning');
const User = require('../models/user');
const ChapterView = require('../models/chapterView');
const AdUnlockLog = require('../models/adUnlockLog');
const UnlockHistory = require('../models/unlockHistory');

// Check if writer's novel is eligible for monetization
// Criteria: 6+ chapters, each of 1-5 has 1K+ views
exports.checkMonetizationEligibility = async (req, res) => {
  try {
    const { novelId } = req.params;
    const userId = req.user.id;

    const novel = await Novel.findById(novelId);
    if (!novel) {
      return res.status(404).json({
        success: false,
        message: 'Novel not found'
      });
    }

    // Verify authorization
    if (novel.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized - Only author can check monetization'
      });
    }

    // Get all published chapters
    const chapters = await Chapter.find({ novel: novelId, status: 'published' });

    const eligibility = {
      novelId,
      isMonetized: false,
      hasMinChapters: chapters.length >= 6,
      totalChapters: chapters.length,
      freeChaptersViewRequirement: 1000,
      issues: []
    };

    if (chapters.length < 6) {
      eligibility.issues.push(`Need ${6 - chapters.length} more chapters (minimum 6 required)`);
    }

    // Check views on chapters 1-5
    const freeChapters = chapters.filter(c => c.chapterNumber >= 1 && c.chapterNumber <= 5);
    const freeChaptersWithViews = freeChapters.map(ch => ({
      chapterNumber: ch.chapterNumber,
      viewCount: ch.viewCount || 0,
      eligible: (ch.viewCount || 0) >= 1000
    }));

    const allFreeChaptersQualify = freeChaptersWithViews.every(ch => ch.eligible);

    if (!allFreeChaptersQualify) {
      const failedChapters = freeChaptersWithViews.filter(ch => !ch.eligible);
      failedChapters.forEach(ch => {
        eligibility.issues.push(`Chapter ${ch.chapterNumber}: ${ch.viewCount}/1000 views`);
      });
    }

    eligibility.freeChapters = freeChaptersWithViews;
    eligibility.isMonetized = eligibility.hasMinChapters && allFreeChaptersQualify;

    res.status(200).json({
      success: true,
      data: eligibility
    });

  } catch (error) {
    console.error('Error checking monetization eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Record coin earning when reader unlocks chapter via coin
exports.recordCoinEarning = async (novelId, writerId, chapterId, coinPrice) => {
  try {
    const Novel = require('../models/novel');
    const Chapter = require('../models/chapter');
    const WriterSubscription = require('../models/writerSubscription');
    const subscriptionUtils = require('../utils/subscriptionUtils');

    const novel = await Novel.findById(novelId);
    const chapter = await Chapter.findById(chapterId);

    if (!novel || !chapter) {
      console.error('Novel or chapter not found');
      return;
    }

    // Only record if novel is paid
    if (novel.pricingModel !== 'paid') {
      return;
    }

    // Check writer's subscription status
    const subscription = await WriterSubscription.findOne({ writer: writerId })
      .populate('currentPlan');

    const hasSubscription = subscriptionUtils.isSubscriptionActive(subscription);
    const platformFee = hasSubscription
      ? subscription.currentPlan?.platformFeePercentage || 10
      : 30; // 30% for non-subscribed
    const writerPercentage = 100 - platformFee;

    // For subscribed writers: no view requirement on chapters 1-5
    // For non-subscribed: need 1K views on chapters 1-5
    let viewsRequirementMet = false;
    let totalFreeViews = 0;

    if (hasSubscription) {
      // Subscribed: no view requirement, earn directly from chapter 6+
      viewsRequirementMet = chapter.chapterNumber >= 6 ? true : false;
    } else {
      // Non-subscribed: check 1K view requirement on chapters 1-5
      // Robust aggregation: cast chapterNumber to int, treat missing viewCount as 0
      const freeChaptersViews = await Chapter.aggregate([
        { $match: { novel: novel._id } },
        { $project: { chapterNumber: { $toInt: '$chapterNumber' }, viewCount: 1 } },
        { $match: { chapterNumber: { $gte: 1, $lte: 5 } } },
        { $group: { _id: null, totalViews: { $sum: { $ifNull: ['$viewCount', 0] } } } }
      ]);

      totalFreeViews = freeChaptersViews[0]?.totalViews || 0;
      console.debug(`freeChaptersViews aggregation result for novel ${novelId}:`, freeChaptersViews, 'totalFreeViews=', totalFreeViews);

      // Only chapters 6+ can have earnings, and only if 1K+ views on 1-5
      if (chapter.chapterNumber >= 6 && totalFreeViews >= 1000) {
        viewsRequirementMet = true;
      }
    }

    // Only record earning if conditions are met
    if (!viewsRequirementMet) {
      console.log(`Writer ${writerId} earning not recorded. Subscription: ${hasSubscription}, Views: ${totalFreeViews}, Chapter: ${chapter.chapterNumber}`);
      return;
    }

    // Default coin price (₹ per unlock) if not provided
    const defaultCoinPrice = parseFloat(process.env.COIN_PRICE) || 0.5; // ₹0.5 default
    const coinsPerRupee = parseFloat(process.env.COINS_PER_RUPEE) || 2; // 1 ₹ == 2 coins
    const coinPriceRupee = typeof coinPrice === 'number' && coinPrice > 0 ? coinPrice : defaultCoinPrice;

    // Work in paise to preserve precision
    const coinPricePaise = Math.round(coinPriceRupee * 100);
    const writerEarningPaise = Math.round(coinPricePaise * (writerPercentage / 100));

    // Coins required to unlock (based on coins per rupee)
    const coinsRequiredToUnlock = Math.round(coinPriceRupee * coinsPerRupee);

    await WriterEarning.findOneAndUpdate(
      { writer: writerId, novel: novelId, chapter: chapterId, earningType: 'coin' },
      {
        $inc: { amount: writerEarningPaise, count: 1 },
        $set: {
          hasSubscription,
          subscriptionId: subscription?._id || null,
          platformFeePercentage: platformFee,
          writerPercentageEarned: writerPercentage,
          viewsRequirementMet,
          totalViewsOnFreeChapters: totalFreeViews,
          coinPrice: coinPriceRupee,
          coinsRequiredToUnlock,
          chapterNumber: chapter.chapterNumber
        }
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Coin earning recorded: Writer ${writerId}, Amount(paise): ${writerEarningPaise}, (₹${(writerEarningPaise / 100).toFixed(2)}), Platform Fee: ${platformFee}%, Subscription: ${hasSubscription}`);
  } catch (error) {
    console.error('Error recording coin earning:', error);
  }
};

// Record ad earning when reader unlocks chapter via ad
exports.recordAdEarning = async (novelId, writerId, chapterId, adType = 'ad') => {
  try {
    const Novel = require('../models/novel');
    const Chapter = require('../models/chapter');
    const WriterSubscription = require('../models/writerSubscription');
    const subscriptionUtils = require('../utils/subscriptionUtils');

    const novel = await Novel.findById(novelId);
    const chapter = await Chapter.findById(chapterId);

    if (!novel || !chapter) {
      console.error('Novel or chapter not found');
      return;
    }

    // Only record if novel is paid
    if (novel.pricingModel !== 'paid') {
      return;
    }

    // Check writer's subscription status
    const subscription = await WriterSubscription.findOne({ writer: writerId })
      .populate('currentPlan');

    const hasSubscription = subscriptionUtils.isSubscriptionActive(subscription);
    const platformFee = hasSubscription
      ? subscription.currentPlan?.platformFeePercentage || 10
      : 30; // 30% for non-subscribed
    const writerPercentage = 100 - platformFee;

    // For subscribed writers: no view requirement on chapters 1-5
    // For non-subscribed: need 1K views on chapters 1-5
    let viewsRequirementMet = false;
    let totalFreeViews = 0;

    if (hasSubscription) {
      // Subscribed: no view requirement, earn directly from chapter 6+
      viewsRequirementMet = chapter.chapterNumber >= 6 ? true : false;
    } else {
      // Non-subscribed: check 1K view requirement on chapters 1-5
      // Robust aggregation: cast chapterNumber to int, treat missing viewCount as 0
      const freeChaptersViews = await Chapter.aggregate([
        { $match: { novel: novel._id } },
        { $project: { chapterNumber: { $toInt: '$chapterNumber' }, viewCount: 1 } },
        { $match: { chapterNumber: { $gte: 1, $lte: 5 } } },
        { $group: { _id: null, totalViews: { $sum: { $ifNull: ['$viewCount', 0] } } } }
      ]);

      totalFreeViews = freeChaptersViews[0]?.totalViews || 0;
      console.debug(`freeChaptersViews aggregation result for novel ${novelId}:`, freeChaptersViews, 'totalFreeViews=', totalFreeViews);

      // Only chapters 6+ can have earnings, and only if 1K+ views on 1-5
      if (chapter.chapterNumber >= 6 && totalFreeViews >= 1000) {
        viewsRequirementMet = true;
      }
    }

    // Only record earning if conditions are met
    if (!viewsRequirementMet) {
      console.log(`Writer ${writerId} ad earning not recorded. Subscription: ${hasSubscription}, Views: ${totalFreeViews}, Chapter: ${chapter.chapterNumber}`);
      return;
    }

    // Compute estimated ad amount per unlock and persist it along with the count.
    // Use environment-configured eCPM if provided, otherwise default to ₹40 per 1000 unlocks.
    const defaultEcpm = parseFloat(process.env.DEFAULT_ECPM_RATE) || 40;
    const perUnlockRupee = defaultEcpm / 1000; // rupees per unlock
    const perUnlockPaise = Math.round(perUnlockRupee * 100);
    const writerPerUnlockPaise = Math.round(perUnlockPaise * (writerPercentage / 100));
    // Each call to recordAdEarning represents a single unlock, so estimatedAmountPaise reflects one unlock.
    const estimatedAmountPaise = writerPerUnlockPaise;

    await WriterEarning.findOneAndUpdate(
      { writer: writerId, novel: novelId, chapter: chapterId, earningType: adType },
      {
        $inc: { count: 1, amount: estimatedAmountPaise },
        $set: {
          hasSubscription,
          subscriptionId: subscription?._id || null,
          platformFeePercentage: platformFee,
          writerPercentageEarned: writerPercentage,
          viewsRequirementMet,
          totalViewsOnFreeChapters: totalFreeViews,
          chapterNumber: chapter.chapterNumber
        }
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Ad earning recorded: Writer ${writerId}, Estimated Amount(paise): ${estimatedAmountPaise}, (₹${(estimatedAmountPaise / 100).toFixed(2)}), Platform Fee: ${platformFee}%, Subscription: ${hasSubscription}`);
  } catch (error) {
    console.error('Error recording ad earning:', error);
  }
};

// Get total earnings for a writer (all novels)
exports.getWriterEarnings = async (req, res) => {
  try {
    const userId = req.user.id;

    // eCPM rate for ad earnings (₹ per 1000 unlocks). Can be passed as query param.
    const { ecpmRate = 40 } = req.query; // default ₹40 per 1000
    const ecpm = parseFloat(ecpmRate) || 40;

    // Get all earnings (include novel totalViews)
    const earnings = await WriterEarning.find({ writer: userId })
      .populate('novel', 'title totalViews')
      .populate('chapter', 'chapterNumber title')
      .populate('subscriptionId', 'status currentPlan');

    // Group by earning type
    let totalByType = {
      coin: 0,
      ad: 0,
      interstitial: 0
    };

    let novelEarnings = {};

    // When ad records only have counts, estimate their value using eCPM and the recorded writer percentage.
    // Be defensive: populated `novel` or `chapter` may be null if referenced documents were deleted. Handle gracefully.
    earnings.forEach(earning => {
      let contribution = 0;

      if (earning.earningType === 'ad') {
        // If an explicit amount was stored, use it; otherwise estimate from count.
        if (earning.amount && earning.amount > 0) {
          // stored in paise -> convert to rupees
          contribution = (earning.amount || 0) / 100;
        } else {
          const unlocks = earning.count || 0;
          const writerPct = (typeof earning.writerPercentageEarned === 'number') ? earning.writerPercentageEarned : 70;
          const perUnlock = ecpm / 1000; // rupees per unlock
          const writerPerUnlock = perUnlock * (writerPct / 100);
          contribution = +(unlocks * writerPerUnlock).toFixed(2);
        }
      } else if (earning.earningType === 'interstitial') {
        // For interstitials we currently store impressions; fall back to amount if present
        contribution = (earning.amount || 0) / 100;
      } else {
        // coin and other types: amount represents writer net (already stored)
        contribution = (earning.amount || 0) / 100;
      }

      totalByType[earning.earningType] = (totalByType[earning.earningType] || 0) + contribution;

      // Safely extract novel id, title and totalViews whether populated or not
      const novelIdVal = earning.novel && earning.novel._id ? earning.novel._id : (earning.novel || null);
      const novelTitleVal = earning.novel && earning.novel.title ? earning.novel.title : null;
      const novelTotalViewsVal = earning.novel && typeof earning.novel.totalViews !== 'undefined' ? earning.novel.totalViews : null;

      const novelKey = novelIdVal ? String(novelIdVal) : 'unknown';

      if (!novelEarnings[novelKey]) {
        novelEarnings[novelKey] = {
          novelId: novelIdVal,
          novelTitle: novelTitleVal,
          totalViews: novelTotalViewsVal,
          coin: 0,
          ad: 0,
          interstitial: 0,
          total: 0
        };
      }

      novelEarnings[novelKey][earning.earningType] += contribution;
      novelEarnings[novelKey].total += contribution;
    });

    const totalEarnings = Object.values(totalByType).reduce((a, b) => a + b, 0);

    // Compute writer's overall total views across all their novels
    const totalViewsAgg = await Novel.aggregate([
      { $match: { author: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, totalViews: { $sum: { $ifNull: ['$totalViews', 0] } } } }
    ]);
    const writerTotalViews = totalViewsAgg[0]?.totalViews || 0;

    const responseData = {
      totalEarnings,
      writerTotalViews,
      byType: totalByType,
      byNovel: Object.values(novelEarnings),
      ecpmRate: ecpm,
      allEarnings: earnings.map(e => {
        // For ad records, compute an estimatedAmount when amount is not stored
        let estimatedAdAmount = 0;
        if (e.earningType === 'ad') {
          if (e.amount && e.amount > 0) {
            estimatedAdAmount = (e.amount || 0) / 100;
          } else {
            const unlocks = e.count || 0;
            const writerPct = (typeof e.writerPercentageEarned === 'number') ? e.writerPercentageEarned : 70;
            const perUnlock = ecpm / 1000;
            estimatedAdAmount = +(unlocks * perUnlock * (writerPct / 100)).toFixed(2);
          }
        }

        // Safely read populated fields (they may be null or raw ObjectId)
        const novelIdVal = e.novel && e.novel._id ? e.novel._id : (e.novel || null);
        const novelTitleVal = e.novel && e.novel.title ? e.novel.title : null;
        const chapterIdVal = e.chapter && e.chapter._id ? e.chapter._id : (e.chapter || null);
        const chapterNumberVal = e.chapter && typeof e.chapter.chapterNumber !== 'undefined' ? e.chapter.chapterNumber : null;
        const chapterTitleVal = e.chapter && e.chapter.title ? e.chapter.title : null;

        return {
          novelId: novelIdVal,
          novelTitle: novelTitleVal,
          chapterId: chapterIdVal,
          chapterNumber: chapterNumberVal,
          chapterTitle: chapterTitleVal,
          earningType: e.earningType,
          // amount stored in paise -> convert to rupees for API
          amount: (e.amount || 0) / 100,
          estimatedAdAmount,
          count: e.count,
          // NEW FIELDS
          hasSubscription: e.hasSubscription,
          platformFeePercentage: e.platformFeePercentage,
          writerPercentageEarned: e.writerPercentageEarned,
          viewsRequirementMet: e.viewsRequirementMet,
          totalViewsOnFreeChapters: e.totalViewsOnFreeChapters,
          coinPrice: e.coinPrice,
          coinsRequiredToUnlock: e.coinsRequiredToUnlock,
          createdAt: e.createdAt
        };
      })
    };

    // Temporary debug log: prints the full payload that will be returned

    res.status(200).json({ success: true, data: responseData });

  } catch (error) {
    console.error('Error getting writer earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get earnings for a specific novel
exports.getNovelEarnings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { novelId } = req.params;
    const novel = await Novel.findById(novelId);
    if (!novel) {
      return res.status(404).json({
        success: false,
        message: 'Novel not found'
      });
    }

    // Verify authorization
    if (novel.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized - Only author can view earnings'
      });
    }

    // eCPM rate for ad earnings (₹ per 1000 unlocks). Can be passed as query param.
    const { ecpmRate = 40 } = req.query; // default ₹40 per 1000
    const ecpm = parseFloat(ecpmRate) || 40;

    // Determine monetization status
    const WriterSubscription = require('../models/writerSubscription');
    const subscriptionUtils = require('../utils/subscriptionUtils');
    const subscription = await WriterSubscription.findOne({ writer: userId }).populate('currentPlan');
    const hasSubscription = subscriptionUtils.isSubscriptionActive(subscription);

    // If novel is not marked paid, it's not monetized
    let isMonetized = false;
    let freeChaptersInfo = { count: 0, minViews: 0, totalViews: 0 };

    if (novel.pricingModel === 'paid') {
      if (hasSubscription) {
        isMonetized = true;
      } else {
        // Check chapters 1-5 views: each chapter 1..5 must exist and have >=1000 views
        const freeStats = await Chapter.aggregate([
          { $match: { novel: novel._id } },
          { $project: { chapterNumber: { $toInt: '$chapterNumber' }, viewCount: { $ifNull: ['$viewCount', 0] } } },
          { $match: { chapterNumber: { $gte: 1, $lte: 5 } } },
          { $group: { _id: null, count: { $sum: 1 }, minViews: { $min: '$viewCount' }, totalViews: { $sum: '$viewCount' } } }
        ]);

        if (freeStats && freeStats.length > 0) {
          freeChaptersInfo.count = freeStats[0].count || 0;
          freeChaptersInfo.minViews = freeStats[0].minViews || 0;
          freeChaptersInfo.totalViews = freeStats[0].totalViews || 0;
          if (freeChaptersInfo.count === 5 && freeChaptersInfo.minViews >= 1000) {
            isMonetized = true;
          }
        }
      }
    }

    // Get earnings for this novel
    const earnings = await WriterEarning.find({ writer: userId, novel: novelId })
      .populate('chapter', 'chapterNumber title');

    let byType = {
      coin: 0,
      ad: 0,
      interstitial: 0
    };

    let byChapter = {};

    // Sum using estimated ad amounts when explicit amount isn't stored
    earnings.forEach(earning => {
      let contribution = 0;

      if (earning.earningType === 'ad') {
        if (earning.amount && earning.amount > 0) {
          contribution = earning.amount / 100;
        } else {
          const unlocks = earning.count || 0;
          const writerPct = (typeof earning.writerPercentageEarned === 'number') ? earning.writerPercentageEarned : 70;
          const perUnlock = ecpm / 1000;
          contribution = +(unlocks * perUnlock * (writerPct / 100)).toFixed(2);
        }
      } else if (earning.earningType === 'interstitial') {
        contribution = (earning.amount || 0) / 100;
      } else {
        contribution = (earning.amount || 0) / 100;
      }

      byType[earning.earningType] = (byType[earning.earningType] || 0) + contribution;

      if (!byChapter[earning.chapter._id]) {
        byChapter[earning.chapter._id] = {
          chapterId: earning.chapter._id,
          chapterNumber: earning.chapter.chapterNumber,
          chapterTitle: earning.chapter.title,
          coin: 0,
          ad: 0,
          interstitial: 0,
          total: 0
        };
      }

      byChapter[earning.chapter._id][earning.earningType] += contribution;
      byChapter[earning.chapter._id].total += contribution;
    });

    const totalEarnings = Object.values(byType).reduce((a, b) => a + b, 0);

    const responseData = {
      novelId,
      novelTitle: novel.title,
      isMonetized,
      hasSubscription,
      freeChaptersInfo,
      totalEarnings,
      ecpmRate: ecpm,
      byType,
      byChapter: Object.values(byChapter),
      allEarnings: earnings.map(e => {
        let estimatedAdAmount = 0;
        if (e.earningType === 'ad') {
          if (e.amount && e.amount > 0) {
            estimatedAdAmount = e.amount / 100;
          } else {
            const unlocks = e.count || 0;
            const writerPct = (typeof e.writerPercentageEarned === 'number') ? e.writerPercentageEarned : 70;
            const perUnlock = ecpm / 1000;
            estimatedAdAmount = +(unlocks * perUnlock * (writerPct / 100)).toFixed(2);
          }
        }

        return {
          chapterId: e.chapter._id,
          chapterNumber: e.chapter.chapterNumber,
          earningType: e.earningType,
          amount: (e.amount || 0) / 100,
          estimatedAdAmount,
          count: e.count,
          createdAt: e.createdAt
        };
      })
    };

    console.debug('getNovelEarnings response:', JSON.stringify(responseData, null, 2));

    res.status(200).json({ success: true, data: responseData });

  } catch (error) {
    console.error('Error getting novel earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get ad unlock statistics and estimated earnings
// eCPM: ₹30-₹250 per 1000 ad unlocks
exports.getAdUnlockStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { novelId } = req.params;
    const { ecpmRate = 40 } = req.query; // Default ₹40 per 1000 unlocks

    const novel = await Novel.findById(novelId);
    if (!novel) {
      return res.status(404).json({
        success: false,
        message: 'Novel not found'
      });
    }

    // Verify authorization
    if (novel.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized - Only author can view stats'
      });
    }

    // Get all ad unlock counts for this novel
    const earnings = await WriterEarning.find({
      writer: userId,
      novel: novelId,
      earningType: 'ad'
    }).populate('chapter', 'chapterNumber title');

    let totalAdUnlocks = 0;
    let byChapter = {};

    earnings.forEach(earning => {
      totalAdUnlocks += earning.count;

      if (!byChapter[earning.chapter._id]) {
        byChapter[earning.chapter._id] = {
          chapterId: earning.chapter._id,
          chapterNumber: earning.chapter.chapterNumber,
          chapterTitle: earning.chapter.title,
          adUnlocks: 0
        };
      }

      byChapter[earning.chapter._id].adUnlocks += earning.count;
    });

    // Calculate estimated earnings based on eCPM
    const ecpmRate_num = parseFloat(ecpmRate);
    const estimatedEarnings = Math.round((totalAdUnlocks / 1000) * ecpmRate_num);
    const platformEarnings = Math.round(estimatedEarnings * 0.3); // Platform gets 30%
    const writerEarnings = Math.round(estimatedEarnings * 0.7); // Writer gets 70%

    res.status(200).json({
      success: true,
      data: {
        novelId,
        novelTitle: novel.title,
        totalAdUnlocks,
        ecpmRate: ecpmRate_num,
        estimatedEarnings,
        writerEarnings,
        platformEarnings,
        byChapter: Object.values(byChapter)
      }
    });

  } catch (error) {
    console.error('Error getting ad unlock stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get chapter-wise earnings breakdown
exports.getChapterEarnings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { novelId, chapterId } = req.params;

    // eCPM rate for ad earnings (₹ per 1000 unlocks). Can be passed as query param.
    const { ecpmRate = 40 } = req.query; // default ₹40 per 1000
    const ecpm = parseFloat(ecpmRate) || 40;

    const chapter = await Chapter.findById(chapterId).populate('novel');
    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found'
      });
    }

    // Verify authorization
    if (chapter.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized - Only author can view earnings'
      });
    }

    // Get earnings for this chapter
    const earnings = await WriterEarning.findOne({
      writer: userId,
      chapter: chapterId
    });

    if (!earnings) {
      return res.status(200).json({
        success: true,
        data: {
          chapterId,
          chapterNumber: chapter.chapterNumber,
          novelId: chapter.novel._id,
          hasEarnings: false,
          message: 'No earnings yet for this chapter'
        }
      });
    }

    // Compute contribution and estimated ad amount if needed (convert paise->rupees)
    let coinAmount = 0;
    let adAmount = 0;
    let interstitialAmount = 0;
    let estimatedAdAmount = 0;

    if (earnings.earningType === 'ad') {
      if (earnings.amount && earnings.amount > 0) {
        adAmount = (earnings.amount || 0) / 100;
        estimatedAdAmount = adAmount;
      } else {
        const unlocks = earnings.count || 0;
        const writerPct = (typeof earnings.writerPercentageEarned === 'number') ? earnings.writerPercentageEarned : 70;
        const perUnlock = ecpm / 1000;
        estimatedAdAmount = +(unlocks * perUnlock * (writerPct / 100)).toFixed(2);
        adAmount = estimatedAdAmount;
      }
    } else if (earnings.earningType === 'coin') {
      coinAmount = (earnings.amount || 0) / 100;
    } else if (earnings.earningType === 'interstitial') {
      interstitialAmount = (earnings.amount || 0) / 100;
    }

    const total = +(coinAmount + adAmount + interstitialAmount).toFixed(2);

    const responseData = {
      chapterId,
      chapterNumber: chapter.chapterNumber,
      novelId: chapter.novel._id,
      novelTitle: chapter.novel.title,
      ecpmRate: ecpm,
      earnings: {
        coin: coinAmount,
        ad: adAmount,
        interstitial: interstitialAmount,
        total
      },
      hasEarnings: true,
      lastUpdated: earnings.updatedAt || earnings.createdAt
    };

    console.debug('getChapterEarnings response:', JSON.stringify(responseData, null, 2));

    return res.status(200).json({ success: true, data: responseData });

  } catch (error) {
    console.error('Error getting chapter earnings:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
