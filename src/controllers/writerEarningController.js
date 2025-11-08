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
      const freeChaptersViews = await Chapter.aggregate([
        {
          $match: {
            novel: novel._id,
            chapterNumber: { $gte: 1, $lte: 5 }
          }
        },
        {
          $group: {
            _id: null,
            totalViews: { $sum: '$viewCount' }
          }
        }
      ]);

      totalFreeViews = freeChaptersViews[0]?.totalViews || 0;

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

    // Calculate writer earning
    const writerEarning = Math.round(coinPrice * (writerPercentage / 100));

    // Coins required to unlock (usually 80% of coin price)
    const coinsRequiredToUnlock = Math.round(coinPrice * 0.8);

    await WriterEarning.findOneAndUpdate(
      { writer: writerId, novel: novelId, chapter: chapterId, earningType: 'coin' },
      {
        $inc: { amount: writerEarning, count: 1 },
        $set: {
          hasSubscription,
          subscriptionId: subscription?._id || null,
          platformFeePercentage: platformFee,
          writerPercentageEarned: writerPercentage,
          viewsRequirementMet,
          totalViewsOnFreeChapters: totalFreeViews,
          coinPrice,
          coinsRequiredToUnlock,
          chapterNumber: chapter.chapterNumber
        }
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Coin earning recorded: Writer ${writerId}, Amount: ₹${writerEarning}, Platform Fee: ${platformFee}%, Subscription: ${hasSubscription}`);
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
      const freeChaptersViews = await Chapter.aggregate([
        {
          $match: {
            novel: novel._id,
            chapterNumber: { $gte: 1, $lte: 5 }
          }
        },
        {
          $group: {
            _id: null,
            totalViews: { $sum: '$viewCount' }
          }
        }
      ]);

      totalFreeViews = freeChaptersViews[0]?.totalViews || 0;

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

    // For ad earnings: just increment count. Amount calculated based on eCPM rate
    await WriterEarning.findOneAndUpdate(
      { writer: writerId, novel: novelId, chapter: chapterId, earningType: adType },
      {
        $inc: { count: 1 },
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

    console.log(`✅ Ad earning recorded: Writer ${writerId}, Platform Fee: ${platformFee}%, Subscription: ${hasSubscription}`);
  } catch (error) {
    console.error('Error recording ad earning:', error);
  }
};

// Get total earnings for a writer (all novels)
exports.getWriterEarnings = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all earnings
    const earnings = await WriterEarning.find({ writer: userId })
      .populate('novel', 'title')
      .populate('chapter', 'chapterNumber title')
      .populate('subscriptionId', 'status currentPlan');

    // Group by earning type
    let totalByType = {
      coin: 0,
      ad: 0,
      interstitial: 0
    };

    let novelEarnings = {};

    earnings.forEach(earning => {
      totalByType[earning.earningType] = (totalByType[earning.earningType] || 0) + earning.amount;

      if (!novelEarnings[earning.novel._id]) {
        novelEarnings[earning.novel._id] = {
          novelId: earning.novel._id,
          novelTitle: earning.novel.title,
          coin: 0,
          ad: 0,
          interstitial: 0,
          total: 0
        };
      }

      novelEarnings[earning.novel._id][earning.earningType] += earning.amount;
      novelEarnings[earning.novel._id].total += earning.amount;
    });

    const totalEarnings = Object.values(totalByType).reduce((a, b) => a + b, 0);

    res.status(200).json({
      success: true,
      data: {
        totalEarnings,
        byType: totalByType,
        byNovel: Object.values(novelEarnings),
        allEarnings: earnings.map(e => ({
          novelId: e.novel._id,
          novelTitle: e.novel.title,
          chapterId: e.chapter._id,
          chapterNumber: e.chapter.chapterNumber,
          chapterTitle: e.chapter.title,
          earningType: e.earningType,
          amount: e.amount,
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
        }))
      }
    });

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

    // Get earnings for this novel
    const earnings = await WriterEarning.find({ writer: userId, novel: novelId })
      .populate('chapter', 'chapterNumber title');

    let byType = {
      coin: 0,
      ad: 0,
      interstitial: 0
    };

    let byChapter = {};

    earnings.forEach(earning => {
      byType[earning.earningType] = (byType[earning.earningType] || 0) + earning.amount;

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

      byChapter[earning.chapter._id][earning.earningType] += earning.amount;
      byChapter[earning.chapter._id].total += earning.amount;
    });

    const totalEarnings = Object.values(byType).reduce((a, b) => a + b, 0);

    res.status(200).json({
      success: true,
      data: {
        novelId,
        novelTitle: novel.title,
        totalEarnings,
        byType,
        byChapter: Object.values(byChapter),
        allEarnings: earnings.map(e => ({
          chapterId: e.chapter._id,
          chapterNumber: e.chapter.chapterNumber,
          earningType: e.earningType,
          amount: e.amount,
          count: e.count,
          createdAt: e.createdAt
        }))
      }
    });

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

    res.status(200).json({
      success: true,
      data: {
        chapterId,
        chapterNumber: chapter.chapterNumber,
        novelId: chapter.novel._id,
        novelTitle: chapter.novel.title,
        earnings: {
          coin: earnings.earningType === 'coin' ? earnings.amount : 0,
          ad: earnings.earningType === 'ad' ? earnings.amount : 0,
          interstitial: earnings.earningType === 'interstitial' ? earnings.amount : 0,
          total: earnings.amount
        },
        counts: {
          coinUnlocks: earnings.earningType === 'coin' ? earnings.count : 0,
          adUnlocks: earnings.earningType === 'ad' ? earnings.count : 0,
          interstitialImpressions: earnings.earningType === 'interstitial' ? earnings.impressions : 0
        },
        createdAt: earnings.createdAt,
        updatedAt: earnings.updatedAt
      }
    });

  } catch (error) {
    console.error('Error getting chapter earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
