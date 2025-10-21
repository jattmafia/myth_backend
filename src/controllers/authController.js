const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Otp = require('../models/otp');
const nodemailer = require('nodemailer');


const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
  const { idToken, deviceId, deviceName } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: 'ID Token is required' });
  }

  try {
    // Verify the ID token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;
    const loginType = 'google';
    const username = payload.email; // Google doesn't provide phone number by default


    // Check if the user already exists
    let user = await User.findOne({ email });


    if (!user) {
      // If user doesn't exist, create a new one
      user = new User({
        googleId,
        email,
        loginType,
        deviceId,
        deviceName,
        username,

      });
      await user.save();
    }

    if (user.loginType !== 'google') {
      return res.status(400).json({ message: 'User already registered with email' });
    }

    // Generate a JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    });

    res.status(200).json({ message: 'Google login successful', token, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to authenticate with Google' });
  }
};






exports.resetPassword = async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;

  if (!email || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  try {
    // Find the user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword;
    user.confirmPassword = confirmPassword; // This field is not necessary for the user model, but included for consistency
    await user.save();

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
};


exports.verifyPasswordResetOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  try {
    // Find the OTP in the database
    const storedOtp = await Otp.findOne({ email });

    // Check if OTP exists and is valid
    if (!storedOtp || storedOtp.otp !== otp || storedOtp.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // OTP is valid, delete it from the database
    await Otp.deleteOne({ email });

    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
};


exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.loginType !== 'email') {
      return res.status(400).json({ message: 'User is not registered with email' });
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set OTP expiration time (5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Save OTP to the database
    const existingOtp = await Otp.findOne({ email });
    if (existingOtp) {
      existingOtp.otp = otp;
      existingOtp.expiresAt = expiresAt;
      await existingOtp.save();
    } else {
      await Otp.create({ email, otp, expiresAt });
    }

    // Configure nodemailer and send the OTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });



    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset OTP',
      text: `Your OTP for password reset is ${otp}. It is valid for 5 minutes.`,
    });

    res.status(200).json({ message: 'OTP sent to email' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};

exports.sendOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  // check if the email is already registered
  const userExists = await User.findOne({ $or: [{ email }] });
  if (userExists) {
    return res.status(400).json({ message: 'Email already exists' });
  }

  try {

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set OTP expiration time (5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Check if an OTP already exists for the email




    const existingOtp = await Otp.findOne({ email });

    if (existingOtp) {
      // Update the existing OTP
      existingOtp.otp = otp;
      existingOtp.expiresAt = expiresAt;
      await existingOtp.save();
    } else {
      // Create a new OTP entry
      await Otp.create({ email, otp, expiresAt });
    }
    const emailContent = `
    <p>Hi Dear User,</p>
    <p>Welcome to <strong>Mytho Novel</strong>!</p>
    <p>Your One-Time Password (OTP) for account verification is:</p>
    <h2>${otp}</h2>
    <p>This OTP is valid for the next <strong>5 minutes</strong>. Please do not share this code with anyone.</p>
    <p>If you did not request this OTP, please ignore this email.</p>
    <br>
    <p>Thank you for choosing <strong>Mytho Novel</strong> – Where Stories Come Alive!</p>
    <br>
    <p>---<br>Stay connected,<br>The Mytho Novel Team</p>
  `;
    // Configure nodemailer and send the OTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP for Email Verification',
      html: emailContent,
    });

    res.status(200).json({ message: 'OTP sent to email' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  try {
    // Find the OTP in the database
    const storedOtp = await Otp.findOne({ email });

    // Check if OTP exists and is valid
    if (!storedOtp || storedOtp.otp !== otp || storedOtp.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // OTP is valid, delete it from the database
    await Otp.deleteOne({ email });

    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
};

// Handle user login
exports.loginUser = async (req, res) => {
  const { emailOrUsername, password } = req.body;

  // Validation
  if (!emailOrUsername || !password) {
    return res.status(400).json({ message: 'Email/Username and password are required' });
  }

  try {
    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate a JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const userObj = user.toObject();
    delete userObj.password;
    res.status(200).json({ message: 'Login successful', token, userObj });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
// Handle user signup
exports.signupUser = async (req, res) => {
  const { username, email, phoneNumber, password, confirmPassword, deviceId, deviceName } = req.body;

  // Validation
  if (!username || !email || !phoneNumber || !password || !confirmPassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  try {
    // Check if email or phone number already exists
    const userExists = await User.findOne({ $or: [{ email }, { phoneNumber }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: 'Email or Phone number or Username already exists' });
    }

    // Create a new user
    const user = new User({
      username,
      email,
      phoneNumber,
      password,
      confirmPassword,
      deviceId,
      deviceName,
    });

    // Save the user to the database
    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};




