const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  summary: String,
  messages: [{ text: String, sender: String }],
  content: { type: String }, // ✅ should be present
}, { timestamps: true });

module.exports = mongoose.model("Chat", chatSchema);
