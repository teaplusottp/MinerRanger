import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

import User from "../models/User.js";
import PasswordResetToken from "../models/PasswordResetToken.js";
import { sendPasswordResetOtp } from "../services/emailService.js";

const router = express.Router();

const OTP_LENGTH = 6;
const OTP_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const OTP_EXPIRATION_MINUTES = Number(process.env.OTP_EXPIRATION_MINUTES || 10);
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);
const OTP_MAX_FAILED_ATTEMPTS = Number(process.env.OTP_MAX_FAILED_ATTEMPTS || 5);
const PASSWORD_MIN_LENGTH = Number(process.env.RESET_PASSWORD_MIN_LENGTH || 8);
const GENERIC_SUCCESS_MESSAGE = "If the email exists in our system, an OTP has been sent.";
const GENERIC_OTP_ERROR_MESSAGE = "Incorrect email or OTP code.";

const createRateLimiter = ({ windowMs, max }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      message: "Too many attempts. Please try again later.",
    },
    keyGenerator: (req) => {
      const email = req.body?.email;
      if (email) {
        return String(email).trim().toLowerCase();
      }
      return ipKeyGenerator(req.ip);
    },
  });

const requestOtpLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
const verifyOtpLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const resetPasswordLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

const normalizeEmail = (rawEmail) => String(rawEmail || "").trim().toLowerCase();
const normalizeOtp = (rawOtp) => String(rawOtp || "").trim().toUpperCase();

const generateOtp = () =>
  Array.from({ length: OTP_LENGTH }, () => {
    const index = crypto.randomInt(0, OTP_ALPHABET.length);
    return OTP_ALPHABET[index];
  }).join("");

const isValidEmail = (email) =>
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);

const isValidOtp = (otp) =>
  /^[A-Z0-9]{6}$/.test(otp);

const fetchLatestActiveToken = async (email) =>
  PasswordResetToken.findOne({ email, used: false }).sort({ createdAt: -1 });

router.post("/request-otp", requestOtpLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Email format is invalid." });
  }

  let createdToken;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Email has not existed." });
    }

    const existingToken = await fetchLatestActiveToken(email);
    if (existingToken) {
      const now = new Date();
      const secondsSinceLast = (now.getTime() - existingToken.createdAt.getTime()) / 1000;
      if (secondsSinceLast < OTP_RESEND_COOLDOWN_SECONDS) {
        return res.status(429).json({ message: "Please wait before requesting a new OTP." });
      }
      await PasswordResetToken.deleteMany({ email });
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

    createdToken = await PasswordResetToken.create({
      email,
      otpHash,
      expiresAt,
    });

    await sendPasswordResetOtp({ to: user.email, otp });

    return res.status(200).json({ message: GENERIC_SUCCESS_MESSAGE });
  } catch (err) {
    if (createdToken?._id) {
      try {
        await PasswordResetToken.deleteOne({ _id: createdToken._id });
      } catch (cleanupErr) {
        console.error("Failed to cleanup OTP token:", cleanupErr);
      }
    }
    console.error("Failed to process OTP request:", err);
    return res.status(500).json({ message: "Unable to process request." });
  }
});

router.post("/verify-otp", verifyOtpLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const otp = normalizeOtp(req.body?.otp);

  if (!email || !isValidEmail(email) || !isValidOtp(otp)) {
    return res.status(400).json({ message: GENERIC_OTP_ERROR_MESSAGE });
  }

  try {
    const token = await fetchLatestActiveToken(email);
    if (!token) {
      return res.status(400).json({ message: GENERIC_OTP_ERROR_MESSAGE });
    }

    if (token.failedAttempts >= OTP_MAX_FAILED_ATTEMPTS) {
      return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." });
    }

    if (token.expiresAt.getTime() < Date.now()) {
      token.used = true;
      await token.save();
      return res.status(400).json({ message: GENERIC_OTP_ERROR_MESSAGE });
    }

    const isMatch = await bcrypt.compare(otp, token.otpHash);

    token.lastAttemptAt = new Date();

    if (!isMatch) {
      token.failedAttempts += 1;
      await token.save();
      const remaining = Math.max(OTP_MAX_FAILED_ATTEMPTS - token.failedAttempts, 0);
      const message = remaining
        ? `${GENERIC_OTP_ERROR_MESSAGE} You have ${remaining} attempts left.`
        : "Too many incorrect attempts. Please request a new OTP.";
      const status = remaining ? 400 : 429;
      return res.status(status).json({ message });
    }

    token.failedAttempts = 0;
    await token.save();

    return res.status(200).json({ message: "OTP verified successfully." });
  } catch (err) {
    console.error("Failed to verify OTP:", err);
    return res.status(500).json({ message: "Unable to verify OTP." });
  }
});

router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const otp = normalizeOtp(req.body?.otp);
  const password = String(req.body?.password || "").trim();

  if (!email || !isValidEmail(email) || !isValidOtp(otp)) {
    return res.status(400).json({ message: GENERIC_OTP_ERROR_MESSAGE });
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return res.status(400).json({ message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
  }

  try {
    const token = await fetchLatestActiveToken(email);
    if (!token) {
      return res.status(400).json({ message: GENERIC_OTP_ERROR_MESSAGE });
    }

    if (token.failedAttempts >= OTP_MAX_FAILED_ATTEMPTS) {
      return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." });
    }

    if (token.used || token.expiresAt.getTime() < Date.now()) {
      token.used = true;
      await token.save();
      return res.status(400).json({ message: GENERIC_OTP_ERROR_MESSAGE });
    }

    const isMatch = await bcrypt.compare(otp, token.otpHash);
    token.lastAttemptAt = new Date();

    if (!isMatch) {
      token.failedAttempts += 1;
      await token.save();
      const remaining = Math.max(OTP_MAX_FAILED_ATTEMPTS - token.failedAttempts, 0);
      const message = remaining
        ? `${GENERIC_OTP_ERROR_MESSAGE} You have ${remaining} attempts left.`
        : "Too many incorrect attempts. Please request a new OTP.";
      const status = remaining ? 400 : 429;
      return res.status(status).json({ message });
    }

    const user = await User.findOne({ email });
    if (!user) {
      await PasswordResetToken.deleteMany({ email });
      return res.status(400).json({ message: GENERIC_OTP_ERROR_MESSAGE });
    }

    user.password = password;
    user.markModified("password");
    await user.save();

    token.used = true;
    token.failedAttempts = 0;
    await token.save();
    await PasswordResetToken.deleteMany({ email, _id: { $ne: token._id } });

    return res.status(200).json({ message: "Password has been reset successfully." });
  } catch (err) {
    console.error("Failed to reset password:", err);
    return res.status(500).json({ message: "Unable to reset password." });
  }
});

export default router;

