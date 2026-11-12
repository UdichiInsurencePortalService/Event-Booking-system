const OTP = require("../models/OTP");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendOTPEmail } = require("../utils/email");

// Generate JWT token
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// Generate a secure 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// Create and send account verification OTP
const createAndSendVerificationOTP = async (email) => {
  const otp = generateOTP();

  // Remove previous account verification OTPs
  await OTP.deleteMany({
    email,
    action: "account_verification",
  });

  // Save new OTP with 5-minute expiry
  await OTP.create({
    email,
    otp,
    action: "account_verification",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  // Send OTP to user's email
  const emailSent = await sendOTPEmail(
    email,
    otp,
    "account_verification"
  );

  if (!emailSent) {
    await OTP.deleteMany({
      email,
      action: "account_verification",
    });

    return false;
  }

  return true;
};

// REGISTER USER
exports.registerUser = async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = req.body.email?.trim().toLowerCase();

    // Validate required fields
    if (!name?.trim() || !email || !password) {
      return res.status(400).json({
        error: "Name, email and password are required",
      });
    }

    // Check whether user already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        error: "User already exists",
      });
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in MongoDB
    const user = await User.create({
      name: name.trim(),
      email,
      password: hashedPassword,
      role: "user",
      isVerified: false,
    });

    // Generate, save and send verification OTP
    const emailSent = await createAndSendVerificationOTP(email);

    if (!emailSent) {
      return res.status(500).json({
        error: "Registration started, but OTP email could not be sent. Please try logging in to request a new OTP.",
      });
    }

    return res.status(201).json({
      message: "Registration successful. Please verify your email using the OTP.",
      email: user.email,
    });

  } catch (error) {
    console.error("Register error:", error);

    // Handle duplicate email database error
    if (error.code === 11000) {
      return res.status(400).json({
        error: "User already exists",
      });
    }

    return res.status(500).json({
      error: "Registration failed",
    });
  }
};

// LOGIN USER
exports.loginUser = async (req, res) => {
  try {
    const { password } = req.body;
    const email = req.body.email?.trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        error: "Invalid credentials. Please sign up first.",
      });
    }

    // Compare entered password with stored hash
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        error: "Invalid credentials",
      });
    }

    // Send a new OTP if normal user account is not verified
    if (!user.isVerified && user.role === "user") {
      const emailSent = await createAndSendVerificationOTP(email);

      if (!emailSent) {
        return res.status(500).json({
          error: "Could not send OTP email. Please try again.",
        });
      }

      return res.status(403).json({
        error: "Account not verified. A new OTP has been sent to your email.",
      });
    }

    // Login successful: generate JWT
    return res.status(200).json({
      message: "Login successful",
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "Login failed",
    });
  }
};

// VERIFY OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const email = req.body.email?.trim().toLowerCase();

    if (!email || !otp) {
      return res.status(400).json({
        error: "Email and OTP are required",
      });
    }

    // Find only a matching OTP that has not expired
    const otpRecord = await OTP.findOne({
      email,
      otp: String(otp).trim(),
      action: "account_verification",
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({
        error: "Invalid or expired OTP",
      });
    }

    // Mark user's account as verified
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { isVerified: true } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // Delete used verification OTP
    await OTP.deleteMany({
      email,
      action: "account_verification",
    });

    // Return verified user and JWT
    return res.status(200).json({
      message: "Account verified successfully. You can now log in.",
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });

  } catch (error) {
    console.error("OTP verification error:", error);

    return res.status(500).json({
      error: "OTP verification failed",
    });
  }
};