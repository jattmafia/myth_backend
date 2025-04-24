const express = require('express');
const router = express.Router();
const { signupUser, loginUser, verifyOtp, sendOtp, verifyPasswordResetOtp, requestPasswordReset, resetPassword } = require('../controllers/authController');
const { sign } = require('jsonwebtoken');

// POST: Sign Up
router.post('/signup', signupUser);
router.post('/login', loginUser);
router.post('/verifyemail-otp', verifyOtp);
router.post('/sendemail-otp', sendOtp);
router.post('/sendpasswordreset-otp', requestPasswordReset);
router.post('/verifypasswordreset-otp', verifyPasswordResetOtp);
router.post('/resetpassword', resetPassword);


module.exports = router;