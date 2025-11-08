/**
 * In-App Purchase Verification Helper
 * Provides utilities for verifying receipts with Apple App Store and Google Play Store
 */

const https = require('https');

/**
 * Verify App Store receipt
 * @param {string} receipt - Base64 encoded receipt
 * @param {string} bundleId - Bundle ID
 * @returns {Promise<Object>} Verification result
 */
exports.verifyAppStoreReceipt = async (receipt, bundleId) => {
    return new Promise((resolve, reject) => {
        // TODO: Implement App Store receipt verification
        // Use: https://buy.itunes.apple.com/verifyReceipt (production)
        // Or: https://sandbox.itunes.apple.com/verifyReceipt (sandbox)

        const payload = JSON.stringify({
            'receipt-data': receipt,
            'password': process.env.APP_STORE_SHARED_SECRET,
        });

        const options = {
            hostname: 'buy.itunes.apple.com',
            path: '/verifyReceipt',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': payload.length,
            },
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const result = JSON.parse(data);

                    // Status codes:
                    // 0 - Valid receipt
                    // 21000 - Invalid JSON
                    // 21002 - Receipt data malformed
                    // 21003 - Receipt could not be authenticated
                    // 21004 - Shared secret does not match
                    // 21005 - Receipt server unavailable
                    // 21006 - Receipt is valid but subscription expired
                    // 21007 - Sandbox receipt sent to production validation
                    // 21008 - Production receipt sent to sandbox validation

                    if (result.status === 0) {
                        const latestReceipt = result.latest_receipt_info || [];
                        resolve({
                            valid: true,
                            bundleId: result.bundle_id,
                            productId: latestReceipt[0]?.product_id,
                            expiryDate: new Date(parseInt(latestReceipt[0]?.expires_date_ms)),
                            originalTransactionId: latestReceipt[0]?.original_transaction_id,
                            transactionId: latestReceipt[0]?.transaction_id,
                            bundleIdMatch: result.bundle_id === bundleId,
                        });
                    } else if (result.status === 21006) {
                        // Subscription expired
                        resolve({
                            valid: false,
                            expired: true,
                            status: result.status,
                        });
                    } else {
                        resolve({
                            valid: false,
                            status: result.status,
                        });
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(payload);
        req.end();
    });
};

/**
 * Verify Google Play Store purchase
 * @param {string} packageName - Package name
 * @param {string} productId - Product ID
 * @param {string} token - Purchase token
 * @returns {Promise<Object>} Verification result
 */
exports.verifyPlayStoreReceipt = async (packageName, productId, token) => {
    return new Promise((resolve, reject) => {
        // TODO: Implement Google Play Store verification
        // Use Google Play Developer API
        // Requires: service account credentials

        // Placeholder implementation
        resolve({
            valid: true,
            packageName,
            productId,
            purchaseTime: new Date(),
            expiryTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            purchaseState: 'purchased', // or 'canceled'
        });
    });
};

/**
 * Verify RevenueCat purchase
 * @param {string} userId - RevenueCat user ID
 * @returns {Promise<Object>} User's active subscriptions
 */
exports.verifyRevenuecat = async (userId) => {
    return new Promise((resolve, reject) => {
        // TODO: Implement RevenueCat verification
        // Use RevenueCat API
        // https://api.revenuecat.com/v1/subscribers/:user_id

        // Placeholder implementation
        resolve({
            valid: true,
            activeSubscriptions: [],
        });
    });
};

/**
 * Parse App Store receipt to extract info
 * Note: This is just parsing, not validation
 * Always validate with Apple's servers
 */
exports.parseAppStoreReceipt = (receiptData) => {
    try {
        const decoded = Buffer.from(receiptData, 'base64').toString('utf-8');
        return JSON.parse(decoded);
    } catch (error) {
        return null;
    }
};

/**
 * Check if subscription is still valid
 * @param {Object} subscription - Subscription object from verification
 * @returns {boolean} Is subscription valid
 */
exports.isSubscriptionValid = (subscription) => {
    if (!subscription || !subscription.expiryDate) {
        return false;
    }

    const now = new Date();
    const expiry = new Date(subscription.expiryDate);

    return expiry > now;
};

/**
 * Get days remaining in subscription
 * @param {Object} subscription - Subscription object from verification
 * @returns {number} Days remaining
 */
exports.getDaysRemaining = (subscription) => {
    if (!subscription || !subscription.expiryDate) {
        return 0;
    }

    const now = new Date();
    const expiry = new Date(subscription.expiryDate);

    if (expiry <= now) {
        return 0;
    }

    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
};

/**
 * Validate receipt structure for in-app purchase
 * @param {Object} data - Request data containing receipt info
 * @returns {Object} Validation result
 */
exports.validateReceiptData = (data) => {
    const errors = [];

    if (!data.receipt) {
        errors.push('receipt is required');
    }

    if (!data.platform) {
        errors.push('platform is required (app_store or play_store)');
    }

    if (!['app_store', 'play_store'].includes(data.platform)) {
        errors.push('platform must be app_store or play_store');
    }

    if (!data.productId) {
        errors.push('productId is required');
    }

    if (data.platform === 'app_store' && !data.bundleId) {
        errors.push('bundleId is required for app_store receipts');
    }

    if (data.platform === 'play_store' && !data.packageName) {
        errors.push('packageName is required for play_store receipts');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
};

/**
 * Map product ID to subscription plan
 * @param {string} productId - Product ID from store
 * @returns {string|null} Plan name (basic, premium, pro) or null
 */
exports.mapProductToPlan = (productId) => {
    if (!productId) return null;

    const productLower = productId.toLowerCase();

    if (productLower.includes('pro')) {
        return 'pro';
    } else if (productLower.includes('premium')) {
        return 'premium';
    } else if (productLower.includes('basic')) {
        return 'basic';
    }

    return null;
};

/**
 * Create receipt record for auditing
 * @param {Object} data - Receipt data
 * @returns {Object} Record for database
 */
exports.createReceiptRecord = (data) => {
    return {
        platform: data.platform,
        productId: data.productId,
        bundleIdOrPackage: data.bundleId || data.packageName,
        receiptHash: require('crypto')
            .createHash('sha256')
            .update(data.receipt)
            .digest('hex'),
        receiptData: data.receipt.substring(0, 50) + '...', // Store partial for reference
        verificationTime: new Date(),
    };
};
