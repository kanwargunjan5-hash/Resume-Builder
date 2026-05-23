// server.js — ResumeCraft unified backend
// Combines: Groq AI proxy + JWT Auth + MongoDB Resume CRUD
//
// ─── Install dependencies ─────────────────────────────────────────────────────
//   npm install express cors mongoose bcryptjs jsonwebtoken dotenv node-fetch
//
// ─── .env file ────────────────────────────────────────────────────────────────
//   GROQ_API_KEY=your_groq_api_key_here
//   MONGO_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/resumecraft
//   JWT_SECRET=any_long_random_string_here
//   PORT=5000
//   CLIENT_ORIGIN=http://localhost:3000
// ─────────────────────────────────────────────────────────────────────────────

const express  = require("express");
const cors     = require("cors");
const fetch    = require("node-fetch");
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
require("dotenv").config();

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Validate required env vars ────────────────────────────────────────────────
if (!process.env.GROQ_API_KEY) {
  console.error("❌  GROQ_API_KEY is missing in .env");
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error("❌  MONGO_URI is missing in .env");
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error("❌  JWT_SECRET is missing in .env");
  process.exit(1);
}

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL   = "llama-3.3-70b-versatile";
const JWT_SECRET   = process.env.JWT_SECRET;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" }));
app.use(express.json({ limit: "5mb" })); // 5mb to handle base64 profile photos

// ── MongoDB connection ────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅  MongoDB connected"))
  .catch((err) => { console.error("❌  MongoDB error:", err.message); process.exit(1); });

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS & MODELS
// ─────────────────────────────────────────────────────────────────────────────

const UserSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

const ResumeSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    label:        { type: String, default: "Untitled Resume", trim: true },
    template:     { type: String, default: "modern" },
    sectionOrder: { type: [String], default: [] },
    data:         { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

const User   = mongoose.model("User",   UserSchema);
const Resume = mongoose.model("Resume", ResumeSchema);

// ─────────────────────────────────────────────────────────────────────────────
// JWT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function signToken(userId) {
  return jwt.sign({ sub: userId.toString() }, JWT_SECRET, { expiresIn: "7d" });
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token — please log in" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId    = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Token invalid or expired — please log in again" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// POST /auth/register
app.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name?.trim() || !email?.trim() || !password)
    return res.status(400).json({ error: "Name, email and password are all required" });

  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });

  try {
    if (await User.findOne({ email }))
      return res.status(409).json({ error: "An account with that email already exists" });

    const hash  = await bcrypt.hash(password, 12);
    const user  = await User.create({ name, email, password: hash });
    const token = signToken(user._id);

    res.status(201).json({
      token,
      user: { _id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("POST /auth/register:", err);
    res.status(500).json({ error: "Registration failed — please try again" });
  }
});

// POST /auth/login
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password)
    return res.status(400).json({ error: "Email and password are required" });

  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: "Invalid email or password" });

    const token = signToken(user._id);
    res.json({
      token,
      user: { _id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("POST /auth/login:", err);
    res.status(500).json({ error: "Login failed — please try again" });
  }
});

// GET /auth/me — verify token and return current user
app.get("/auth/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: { _id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RESUME ROUTES  (all protected by JWT)
// ─────────────────────────────────────────────────────────────────────────────

// GET /resumes — list all resumes for current user (metadata only)
app.get("/resumes", authenticate, async (req, res) => {
  try {
    const resumes = await Resume
      .find({ userId: req.userId })
      .select("label template createdAt updatedAt")
      .sort({ updatedAt: -1 });
    res.json(resumes);
  } catch (err) {
    console.error("GET /resumes:", err);
    res.status(500).json({ error: "Failed to fetch resumes" });
  }
});

// GET /resumes/:id — load one full resume
app.get("/resumes/:id", authenticate, async (req, res) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, userId: req.userId });
    if (!resume) return res.status(404).json({ error: "Resume not found" });
    res.json(resume);
  } catch (err) {
    console.error("GET /resumes/:id:", err);
    res.status(500).json({ error: "Failed to load resume" });
  }
});

// POST /resumes — create new resume
app.post("/resumes", authenticate, async (req, res) => {
  const { label, data, template, sectionOrder } = req.body;
  if (!data) return res.status(400).json({ error: "Resume data is required" });

  try {
    const resume = await Resume.create({
      userId: req.userId,
      label:        label        || "Untitled Resume",
      data,
      template:     template     || "modern",
      sectionOrder: sectionOrder || [],
    });
    res.status(201).json(resume);
  } catch (err) {
    console.error("POST /resumes:", err);
    res.status(500).json({ error: "Failed to save resume" });
  }
});

// PUT /resumes/:id — overwrite existing resume
app.put("/resumes/:id", authenticate, async (req, res) => {
  const { label, data, template, sectionOrder } = req.body;
  if (!data) return res.status(400).json({ error: "Resume data is required" });

  try {
    const resume = await Resume.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { label: label || "Untitled Resume", data, template, sectionOrder },
      { new: true }
    );
    if (!resume) return res.status(404).json({ error: "Resume not found" });
    res.json(resume);
  } catch (err) {
    console.error("PUT /resumes/:id:", err);
    res.status(500).json({ error: "Failed to update resume" });
  }
});

// PATCH /resumes/:id/label — rename only
app.patch("/resumes/:id/label", authenticate, async (req, res) => {
  const { label } = req.body;
  if (!label?.trim()) return res.status(400).json({ error: "Label is required" });

  try {
    const resume = await Resume.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { label: label.trim() },
      { new: true }
    );
    if (!resume) return res.status(404).json({ error: "Resume not found" });
    res.json(resume);
  } catch (err) {
    console.error("PATCH /resumes/:id/label:", err);
    res.status(500).json({ error: "Failed to rename resume" });
  }
});

// DELETE /resumes/:id
app.delete("/resumes/:id", authenticate, async (req, res) => {
  try {
    const resume = await Resume.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!resume) return res.status(404).json({ error: "Resume not found" });
    res.json({ message: "Resume deleted" });
  } catch (err) {
    console.error("DELETE /resumes/:id:", err);
    res.status(500).json({ error: "Failed to delete resume" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GROQ AI ROUTE  (your original route — unchanged)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/ai
app.post("/api/ai", async (req, res) => {
  const { systemPrompt, userMessage } = req.body;

  if (!systemPrompt || !userMessage)
    return res.status(400).json({ error: "systemPrompt and userMessage are required." });

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + GROQ_API_KEY,
      },
      body: JSON.stringify({
        model:      GROQ_MODEL,
        max_tokens: 1000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userMessage  },
        ],
      }),
    });

    const data = await response.json();

    if (data.error)
      return res.status(500).json({ error: data.error.message });

    const text = data.choices?.[0]?.message?.content || "";
    return res.json({ text });

  } catch (err) {
    console.error("Groq fetch error:", err);
    return res.status(500).json({ error: "Failed to reach Groq API." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────

app.get("/api/health", (_, res) => res.json({ status: "ok", time: new Date() }));

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀  ResumeCraft API → http://localhost:${PORT}`);
});