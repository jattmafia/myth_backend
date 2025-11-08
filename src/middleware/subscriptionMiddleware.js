const WriterSubscription = require('../models/writerSubscription');
const { isSubscriptionActive, updateSubscriptionStatusIfExpired } = require('../utils/subscriptionUtils');

/**
 * Middleware to check if user has an active subscription
 * If not active, returns 403 Forbidden
 */
exports.checkActiveSubscription = async (req, res, next) => {
    try {
        const writerId = req.user.id;

        // Update subscription status if expired
        await updateSubscriptionStatusIfExpired(writerId);

        const subscription = await WriterSubscription.findOne({ writer: writerId }).populate('currentPlan');

        if (!subscription || !isSubscriptionActive(subscription)) {
            return res.status(403).json({
                success: false,
                message: 'Active subscription required to access this feature',
            });
        }

        req.subscription = subscription;
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error checking subscription',
            error: error.message,
        });
    }
};

/**
 * Middleware to check if user has a specific feature
 */
exports.checkFeature = (featureName) => {
    return async (req, res, next) => {
        try {
            const subscription = req.subscription || await WriterSubscription.findOne({ writer: req.user.id }).populate('currentPlan');

            if (!subscription || !isSubscriptionActive(subscription)) {
                return res.status(403).json({
                    success: false,
                    message: 'Active subscription required',
                });
            }

            const featureEnabled = subscription.currentPlan.limits[featureName];

            if (!featureEnabled) {
                return res.status(403).json({
                    success: false,
                    message: `Feature "${featureName}" is not available in your subscription plan`,
                    requiredPlan: 'premium',
                });
            }

            req.subscription = subscription;
            next();
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error checking feature access',
                error: error.message,
            });
        }
    };
};

/**
 * Middleware to attach subscription info to request (optional, doesn't block if not found)
 */
exports.attachSubscriptionInfo = async (req, res, next) => {
    try {
        const subscription = await WriterSubscription.findOne({ writer: req.user.id }).populate('currentPlan');
        req.subscription = subscription;
        req.hasActiveSubscription = subscription && isSubscriptionActive(subscription);
    } catch (error) {
        console.error('Error attaching subscription info:', error);
        req.hasActiveSubscription = false;
    }
    next();
};

/**
 * Middleware to check if user is a writer
 * A writer is someone who has or has had a subscription
 */
exports.checkIsWriter = async (req, res, next) => {
    try {
        const subscription = await WriterSubscription.findOne({ writer: req.user.id });

        if (!subscription) {
            return res.status(403).json({
                success: false,
                message: 'You must be a writer to access this resource',
            });
        }

        req.subscription = subscription;
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error checking writer status',
            error: error.message,
        });
    }
};
