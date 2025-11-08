const WriterSubscription = require('../models/writerSubscription');
const SubscriptionPlan = require('../models/subscriptionPlan');
const SubscriptionPayment = require('../models/subscriptionPayment');
const User = require('../models/user');
const subscriptionUtils = require('../utils/subscriptionUtils');

/**
 * Initialize free trial subscription for a new writer
 * POST /api/subscription/activate-free-plan
 * 
 * Activates the Basic Plan for free (1 month trial)
 * After 1 month, it converts to paid subscription (Basic Plan)
 */
exports.activateFreePlan = async (req, res) => {
    try {
        const writerId = req.user.id;

        // Check if user already has a subscription
        let existingSubscription = await WriterSubscription.findOne({ writer: writerId });

        if (existingSubscription && existingSubscription.freeTrialUsageCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'You have already used the free trial',
                code: 'FREE_TRIAL_ALREADY_USED',
            });
        }

        // Get the premium plan (which is free for 1 month, then paid)
        const premiumPlan = await SubscriptionPlan.findOne({ name: 'premium' });
        if (!premiumPlan) {
            return res.status(500).json({
                success: false,
                message: 'Premium plan not configured',
            });
        }

        const startDate = new Date();
        const expiryDate = subscriptionUtils.calculateExpiryDate(startDate, premiumPlan.durationDays);

        if (existingSubscription) {
            // Update existing subscription
            existingSubscription.currentPlan = premiumPlan._id;
            existingSubscription.startDate = startDate;
            existingSubscription.expiryDate = expiryDate;
            existingSubscription.status = 'active';
            existingSubscription.isFreeTrial = true;
            existingSubscription.freeTrialUsageCount += 1;
            existingSubscription.autoRenew = true; // Auto-renew to paid after trial
            await existingSubscription.save();
        } else {
            // Create new subscription
            const subscription = new WriterSubscription({
                writer: writerId,
                currentPlan: premiumPlan._id,
                startDate,
                expiryDate,
                status: 'active',
                isFreeTrial: true,
                freeTrialUsageCount: 1,
                autoRenew: true, // Auto-renew to paid after trial
            });
            existingSubscription = await subscription.save();
        }

        // Populate the plan details
        await existingSubscription.populate('currentPlan');

        res.status(200).json({
            success: true,
            message: 'Premium Plan activated for free - 1 month trial (90% revenue for writers)',
            subscription: {
                id: existingSubscription._id,
                plan: existingSubscription.currentPlan,
                status: existingSubscription.status,
                startDate: existingSubscription.startDate,
                expiryDate: existingSubscription.expiryDate,
                daysRemaining: subscriptionUtils.getDaysRemaining(existingSubscription),
                isFreeTrial: existingSubscription.isFreeTrial,
                trialEndsAt: expiryDate,
                revenueShare: {
                    writerPercentage: 90,
                    appPercentage: 10,
                    message: 'You earn 90% of all revenue from your novels',
                },
            },
        });
    } catch (error) {
        console.error('Error activating free plan:', error);
        res.status(500).json({
            success: false,
            message: 'Error activating free plan',
            error: error.message,
        });
    }
};

/**
 * Get current subscription details
 * GET /api/subscription/current
 */
exports.getCurrentSubscription = async (req, res) => {
    try {
        const writerId = req.user.id;

        // Update subscription status if expired
        await subscriptionUtils.updateSubscriptionStatusIfExpired(writerId);

        const subscription = await WriterSubscription.findOne({ writer: writerId })
            .populate('currentPlan')
            .populate('previousPlan');

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'No subscription found',
                code: 'NO_SUBSCRIPTION',
            });
        }

        const isActive = subscriptionUtils.isSubscriptionActive(subscription);
        const daysRemaining = subscriptionUtils.getDaysRemaining(subscription);

        res.status(200).json({
            success: true,
            subscription: {
                id: subscription._id,
                plan: subscription.currentPlan,
                status: subscription.status,
                isActive,
                startDate: subscription.startDate,
                expiryDate: subscription.expiryDate,
                daysRemaining,
                isFreeTrial: subscription.isFreeTrial,
                autoRenew: subscription.autoRenew,
                usageStats: subscription.usageStats,
                freeTrialUsageCount: subscription.freeTrialUsageCount,
            },
        });
    } catch (error) {
        console.error('Error fetching subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching subscription',
            error: error.message,
        });
    }
};

