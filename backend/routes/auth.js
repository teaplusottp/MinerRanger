import express from "express";
import multer from "multer";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import jwt from "jsonwebtoken";
import { createAvatarObjectName, uploadAvatarBuffer } from "../services/gcsUploader.js";

const router = express.Router();

const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AVATAR_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "image/png") {
      cb(new Error("Only PNG images are allowed"));
      return;
    }
    cb(null, true);
  },
});

const mapUserProfile = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  telNumber: user.telNumber,
  gender: user.gender,
  avatar: user.avatar,
  createdAt: user.createdAt,
});

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
    const profile = mapUserProfile(user);
    res.status(201).json({
      ...profile,
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
    const profile = mapUserProfile(user);
    res.status(200).json({
      ...profile,
      token,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Me
router.get("/me", protect, (req, res) => {
  res.status(200).json(mapUserProfile(req.user));
});

// Dashboard
router.get("/dashboard", protect, async (req, res) => {
  const safeUser = req.user ? mapUserProfile(req.user) : null;

  res.status(200).json({
    user: safeUser,
    message: safeUser?.username
      ? `Welcome back, ${safeUser.username}!`
      : "Welcome to your dashboard!",
  });
});

router.post("/avatar", protect, (req, res) => {
  const handleUpload = upload.single("avatar");
  handleUpload(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "Avatar exceeds the 5 MB limit." });
      }
      if (err?.message === "Only PNG images are allowed") {
        return res.status(400).json({ message: err.message });
      }
      console.error("Avatar upload failed:", err);
      return res.status(400).json({ message: "Unable to process avatar upload." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Avatar file is required." });
    }

    try {
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const destination = createAvatarObjectName(req.user._id.toString());
      const publicUrl = await uploadAvatarBuffer({
        buffer: req.file.buffer,
        destination,
        contentType: req.file.mimetype,
      });

      user.avatar = publicUrl;
      const updatedUser = await user.save();

      return res.json(mapUserProfile(updatedUser));
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      return res.status(500).json({ message: "Failed to upload avatar." });
    }
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
      currentPassword,
      confirmPassword,
      newPassword,
      confirmNewPassword,
    } = req.body;

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const normalizeValue = (value) => {
      if (value === undefined || value === null) {
        return "";
      }
      return String(value).trim();
    };

    const normalizePassword = (value) => {
      if (value === undefined || value === null) {
        return "";
      }
      return String(value);
    };

    let hasProfileChanges = false;
    let passwordChanged = false;

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
        hasProfileChanges = true;
      }
    }

    const passwordFields = [
      currentPassword,
      confirmPassword,
      newPassword,
      confirmNewPassword,
    ];

    const wantsPasswordChange = passwordFields.some(
      (field) => typeof field !== "undefined"
    );

    if (wantsPasswordChange) {
      const current = normalizePassword(currentPassword);
      const confirmCurrent = normalizePassword(confirmPassword);
      const nextPassword = normalizePassword(newPassword);
      const confirmNextPassword = normalizePassword(confirmNewPassword);

      if (
        !current.trim() ||
        !confirmCurrent.trim() ||
        !nextPassword.trim() ||
        !confirmNextPassword.trim()
      ) {
        return res.status(400).json({ message: "Please fill in all password fields." });
      }

      if (current !== confirmCurrent) {
        return res
          .status(400)
          .json({ message: "Current password confirmation does not match." });
      }

      if (nextPassword !== confirmNextPassword) {
        return res
          .status(400)
          .json({ message: "New password confirmation does not match." });
      }

      if (current === nextPassword) {
        return res
          .status(400)
          .json({ message: "New password must be different from current password." });
      }

      const isCurrentValid = await user.matchPassword(current);

      if (!isCurrentValid) {
        return res.status(400).json({ message: "Current password is incorrect." });
      }

      const isReusingPassword = await user.matchPassword(nextPassword);
      if (isReusingPassword) {
        return res
          .status(400)
          .json({ message: "New password must be different from current password." });
      }

      user.password = nextPassword;
      user.markModified("password");
      passwordChanged = true;
    }

    const applyUpdate = (field, rawValue) => {
      if (typeof rawValue === "undefined") {
        return;
      }
      const nextValue = normalizeValue(rawValue);
      if (user[field] !== nextValue) {
        user[field] = nextValue;
        hasProfileChanges = true;
      }
    };

    applyUpdate("firstName", firstName);
    applyUpdate("lastName", lastName);
    applyUpdate("telNumber", telNumber);
    applyUpdate("gender", gender);

    if (!hasProfileChanges && !passwordChanged) {
      return res.json({
        ...mapUserProfile(user),
        passwordChanged: false,
      });
    }

    const updatedUser = await user.save();

    return res.json({
      ...mapUserProfile(updatedUser),
      passwordChanged,
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



