const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});

const upload = multer({ storage });

// Get profile
router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json(user);
});

// Update profile info
router.put("/update", auth, async (req, res) => {
  const { username } = req.body;
  const user = await User.findByIdAndUpdate(req.user.id, { username }, { new: true });
  res.json(user);
});

// Upload profile picture
router.post("/upload-pic", auth, upload.single("profilePic"), async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { profilePic: `/uploads/${req.file.filename}` },
    { new: true }
  );
  res.json({ profilePic: user.profilePic });
});

// Update quiz stats and track progress over time
router.post("/update-quiz", auth, async (req, res) => {
  const { score } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.quizzesTaken += 1;
  user.totalScore += score;

  // Push score with timestamp to progress array
  user.progress.push({ score, date: new Date() });

  await user.save();

  res.json({
    quizzesTaken: user.quizzesTaken,
    avgScore: (user.totalScore / user.quizzesTaken).toFixed(2),
    progress: user.progress,
  });
});

module.exports = router;