/**
 * Get all available subscription plans
 * GET /api/subscription/plans
 */
exports.getAvailablePlans = async (req, res) => {
    try {
        const plans = await subscriptionUtils.getAllPlans(false);

        const formattedPlans = plans.map(plan => ({
            id: plan._id,
            name: plan.name,
            displayName: plan.displayName,
            description: plan.description,
            durationDays: plan.durationDays,
            price: plan.price,
            recurringPrice: plan.recurringPrice,
            currency: plan.currency,
            features: plan.features,
            limits: plan.limits,
            displayOrder: plan.displayOrder,
            razorpayPlanId: plan.razorpayPlanId,
            razorpaySubscriptionId: plan.razorpaySubscriptionId,
            
        }));

        res.status(200).json({
            success: true,
            plans: formattedPlans,
        });
    } catch (error) {
        console.error('Error fetching plans:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching plans',
            error: error.message,
        });
    }
};

/**
 * Get a specific plan details
 * GET /api/subscription/plans/:planId
 */
exports.getPlanDetails = async (req, res) => {
    try {
        const { planId } = req.params;

        const plan = await subscriptionUtils.getPlanById(planId);

        res.status(200).json({
            success: true,
            plan: {
                id: plan._id,
                name: plan.name,
                displayName: plan.displayName,
                description: plan.description,
                durationDays: plan.durationDays,
                price: plan.price,
                recurringPrice: plan.recurringPrice,
                currency: plan.currency,
                features: plan.features,
                limits: plan.limits,
            },
        });
    } catch (error) {
        console.error('Error fetching plan details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching plan details',
            error: error.message,
        });
    }
};

/**
 * Initiate payment for subscription upgrade
 * This endpoint prepares the subscription for payment on frontend
 * Frontend will handle the actual payment via Razorpay
 * 
 * POST /api/subscription/initiate-payment
 */
exports.initiatePayment = async (req, res) => {
    try {
        const writerId = req.user.id;
        const { planId } = req.body;

        // Validate input
        if (!planId) {
            return res.status(400).json({
                success: false,
                message: 'planId is required',
            });
        }

        // Get the plan
        const plan = await subscriptionUtils.getPlanById(planId);

        // Free plan cannot be initiated as payment
        if (plan.name === 'free' && plan.price === 0) {
            return res.status(400).json({
                success: false,
                message: 'Use activate-free-plan endpoint for free plan',
            });
        }

        // Get or create subscription
        let subscription = await WriterSubscription.findOne({ writer: writerId });

        // Generate order ID
        const orderId = subscriptionUtils.generateOrderId();

        // Calculate dates
        const startDate = new Date();
        const expiryDate = subscriptionUtils.calculateExpiryDate(startDate, plan.durationDays);

        if (!subscription) {
            subscription = new WriterSubscription({
                writer: writerId,
                currentPlan: plan._id,
                startDate,
                expiryDate,
                status: 'pending',
            });
        } else {
            subscription.previousPlan = subscription.currentPlan;
            subscription.currentPlan = plan._id;
            subscription.startDate = startDate;
            subscription.expiryDate = expiryDate;
            subscription.status = 'pending';
        }

        await subscription.save();

        // Create payment record (Razorpay only)
        const payment = new SubscriptionPayment({
            writer: writerId,
            subscription: subscription._id,
            plan: plan._id,
            amount: plan.price,
            currency: plan.currency,
            status: 'pending',
            paymentMethod: 'razorpay',
            orderId,
            transactionId: `${orderId}-${Date.now()}`, // Temporary ID, will be replaced after payment
            subscriptionStartDate: startDate,
            subscriptionEndDate: expiryDate,
        });

        await payment.save();

        res.status(200).json({
            success: true,
            message: 'Payment initiation successful. Proceed with Razorpay payment.',
            payment: {
                paymentId: payment._id,
                orderId,
                amount: plan.price,
                amountFormatted: subscriptionUtils.formatPrice(plan.price, plan.currency),
                currency: plan.currency,
                plan: {
                    id: plan._id,
                    name: plan.name,
                    displayName: plan.displayName,
                },
                paymentMethod: 'razorpay',
                subscriptionStartDate: startDate,
                subscriptionEndDate: expiryDate,
            },
        });
    } catch (error) {
        console.error('Error initiating payment:', error);
        res.status(500).json({
            success: false,
            message: 'Error initiating payment',
            error: error.message,
        });
    }
};

