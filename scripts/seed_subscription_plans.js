/**
 * Seed subscription plans into the database
 * Run: node scripts/seed_subscription_plans.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SubscriptionPlan = require('../src/models/subscriptionPlan');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        process.exit(1);
    }
};

const plans = [
    {
        name: 'premium',
        displayName: 'Premium Plan',
        description: 'Free for 1 month, then ₹199/month - 90% revenue for writers',
        durationDays: 30,
        price: 0, // FREE for first month, then ₹199
        recurringPrice: 19900, // ₹199 in paise
        currency: 'INR',
        razorpayPlanId: 'plan_Rd7PRr4yG02pIq', // YOUR RAZORPAY PLAN ID
        razorpaySubscriptionId: 'sub_Rd7RX3lWn0tzkR', // YOUR RAZORPAY SUBSCRIPTION ID
        features: [
            {
                name: 'Unlimited Novels',
                description: 'Create unlimited novels',
                limit: null,
            },
            {
                name: 'Unlimited Chapters',
                description: 'Upload unlimited chapters per novel',
                limit: null,
            },
            {
                name: 'Unlimited Monetization',
                description: 'Monetize your novels with NO view limits - earn 90%',
                limit: null,
            },
            {
                name: 'Custom Cover',
                description: 'Use custom cover images for your novels',
                limit: null,
            },
            {
                name: 'Analytics',
                description: 'View reading statistics and insights',
                limit: null,
            },
            {
                name: 'No Minimum View Requirement',
                description: 'Start earning from your first reader',
                limit: null,
            },
            {
                name: 'Auto-Renewal',
                description: 'Automatically renews monthly after free period',
                limit: null,
            },
        ],
        limits: {
            maxNovels: null,
            maxChaptersPerNovel: null,
            maxChapterUploadSizeMB: 50,
            canMonetize: true,
            canUseCustomCover: true,
            hasAnalytics: true,
            canScheduleChapters: false,
            hasAIAssistance: false,
            earningsMultiplier: 1.0,
        },
        platformFeePercentage: 10, // App gets 10%, writer gets 90%
        isActive: true,
        displayOrder: 1,
    },
];

const seedPlans = async () => {
    try {
        await connectDB();

        // Clear existing plans
        await SubscriptionPlan.deleteMany({});
        console.log('Cleared existing plans');

        // Insert new plans
        const createdPlans = await SubscriptionPlan.insertMany(plans);
        console.log(`\n✅ Successfully seeded ${createdPlans.length} subscription plan:\n`);

        createdPlans.forEach(plan => {
            const isFree = plan.price === 0;
            const priceText = isFree ? 'FREE (first month), then ₹199/month' : `₹${plan.price / 100}`;
            const revenueText = `Writer: ${100 - plan.platformFeePercentage}% | App: ${plan.platformFeePercentage}%`;
            console.log(`✅ ${plan.displayName} (${plan.name}): ${priceText}`);
            console.log(`   Revenue Split: ${revenueText}`);
            console.log(`   Razorpay Plan ID: ${plan.razorpayPlanId}`);
            console.log(`   Razorpay Subscription ID: ${plan.razorpaySubscriptionId}`);
            console.log(`   Features: Unlimited novels, unlimited chapters, monetization with NO view limits\n`);
        });

        console.log('✅ Subscription plans seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding plans:', error);
        process.exit(1);
    }
};

seedPlans();
