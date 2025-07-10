const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  chatId: String,
  score: Number,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Quiz", quizSchema);
