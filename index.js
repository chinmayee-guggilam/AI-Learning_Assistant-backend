const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fetch = require("node-fetch");
require("dotenv").config();
const userRoutes = require("./routes/user");

const Chat = require("./models/Chat");
const User = require("./models/User");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/user", userRoutes);
app.use("/uploads", express.static("uploads")); // Add this

// 📦 Multer Setup
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 🌐 MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB Connected");
});

// 🔐 JWT Authentication Middleware
function authenticate(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// 📌 Register
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    const user = await User.create({ email, password: hashed });
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: "User already exists" });
  }
});

// 📌 Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: "Invalid password" });

  const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET);
  res.json({ token });
});

// 📌 Ask Question
app.post("/api/chat", authenticate, async (req, res) => {
  const { question, chatId } = req.body;

  try {
    const chat = await Chat.findOne({ _id: chatId, userId: req.user.id });
    if (!chat?.content) {
      return res.json({ answer: "⚠️ Please upload content first before asking questions." });
    }

    // Combine context + messages
    const history = chat.messages?.slice(-5).map((m) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    })) || [];

    // Add current question
    history.push({ role: "user", parts: [{ text: `Context: ${chat.content}\n\nQuestion: ${question}` }] });

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: history }),
      }
    );

    const geminiData = await geminiRes.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      return res.json({ answer: "⚠️ Gemini did not return an answer." });
    }

    // Save message history
    chat.messages.push({ sender: "user", text: question });
    chat.messages.push({ sender: "bot", text });
    await chat.save();

    res.json({ answer: text });
  } catch (err) {
    console.error("❌ Gemini chat error:", err);
    res.status(500).json({ error: "Gemini failed to respond" });
  }
});

// 📌 Fetch Single Chat by ID (needed after content upload)
app.get("/api/chat/:id", authenticate, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user.id }).select("summary messages content"); // ✅ include content
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    res.json({ chat });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chat" });
  }
});

// 📌 Upload Plain Text Content (per chat)
app.post("/api/content", authenticate, async (req, res) => {
  const { text, chatId } = req.body;
  try {
    if (chatId) {
  const existing = await Chat.findById(chatId);
  const updatedContent = (existing?.content || "") + "\n\n" + text;
  await Chat.findByIdAndUpdate(chatId, { content: updatedContent });
  res.json({ success: true, chatId });
}
 else {
      const chat = await Chat.create({
        userId: req.user.id,
        summary: "Untitled",
        messages: [],
        content: text,
      });
      res.json({ success: true, chatId: chat._id });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to save content" });
  }
});


// 📌 Upload PDF Content (per chat)
app.post("/api/upload-pdf", authenticate, upload.single("file"), async (req, res) => {
  const { chatId } = req.body;
  try {
    const data = await pdfParse(req.file.buffer);
    if (chatId) {
  const existing = await Chat.findById(chatId);
  const updatedContent = (existing?.content || "") + "\n\n" + data.text;
  await Chat.findByIdAndUpdate(chatId, { content: updatedContent });
  res.json({ success: true, chatId });
}
 else {
      const chat = await Chat.create({
        userId: req.user.id,
        summary: "Untitled",
        messages: [],
        content: data.text,
      });
      res.json({ success: true, chatId: chat._id });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to extract and save PDF text" });
  }
});


// 📌 Save Chat (for history)
app.post("/api/save-chat", authenticate, async (req, res) => {
  const { messages, chatId } = req.body;
  try {
    const firstUserMessage = messages.find(msg => msg.sender === "user");
    const summary = firstUserMessage ? firstUserMessage.text.slice(0, 40) : "Untitled";

    if (chatId) {
      const updated = await Chat.findByIdAndUpdate(
        chatId,
        {
          $set: { messages, summary },
        },
        { new: true }
      );
      res.json({ success: true, chat: updated });
    } else {
      const chat = await Chat.create({
        userId: req.user.id,
        messages,
        summary,
      });
      res.json({ success: true, chat });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to save chat" });
  }
});

app.post("/api/rename-chat", authenticate, async (req, res) => {
  const { chatId, newName } = req.body;
  try {
    const updated = await Chat.findOneAndUpdate(
      { _id: chatId, userId: req.user.id },
      { summary: newName },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Chat not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to rename chat" });
  }
});

// 📌 Get Profile Info
app.get("/api/profile", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("_id email");
    res.json({ user });
  } catch {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// 📌 Delete Chat
app.delete("/api/chat/:id", authenticate, async (req, res) => {
  try {
    const deleted = await Chat.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id, // make sure it's the owner
    });

    if (!deleted) {
      console.log("❌ Chat not found or not authorized");
      return res.status(404).json({ error: "Chat not found or unauthorized" });
    }

    console.log("✅ Chat deleted successfully:", deleted._id);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error deleting chat:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📌 Fetch Chat History
app.get("/api/chat-history", authenticate, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user.id }) // Make sure it's only finding existing chats
      .sort({ createdAt: -1 })
      .select("summary messages content");
    res.json({ chats });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});



// 📌 Health Check
app.get("/", (req, res) => {
  res.send("✅ AI Learning Assistant Backend is running");
});

// Quiz generation route
app.get("/api/quiz/:chatId", authenticate, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.user.id });
    if (!chat?.content) {
      return res.status(404).json({ error: "No content found" });
    }

    const prompt = `Generate 5 MCQs with 4 options each based on the following content. Also include the correct answer. Format it as JSON array only like:
[
  {
    "question": "What is ...?",
    "options": ["A", "B", "C", "D"],
    "answer": "B"
  }, ...
]
Content: ${chat.content}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const geminiData = await geminiRes.json();

    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(500).json({ error: "No text in model response" });
    }

    console.log("📥 Raw result from Gemini:", text);

    // Remove ```json and ``` if present
    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) cleanText = cleanText.replace(/^```json/, "").trim();
    if (cleanText.endsWith("```")) cleanText = cleanText.replace(/```$/, "").trim();

    let questions;
    try {
      questions = JSON.parse(cleanText);
    } catch (err) {
      console.error("❌ JSON parse error:", err, cleanText);
      return res.status(500).json({ error: "Failed to parse quiz JSON" });
    }

    console.log(`✅ Parsed ${questions.length} questions`);
    res.json({ questions });

  } catch (err) {
    console.error("❌ Quiz generation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🚀 Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
