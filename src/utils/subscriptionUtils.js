const WriterSubscription = require('../models/writerSubscription');
const SubscriptionPlan = require('../models/subscriptionPlan');

/**
 * Check if a subscription is active
 */
exports.isSubscriptionActive = (subscription) => {
    if (!subscription) return false;
    return subscription.status === 'active' && new Date(subscription.expiryDate) > new Date();
};

/**
 * Check if a subscription is expired
 */
exports.isSubscriptionExpired = (subscription) => {
    if (!subscription) return true;
    return new Date(subscription.expiryDate) <= new Date();
};

/**
 * Get days remaining in subscription
 */
exports.getDaysRemaining = (subscription) => {
    if (!subscription || exports.isSubscriptionExpired(subscription)) {
        return 0;
    }
    const now = new Date();
    const expiry = new Date(subscription.expiryDate);
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

/**
 * Get writer's current subscription
 */
exports.getWriterSubscription = async (writerId) => {
    try {
        const subscription = await WriterSubscription.findOne({ writer: writerId })
            .populate('currentPlan')
            .populate('previousPlan');
        return subscription;
    } catch (error) {
        throw new Error(`Error fetching subscription: ${error.message}`);
    }
};

/**
 * Check if writer has a specific feature
 */
exports.writerHasFeature = async (writerId, featureName) => {
    try {
        const subscription = await exports.getWriterSubscription(writerId);

        if (!subscription || !exports.isSubscriptionActive(subscription)) {
            return false;
        }

        const plan = subscription.currentPlan;
        const limits = plan.limits;

        // Map feature names to plan limits
        const featureMap = {
            monetize: limits.canMonetize,
            custom_cover: limits.canUseCustomCover,
            analytics: limits.hasAnalytics,
            schedule_chapters: limits.canScheduleChapters,
            ai_assistance: limits.hasAIAssistance,
        };

        return featureMap[featureName] || false;
    } catch (error) {
        throw new Error(`Error checking feature: ${error.message}`);
    }
};

/**
 * Check if writer can perform action based on plan limits
 */
exports.canPerformAction = async (writerId, actionType, currentCount = 0) => {
    try {
        const subscription = await exports.getWriterSubscription(writerId);

        if (!subscription || !exports.isSubscriptionActive(subscription)) {
            return { allowed: false, reason: 'Subscription is not active' };
        }

        const limits = subscription.currentPlan.limits;

        switch (actionType) {
            case 'create_novel':
                if (limits.maxNovels && currentCount >= limits.maxNovels) {
                    return {
                        allowed: false,
                        reason: `Maximum novels limit reached (${limits.maxNovels})`,
                        limit: limits.maxNovels,
                    };
                }
                break;

            case 'create_chapter':
                if (limits.maxChaptersPerNovel && currentCount >= limits.maxChaptersPerNovel) {
                    return {
                        allowed: false,
                        reason: `Maximum chapters per novel limit reached (${limits.maxChaptersPerNovel})`,
                        limit: limits.maxChaptersPerNovel,
                    };
                }
                break;

            case 'upload_chapter':
                if (limits.maxChapterUploadSizeMB && currentCount > limits.maxChapterUploadSizeMB) {
                    return {
                        allowed: false,
                        reason: `File size exceeds limit (${limits.maxChapterUploadSizeMB}MB)`,
                        limit: limits.maxChapterUploadSizeMB,
                    };
                }
                break;

            case 'monetize':
                if (!limits.canMonetize) {
                    return {
                        allowed: false,
                        reason: 'Your subscription plan does not allow monetization',
                    };
                }
                break;

            default:
                return { allowed: true };
        }

        return { allowed: true };
    } catch (error) {
        throw new Error(`Error checking action permission: ${error.message}`);
    }
};

/**
 * Calculate earnings multiplier for a writer
 */
exports.getEarningsMultiplier = async (writerId) => {
    try {
        const subscription = await exports.getWriterSubscription(writerId);

        if (!subscription || !exports.isSubscriptionActive(subscription)) {
            return 1.0;
        }

        return subscription.currentPlan.limits.earningsMultiplier || 1.0;
    } catch (error) {
        console.error('Error getting earnings multiplier:', error);
        return 1.0;
    }
};

/**
 * Get plan features as array
 */
exports.getPlanFeatures = async (planId) => {
    try {
        const plan = await SubscriptionPlan.findById(planId);
        if (!plan) {
            throw new Error('Plan not found');
        }
        return plan.features || [];
    } catch (error) {
        throw new Error(`Error fetching plan features: ${error.message}`);
    }
};

/**
 * Generate order ID for payment
 */
exports.generateOrderId = () => {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `SUB_${timestamp}_${randomPart}`.toUpperCase();
};

/**
 * Calculate subscription end date
 */
exports.calculateExpiryDate = (startDate, durationDays) => {
    const expiry = new Date(startDate);
    expiry.setDate(expiry.getDate() + durationDays);
    return expiry;
};

/**
 * Format price for display
 */
exports.formatPrice = (priceInSmallestUnit, currency = 'INR') => {
    const divisor = currency === 'INR' ? 100 : 100; // Adjust based on currency
    const price = priceInSmallestUnit / divisor;
    return {
        raw: price,
        formatted: new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency,
        }).format(price),
    };
};

/**
 * Get all available plans
 */
exports.getAllPlans = async (includeInactive = false) => {
    try {
        const query = includeInactive ? {} : { isActive: true };
        const plans = await SubscriptionPlan.find(query).sort({ displayOrder: 1 });
        return plans;
    } catch (error) {
        throw new Error(`Error fetching plans: ${error.message}`);
    }
};

/**
 * Get plan by name
 */
exports.getPlanByName = async (planName) => {
    try {
        const plan = await SubscriptionPlan.findOne({ name: planName });
        if (!plan) {
            throw new Error(`Plan "${planName}" not found`);
        }
        return plan;
    } catch (error) {
        throw new Error(`Error fetching plan: ${error.message}`);
    }
};

/**
 * Update subscription status based on expiry date
 */
exports.updateSubscriptionStatusIfExpired = async (writerId) => {
    try {
        const subscription = await WriterSubscription.findOne({ writer: writerId });

        if (!subscription) {
            return null;
        }

        if (exports.isSubscriptionExpired(subscription) && subscription.status === 'active') {
            subscription.status = 'expired';
            await subscription.save();
        }

        return subscription;
    } catch (error) {
        throw new Error(`Error updating subscription status: ${error.message}`);
    }
};

/**
 * Check if writer can use free trial
 */
exports.canUseFreeTriel = async (writerId) => {
    try {
        const subscription = await WriterSubscription.findOne({ writer: writerId });

        // If no subscription exists, user can use free trial
        if (!subscription) {
            return true;
        }

        // If user already used free trial, they can't use it again
        if (subscription.freeTrialUsageCount > 0) {
            return false;
        }

        return true;
    } catch (error) {
        throw new Error(`Error checking free trial eligibility: ${error.message}`);
    }
};

/**
 * Get plan by ID
 */
exports.getPlanById = async (planId) => {
    try {
        const plan = await SubscriptionPlan.findById(planId);
        if (!plan) {
            throw new Error('Plan not found');
        }
        return plan;
    } catch (error) {
        throw new Error(`Error fetching plan: ${error.message}`);
    }
};
