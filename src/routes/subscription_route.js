const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const {
    activateFreePlan,
    getCurrentSubscription,
    getAvailablePlans,
    getPlanDetails,
    initiatePayment,
    verifyPayment,
    getPaymentHistory,
    cancelSubscription,
    checkActionPermission,
    getEarningsMultiplier,
    handlePaymentWebhook,
    getFreeTrialEligibility,
} = require('../controllers/subscriptionController');
const { attachSubscriptionInfo } = require('../middleware/subscriptionMiddleware');

const router = express.Router();

/**
 * Public routes - No authentication required
 */

// Get all available subscription plans
router.get('/plans', getAvailablePlans);

// Get specific plan details
router.get('/plans/:planId', getPlanDetails);

/**
 * Protected routes - Authentication required
 */

// Activate free plan (1 month free trial)
router.post('/activate-free-plan', verifyToken, activateFreePlan);

// Get current user's subscription
router.get('/current', verifyToken, getCurrentSubscription);

// Initiate payment for plan upgrade
router.post('/initiate-payment', verifyToken, initiatePayment);

// Verify payment from Razorpay
router.post('/verify-payment', verifyToken, verifyPayment);

// Get payment history
router.get('/payment-history', verifyToken, getPaymentHistory);

// Cancel subscription
router.post('/cancel', verifyToken, cancelSubscription);

// Check if writer can perform specific action
router.post('/check-action', verifyToken, checkActionPermission);

// Get writer's earnings multiplier
router.get('/earnings-multiplier', verifyToken, getEarningsMultiplier);

/**
 * Webhook routes - Called by payment providers
 */

// Razorpay webhook
router.post('/webhook', handlePaymentWebhook);

// Check free trial eligibility
router.get('/eligibility', verifyToken, getFreeTrialEligibility);

module.exports = router;