/**
 * Verify and complete payment from Razorpay
 * This is called after frontend completes payment with Razorpay
 * 
 * POST /api/subscription/verify-payment
 */
exports.verifyPayment = async (req, res) => {
    try {
        const writerId = req.user.id;
        const { paymentId, orderId, razorpayPaymentId, razorpaySignature } = req.body;

        // Validate input
        if (!paymentId || !razorpayPaymentId || !razorpaySignature) {
            return res.status(400).json({
                success: false,
                message: 'paymentId, razorpayPaymentId, and razorpaySignature are required',
            });
        }

        // Verify signature
        const crypto = require('crypto');
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${orderId}|${razorpayPaymentId}`);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== razorpaySignature) {
            return res.status(400).json({
                success: false,
                message: 'Payment signature verification failed',
            });
        }

        // Find payment and update
        const payment = await SubscriptionPayment.findById(paymentId);
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment record not found',
            });
        }

        if (payment.writer.toString() !== writerId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access',
            });
        }

        // Update payment as completed
        payment.status = 'completed';
        payment.transactionId = razorpayPaymentId;
        payment.paymentCompletedAt = new Date();
        payment.metadata = { razorpay_payment_id: razorpayPaymentId };
        await payment.save();

        // Activate subscription
        const subscription = await WriterSubscription.findById(payment.subscription);
        if (subscription) {
            subscription.status = 'active';
            subscription.lastPaymentTransactionId = razorpayPaymentId;
            subscription.paymentProvider = 'razorpay';
            subscription.autoRenew = true;
            subscription.isFreeTrial = false;
            await subscription.save();

            await subscription.populate('currentPlan');

            return res.status(200).json({
                success: true,
                message: 'Payment verified and subscription activated',
                subscription: {
                    id: subscription._id,
                    plan: subscription.currentPlan,
                    status: subscription.status,
                    startDate: subscription.startDate,
                    expiryDate: subscription.expiryDate,
                    daysRemaining: subscriptionUtils.getDaysRemaining(subscription),
                },
            });
        }

        res.status(500).json({
            success: false,
            message: 'Subscription not found',
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying payment',
            error: error.message,
        });
    }
};

/**
 * Get payment history
 * GET /api/subscription/payment-history
 */
exports.getPaymentHistory = async (req, res) => {
    try {
        const writerId = req.user.id;
        const { limit = 10, skip = 0 } = req.query;

        const payments = await SubscriptionPayment.find({ writer: writerId })
            .populate('plan')
            .sort({ paymentAttemptedAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await SubscriptionPayment.countDocuments({ writer: writerId });

        const formattedPayments = payments.map(payment => ({
            id: payment._id,
            orderId: payment.orderId,
            transactionId: payment.transactionId,
            amount: subscriptionUtils.formatPrice(payment.amount, payment.currency),
            currency: payment.currency,
            status: payment.status,
            paymentMethod: payment.paymentMethod,
            plan: payment.plan?.name,
            planDisplayName: payment.plan?.displayName,
            subscriptionStartDate: payment.subscriptionStartDate,
            subscriptionEndDate: payment.subscriptionEndDate,
            paymentAttemptedAt: payment.paymentAttemptedAt,
            paymentCompletedAt: payment.paymentCompletedAt,
            failureReason: payment.failureReason,
        }));

        res.status(200).json({
            success: true,
            payments: formattedPayments,
            pagination: {
                total,
                limit: parseInt(limit),
                skip: parseInt(skip),
            },
        });
    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching payment history',
            error: error.message,
        });
    }
};

/**
 * Cancel subscription
 * POST /api/subscription/cancel
 */
exports.cancelSubscription = async (req, res) => {
    try {
        const writerId = req.user.id;
        const { cancellationReason } = req.body;

        const subscription = await WriterSubscription.findOne({ writer: writerId });

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'No subscription found',
            });
        }

        if (subscription.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Subscription is already cancelled',
            });
        }

        subscription.status = 'cancelled';
        subscription.cancellationReason = cancellationReason || 'User requested';
        subscription.cancelledAt = new Date();
        subscription.autoRenew = false;

        await subscription.save();

        res.status(200).json({
            success: true,
            message: 'Subscription cancelled successfully',
            subscription: {
                id: subscription._id,
                status: subscription.status,
                cancelledAt: subscription.cancelledAt,
            },
        });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling subscription',
            error: error.message,
        });
    }
};

/**
 * Check if writer can perform specific action
 * POST /api/subscription/check-action
 */
exports.checkActionPermission = async (req, res) => {
    try {
        const writerId = req.user.id;
        const { actionType, currentCount } = req.body;

        if (!actionType) {
            return res.status(400).json({
                success: false,
                message: 'actionType is required',
            });
        }

        const result = await subscriptionUtils.canPerformAction(writerId, actionType, currentCount || 0);

        res.status(result.allowed ? 200 : 403).json({
            success: result.allowed,
            allowed: result.allowed,
            reason: result.reason,
            limit: result.limit,
        });
    } catch (error) {
        console.error('Error checking action permission:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking action permission',
            error: error.message,
        });
    }
};

/**
 * Get writer's earnings multiplier based on subscription
 * GET /api/subscription/earnings-multiplier
 */
exports.getEarningsMultiplier = async (req, res) => {
    try {
        const writerId = req.user.id;
        const multiplier = await subscriptionUtils.getEarningsMultiplier(writerId);

        res.status(200).json({
            success: true,
            multiplier,
            percentage: (multiplier * 100).toFixed(0) + '%',
        });
    } catch (error) {
        console.error('Error getting earnings multiplier:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting earnings multiplier',
            error: error.message,
        });
    }
};

/**
 * Handle webhook from Razorpay
 * This is called by Razorpay to notify about payment status changes
 * 
 * POST /api/subscription/webhook
 */
exports.handlePaymentWebhook = async (req, res) => {
    try {
        const { event, payload } = req.body;

        console.log('Razorpay webhook received:', event);

        // TODO: Implement webhook signature verification
        // Use razorpay-signature header to verify authenticity

        // Handle different Razorpay events
        if (event === 'payment.authorized' || event === 'payment.captured') {
            // Payment successful
            console.log('Payment captured:', payload);
        } else if (event === 'payment.failed') {
            // Payment failed
            console.log('Payment failed:', payload);
        } else if (event === 'subscription.charged') {
            // Subscription renewal charged
            console.log('Subscription charged:', payload);
        }

        // Acknowledge receipt
        res.status(200).json({
            success: true,
            message: 'Webhook received and processed',
        });
    } catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Error handling webhook',
            error: error.message,
        });
    }
};



// GET /api/subscription/eligibility
exports.getFreeTrialEligibility = async (req, res) => {
    try {
        const writerId = req.user.id;
        const subscription = await WriterSubscription.findOne({ writer: writerId });

        const now = new Date();
        const hasActiveTrial = !!(subscription && subscription.isFreeTrial && subscription.expiryDate && subscription.expiryDate > now);
        const freeTrialUsedCount = subscription ? subscription.freeTrialUsageCount || 0 : 0;

        const canEnrollFreeTrial = !hasActiveTrial && freeTrialUsedCount === 0;

        res.status(200).json({
            success: true,
            canEnrollFreeTrial,
            hasActiveTrial,
            freeTrialUsedCount,
            // if active, useful metadata
            activeTrial: hasActiveTrial ? {
                planId: subscription._id,
                planName: (subscription.currentPlan && subscription.currentPlan.name) || 'premium',
                expiryDate: subscription.expiryDate,
                daysRemaining: subscriptionUtils.getDaysRemaining(subscription)
            } : null
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error checking eligibility', error: err.message });
    }
};
