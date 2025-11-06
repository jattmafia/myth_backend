const Chapter = require('../models/chapter');
const Novel = require('../models/novel');
const ChapterAccess = require('../models/chapterAccess');
const User = require('../models/user');

// Check if user can access a chapter
// For paid novels: chapters 1-5 are free, 6+ are locked
// For free novels: all chapters are accessible
exports.checkChapterAccess = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const userId = req.user?.id;

    // Fetch chapter with novel details
    const chapter = await Chapter.findById(chapterId).populate('novel', 'pricingModel');

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found'
      });
    }

    const novel = chapter.novel;

    // If novel is free, all chapters are accessible
    if (novel.pricingModel === 'free') {
      return res.status(200).json({
        success: true,
        data: {
          chapterId,
          novelId: novel._id,
          canAccess: true,
          reason: 'Free novel - all chapters accessible',
          accessType: 'free'
        }
      });
    }

    // For paid novels
    // Chapters 1-5 are free
    if (chapter.chapterNumber <= 5) {
      // Log access if user is authenticated
      if (userId) {
        await ChapterAccess.findOneAndUpdate(
          { user: userId, chapter: chapterId },
          {
            user: userId,
            chapter: chapterId,
            novel: chapter.novel._id,
            accessType: 'free',
            accessedAt: new Date()
          },
          { upsert: true, new: true }
        );
      }

      return res.status(200).json({
        success: true,
        data: {
          chapterId,
          novelId: novel._id,
          chapterNumber: chapter.chapterNumber,
          canAccess: true,
          reason: 'Chapters 1-5 are free in paid novels',
          accessType: 'free'
        }
      });
    }

    // Chapters 6+ are locked for paid novels
    if (!userId) {
      return res.status(200).json({
        success: true,
        data: {
          chapterId,
          novelId: novel._id,
          chapterNumber: chapter.chapterNumber,
          canAccess: false,
          reason: 'Please login to purchase this chapter',
          accessType: 'locked',
          requiresPurchase: true
        }
      });
    }

    // Check if user has purchased this chapter
    const userAccess = await ChapterAccess.findOne({
      user: userId,
      chapter: chapterId,
      accessType: 'purchased'
    });

    if (userAccess) {
      return res.status(200).json({
        success: true,
        data: {
          chapterId,
          novelId: novel._id,
          chapterNumber: chapter.chapterNumber,
          canAccess: true,
          reason: 'Chapter purchased',
          accessType: 'purchased',
          purchasedAt: userAccess.accessedAt
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        chapterId,
        novelId: novel._id,
        chapterNumber: chapter.chapterNumber,
        canAccess: false,
        reason: 'Chapter is locked. Please purchase to read.',
        accessType: 'locked',
        requiresPurchase: true
      }
    });

  } catch (error) {
    console.error('Error checking chapter access:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Purchase a chapter (for paid chapters in paid novels)
exports.purchaseChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const userId = req.user.id;

    // Fetch chapter with novel details
    const chapter = await Chapter.findById(chapterId).populate('novel', 'pricingModel');

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found'
      });
    }

    const novel = chapter.novel;

    // Check if novel is paid
    if (novel.pricingModel === 'free') {
      return res.status(400).json({
        success: false,
        message: 'This chapter is in a free novel and cannot be purchased'
      });
    }

    // Check if chapter is free (1-5)
    if (chapter.chapterNumber <= 5) {
      return res.status(400).json({
        success: false,
        message: 'Chapters 1-5 are free and cannot be purchased'
      });
    }

    // Check if already purchased
    const existingAccess = await ChapterAccess.findOne({
      user: userId,
      chapter: chapterId
    });

    if (existingAccess && existingAccess.accessType === 'purchased') {
      return res.status(400).json({
        success: false,
        message: 'You have already purchased this chapter'
      });
    }

    // Create or update access record
    const access = await ChapterAccess.findOneAndUpdate(
      { user: userId, chapter: chapterId },
      {
        user: userId,
        chapter: chapterId,
        novel: chapter.novel._id,
        accessType: 'purchased',
        accessedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Chapter purchased successfully',
      data: {
        chapterId,
        novelId: novel._id,
        chapterNumber: chapter.chapterNumber,
        accessType: 'purchased',
        purchasedAt: access.accessedAt
      }
    });

  } catch (error) {
    console.error('Error purchasing chapter:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get user's access history for a novel (which chapters they've accessed)
exports.getUserNovelAccess = async (req, res) => {
  try {
    const { novelId } = req.params;
    const userId = req.user.id;

    // Check if novel exists
    const novel = await Novel.findById(novelId);
    if (!novel) {
      return res.status(404).json({
        success: false,
        message: 'Novel not found'
      });
    }

    // Get all chapters of the novel
    const chapters = await Chapter.find({ novel: novelId, status: 'published' })
      .sort({ chapterNumber: 1 })
      .select('_id title chapterNumber');

    // Get user's access to these chapters
    const userAccess = await ChapterAccess.find({
      user: userId,
      novel: novelId
    }).select('chapter accessType accessedAt');

    // Create a map for easy lookup
    const accessMap = {};
    userAccess.forEach(access => {
      accessMap[access.chapter.toString()] = {
        accessType: access.accessType,
        accessedAt: access.accessedAt
      };
    });

    // Build response with access status for each chapter
    const chaptersWithAccess = chapters.map(chapter => {
      const chapterAccess = accessMap[chapter._id.toString()];
      let accessInfo;

      if (novel.pricingModel === 'free') {
        // Free novel - all chapters accessible
        accessInfo = {
          canAccess: true,
          accessType: 'free',
          reason: 'Free novel'
        };
      } else {
        // Paid novel
        if (chapter.chapterNumber <= 5) {
          accessInfo = {
            canAccess: true,
            accessType: 'free',
            reason: 'Free chapters (1-5)'
          };
        } else {
          // Chapters 6+
          if (chapterAccess && chapterAccess.accessType === 'purchased') {
            accessInfo = {
              canAccess: true,
              accessType: 'purchased',
              purchasedAt: chapterAccess.accessedAt,
              reason: 'Chapter purchased'
            };
          } else {
            accessInfo = {
              canAccess: false,
              accessType: 'locked',
              reason: 'Chapter locked - purchase required'
            };
          }
        }
      }

      return {
        chapterId: chapter._id,
        title: chapter.title,
        chapterNumber: chapter.chapterNumber,
        ...accessInfo
      };
    });

    res.status(200).json({
      success: true,
      data: {
        novelId,
        pricingModel: novel.pricingModel,
        totalChapters: chapters.length,
        chapters: chaptersWithAccess
      }
    });

  } catch (error) {
    console.error('Error getting user novel access:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all users who have accessed a chapter (for writer analytics)
exports.getChapterAccessStats = async (req, res) => {
  try {
    const { chapterId } = req.params;

    // Check if chapter exists
    const chapter = await Chapter.findById(chapterId).populate('author novel');

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found'
      });
    }

    // Verify authorization - only author can see stats
    if (chapter.author._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized - Only author can view access stats'
      });
    }

    // Get all users who have accessed this chapter
    const accessStats = await ChapterAccess.find({ chapter: chapterId })
      .populate('user', 'username email profilePicture')
      .sort({ accessedAt: -1 });

    // Separate free and purchased access
    const freeAccess = accessStats.filter(a => a.accessType === 'free');
    const purchasedAccess = accessStats.filter(a => a.accessType === 'purchased');

    res.status(200).json({
      success: true,
      data: {
        chapterId,
        chapterNumber: chapter.chapterNumber,
        novelId: chapter.novel._id,
        totalAccess: accessStats.length,
        freeAccessCount: freeAccess.length,
        purchasedAccessCount: purchasedAccess.length,
        freeAccessUsers: freeAccess.map(a => ({
          userId: a.user._id,
          username: a.user.username,
          profilePicture: a.user.profilePicture,
          accessedAt: a.accessedAt
        })),
        purchasedAccessUsers: purchasedAccess.map(a => ({
          userId: a.user._id,
          username: a.user.username,
          profilePicture: a.user.profilePicture,
          purchasedAt: a.accessedAt
        }))
      }
    });

  } catch (error) {
    console.error('Error getting chapter access stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Unlock chapter by spending coins
exports.unlockByCoins = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const userId = req.user.id;

    // Fetch chapter with novel details
    const chapter = await Chapter.findById(chapterId).populate('novel', 'pricingModel');

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found'
      });
    }

    const novel = chapter.novel;

    // Check if novel is paid
    if (novel.pricingModel === 'free') {
      return res.status(400).json({
        success: false,
        message: 'This chapter is in a free novel and cannot be unlocked'
      });
    }

    // Check if chapter is free (1-5)
    if (chapter.chapterNumber <= 5) {
      return res.status(400).json({
        success: false,
        message: 'Chapters 1-5 are free and do not require coins'
      });
    }

    // Check if already unlocked
    const existingAccess = await ChapterAccess.findOne({
      user: userId,
      chapter: chapterId
    });

    if (existingAccess && (existingAccess.accessType === 'purchased' || existingAccess.accessType === 'coin')) {
      return res.status(400).json({
        success: false,
        message: 'You have already unlocked this chapter'
      });
    }

    // Get user and check coin balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Fixed coin price per chapter (can be configurable)
    const coinPrice = chapter.coinCost || 4;

    if (user.coins < coinPrice) {
      return res.status(400).json({
        success: false,
        message: `Insufficient coins. Required: ${coinPrice}, Available: ${user.coins}`
      });
    }

    // Deduct coins
    user.coins -= coinPrice;
    await user.save();

    // Create access record
    await ChapterAccess.findOneAndUpdate(
      { user: userId, chapter: chapterId },
      {
        user: userId,
        chapter: chapterId,
        novel: chapter.novel._id,
        accessType: 'coin',
        accessedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Record in unlock history
    const UnlockHistory = require('../models/unlockHistory');
    await UnlockHistory.create({
      user: userId,
      chapter: chapterId,
      novel: chapter.novel._id,
      unlockMethod: 'coin',
      coinsSpent: coinPrice
    });

    // Record coin transaction
    const CoinTransaction = require('../models/coinTransaction');
    await CoinTransaction.create({
      user: userId,
      type: 'spent',
      amount: coinPrice,
      reason: 'Chapter unlock',
      description: `Unlocked chapter ${chapter.chapterNumber} of ${chapter.novel.title || 'Novel'}`,
      balanceAfter: user.coins,
      relatedItem: chapterId
    });

    // Record writer earning (70% of coins)
    // New rule: for sample chapters (1-5) only record earnings if the chapter has >1000 views
    // For paid chapters (6+), always record earnings.
    const writerEarningController = require('./writerEarningController');
    try {
      const isSample = chapter.chapterNumber <= 5;
      const views = chapter.viewCount || 0;
      if (!isSample || (isSample && views > 1000)) {
        await writerEarningController.recordCoinEarning(
          chapter.novel._id,
          chapter.author._id,
          chapterId,
          coinPrice
        );
      } else {
        // Skip recording writer earning for low-traffic sample chapters
        console.log(`[earnings] skipped writer earning for chapter ${chapterId} (sample, views=${views})`);
      }
    } catch (e) {
      console.error('Error recording writer earning:', e && e.message);
    }

    res.status(200).json({
      success: true,
      message: 'Chapter unlocked successfully with coins',
      data: {
        chapterId,
        novelId: novel._id,
        chapterNumber: chapter.chapterNumber,
        coinsSpent: coinPrice,
        remainingCoins: user.coins,
        unlockedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error unlocking chapter by coins:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Unlock chapter by watching ads (with daily limit per novel)
exports.unlockByAds = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const userId = req.user.id;

    // Fetch chapter with novel details
    const chapter = await Chapter.findById(chapterId).populate('novel', 'pricingModel');

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found'
      });
    }

    const novel = chapter.novel;

    // Check if novel is paid
    if (novel.pricingModel === 'free') {
      return res.status(400).json({
        success: false,
        message: 'This chapter is in a free novel and cannot be unlocked'
      });
    }

    // Check if chapter is free (1-5)
    if (chapter.chapterNumber <= 5) {
      return res.status(400).json({
        success: false,
        message: 'Chapters 1-5 are free and do not require ads'
      });
    }

    // Check if already unlocked
    const existingAccess = await ChapterAccess.findOne({
      user: userId,
      chapter: chapterId
    });

    if (existingAccess && (existingAccess.accessType === 'purchased' || existingAccess.accessType === 'coin' || existingAccess.accessType === 'ad')) {
      return res.status(400).json({
        success: false,
        message: 'You have already unlocked this chapter'
      });
    }

    // Check daily ad limit (5 ads per novel per day)
    const AdUnlockLog = require('../models/adUnlockLog');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const adCountToday = await AdUnlockLog.countDocuments({
      user: userId,
      novel: chapter.novel._id,
      unlockedAt: { $gte: today, $lt: tomorrow }
    });

    const dailyLimit = 5;
    if (adCountToday >= dailyLimit) {
      return res.status(400).json({
        success: false,
        message: `Daily ad limit reached. Maximum ${dailyLimit} ads per novel per day`,
        remainingAdUnlocks: 0
      });
    }

    // Create access record
    await ChapterAccess.findOneAndUpdate(
      { user: userId, chapter: chapterId },
      {
        user: userId,
        chapter: chapterId,
        novel: chapter.novel._id,
        accessType: 'ad',
        accessedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Record in ad unlock log
    await AdUnlockLog.create({
      user: userId,
      novel: chapter.novel._id,
      chapter: chapterId
    });

    // Record in unlock history
    const UnlockHistory = require('../models/unlockHistory');
    await UnlockHistory.create({
      user: userId,
      chapter: chapterId,
      novel: chapter.novel._id,
      unlockMethod: 'ad'
    });

    // Record writer earning for ad unlock
    const writerEarningController = require('./writerEarningController');
    await writerEarningController.recordAdEarning(
      chapter.novel._id,
      chapter.author._id,
      chapterId
    );

    res.status(200).json({
      success: true,
      message: 'Chapter unlocked successfully by watching ads',
      data: {
        chapterId,
        novelId: novel._id,
        chapterNumber: chapter.chapterNumber,
        remainingAdUnlocksToday: dailyLimit - adCountToday - 1,
        unlockedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error unlocking chapter by ads:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get unlock history for a user (all unlock methods)
exports.getUnlockHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { novelId } = req.params;
    const { limit = 20, skip = 0 } = req.query;

    let query = { user: userId };

    if (novelId) {
      query.novel = novelId;
    }

    const UnlockHistory = require('../models/unlockHistory');
    const history = await UnlockHistory.find(query)
      .populate('chapter', 'title chapterNumber')
      .populate('novel', 'title')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await UnlockHistory.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        history: history.map(h => ({
          unlockId: h._id,
          chapterTitle: h.chapter.title,
          chapterNumber: h.chapter.chapterNumber,
          novelTitle: h.novel.title,
          novelId: h.novel._id,
          unlockMethod: h.unlockMethod,
          coinsSpent: h.coinsSpent || 0,
          unlockedAt: h.unlockedAt,
          createdAt: h.createdAt
        })),
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });

  } catch (error) {
    console.error('Error getting unlock history:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get daily ad unlock remaining for a novel
exports.getAdUnlockStatus = async (req, res) => {
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

    // Check ad unlocks today
    const AdUnlockLog = require('../models/adUnlockLog');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const adCountToday = await AdUnlockLog.countDocuments({
      user: userId,
      novel: novelId,
      unlockedAt: { $gte: today, $lt: tomorrow }
    });

    const dailyLimit = 5;
    const remainingAdUnlocks = Math.max(0, dailyLimit - adCountToday);

    res.status(200).json({
      success: true,
      data: {
        novelId,
        dailyLimit,
        usedAdUnlocksToday: adCountToday,
        remainingAdUnlocksToday: remainingAdUnlocks
      }
    });

  } catch (error) {
    console.error('Error getting ad unlock status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Record/Update user ads watched for a novel (manual ad tracking)
exports.recordAdWatch = async (req, res) => {
  try {
    const userId = req.user.id;
    const { novelId } = req.params;
    const { chapterId, adType } = req.body || {};

    const novel = await Novel.findById(novelId);
    if (!novel) {
      return res.status(404).json({
        success: false,
        message: 'Novel not found'
      });
    }

    // chapterId is optional - if not provided, we're just tracking ad views on the novel
    let chapter = null;
    if (chapterId) {
      chapter = await Chapter.findById(chapterId);
      if (!chapter) {
        return res.status(404).json({
          success: false,
          message: 'Chapter not found'
        });
      }
    }

    // Check daily ad limit (5 ads per novel per day)
    const AdUnlockLog = require('../models/adUnlockLog');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const adCountToday = await AdUnlockLog.countDocuments({
      user: userId,
      novel: novelId,
      unlockedAt: { $gte: today, $lt: tomorrow }
    });

    const dailyLimit = 5;
    if (adCountToday >= dailyLimit) {
      return res.status(400).json({
        success: false,
        message: `Daily ad limit reached. Maximum ${dailyLimit} ads per novel per day`,
        usedAdUnlocksToday: adCountToday,
        remainingAdUnlocksToday: 0
      });
    }

    // Record the ad watch
    await AdUnlockLog.create({
      user: userId,
      novel: novelId,
      chapter: chapterId
    });

    // Record in unlock history
    const UnlockHistory = require('../models/unlockHistory');
    await UnlockHistory.create({
      user: userId,
      chapter: chapterId,
      novel: novelId,
      unlockMethod: 'ad'
    });

    // Record writer earning for ad watch ONLY if:
    // 1. Novel is paid
    // 2. Chapter is provided and chapter is 6+ (not 1-5)
    if (chapter && novel.pricingModel === 'paid' && chapter.chapterNumber > 5) {
      const writerEarningController = require('./writerEarningController');
      await writerEarningController.recordAdEarning(novelId, chapter.author._id, chapterId, adType || 'ad');
    }

    res.status(200).json({
      success: true,
      message: 'Ad watch recorded successfully',
      data: {
        novelId,
        chapterId,
        usedAdUnlocksToday: adCountToday + 1,
        remainingAdUnlocksToday: Math.max(0, dailyLimit - adCountToday - 1),
        recordedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error recording ad watch:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
