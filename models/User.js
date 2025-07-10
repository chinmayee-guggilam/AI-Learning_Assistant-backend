const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  profilePic: String,
  quizzesTaken: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 },
  progress: [
    {
      score: Number,
      date: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model("User", UserSchema);
