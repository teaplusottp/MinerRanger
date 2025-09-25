import express from "express";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Please fill all the fields" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({ username, email, password });
    const token = generateToken(user._id);
    res.status(201).json({
      id: user._id,
      username: user.username,
      email: user.email,
      token,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all the fields" });
    }
    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = generateToken(user._id);
    res.status(200).json({
      id: user._id,
      username: user.username,
      email: user.email,
      token,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Me
router.get("/me", protect, async (req, res) => {
  res.status(200).json(req.user);
});

// Dashboard
router.get("/dashboard", protect, async (req, res) => {
  const safeUser = req.user
    ? {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
      }
    : null;

  res.status(200).json({
    user: safeUser,
    message: safeUser?.username
      ? `Welcome back, ${safeUser.username}!`
      : "Welcome to your dashboard!",
  });
});

router.patch("/profile", protect, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      telNumber,
      gender,
      username,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const normalizeValue = (value) => {
      if (value === undefined || value === null) {
        return "";
      }
      return String(value).trim();
    };

    let hasChanges = false;

    if (typeof username !== "undefined") {
      const sanitizedUsername = normalizeValue(username);

      if (!sanitizedUsername) {
        return res.status(400).json({ message: "Username cannot be empty" });
      }

      if (sanitizedUsername !== user.username) {
        const usernameExists = await User.findOne({ username: sanitizedUsername });
        if (usernameExists && usernameExists._id.toString() !== user._id.toString()) {
          return res.status(400).json({ message: "Username already taken" });
        }

        user.username = sanitizedUsername;
        hasChanges = true;
      }
    }

    const applyUpdate = (field, rawValue) => {
      if (typeof rawValue === "undefined") {
        return;
      }
      const nextValue = normalizeValue(rawValue);
      if (user[field] !== nextValue) {
        user[field] = nextValue;
        hasChanges = true;
      }
    };

    applyUpdate("firstName", firstName);
    applyUpdate("lastName", lastName);
    applyUpdate("telNumber", telNumber);
    applyUpdate("gender", gender);

    if (!hasChanges) {
      return res.json({
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        telNumber: user.telNumber,
        gender: user.gender,
      });
    }

    const updatedUser = await user.save();

    return res.json({
      id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      telNumber: updatedUser.telNumber,
      gender: updatedUser.gender,
    });
  } catch (err) {
    console.error("Failed to update profile:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

export default router;
