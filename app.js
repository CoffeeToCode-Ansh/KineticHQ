// app.js (CommonJS)
// Single source of truth for the Express app. server.js (local dev) imports
// this directly; api/contact.mjs (Vercel, ESM) imports it too — Node's ESM
// loader can `import` a CommonJS module's module.exports as a default import.

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { validateEnquiryPayload } = require("./validate");

const app = express();

// ---------- CORS allow-list ----------
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // curl/Postman send no Origin
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// ---------- Body parsing ----------
app.use(express.json({ limit: "20kb" }));

// Malformed JSON is thrown by express.json() as a SyntaxError — catch it here
// so the client gets a clean 400 instead of an unhandled 500.
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ ok: false, error: "Invalid JSON body." });
  }
  return next(err);
});

// ---------- Mailer ----------
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.COMPANY_EMAIL
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------- Routes ----------
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "KineticHQ contact API",
    smtpConfigured: isSmtpConfigured(),
    allowedOriginsRaw: process.env.ALLOWED_ORIGINS || null,   // TEMP — remove after debugging
    allowedOriginsParsed: allowedOrigins,                      // TEMP — remove after debugging
  });
});


app.post("/api/contact", async (req, res, next) => {
  try {
    const { errors, data, isBot } = validateEnquiryPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: "Validation failed.",
        errors,
      });
    }

    // Quietly fake success for bots so they don't learn the honeypot exists.
    if (isBot) {
      return res.status(200).json({
        ok: true,
        message: "Your enquiry was received.",
      });
    }

    if (!isSmtpConfigured()) {
      console.error("SMTP is not configured (missing env vars).");
      return res.status(500).json({
        ok: false,
        error: "The server is temporarily unable to send messages. Please try again later.",
      });
    }

    const mail = getTransporter();

    await mail.sendMail({
      from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      to: process.env.COMPANY_EMAIL,
      replyTo: data.email,
      subject: `New KineticHQ enquiry — ${data.name}`,
      text:
        `Name: ${data.name}\n` +
        `Phone: ${data.phone}\n` +
        `Email: ${data.email}\n` +
        `Message: ${data.message || "—"}\n`,
      html:
        `<h2>New KineticHQ enquiry</h2>` +
        `<p><b>Name:</b> ${escapeHtml(data.name)}</p>` +
        `<p><b>Phone:</b> ${escapeHtml(data.phone)}</p>` +
        `<p><b>Email:</b> ${escapeHtml(data.email)}</p>` +
        `<p><b>Message:</b><br>${escapeHtml(data.message || "—")}</p>`,
    });

    return res.status(200).json({
      ok: true,
      message: "Your enquiry was sent successfully. KineticHQ will be in touch.",
    });
  } catch (err) {
    return next(err); // never let SMTP internals leak to the client
  }
});

// Any other method on /api/contact -> 405
app.all("/api/contact", (req, res) => {
  res.set("Allow", "POST");
  res.status(405).json({ ok: false, error: "Method not allowed." });
  
});

// 404 for anything else under /api/*
app.use("/api", (req, res) => {
  res.status(404).json({ ok: false, error: "Not found." });
});

// ---------- Centralized error handler ----------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({ ok: false, error: "Origin not allowed." });
  }
  console.error("Unhandled error:", err);
  return res.status(500).json({ ok: false, error: "Internal server error." });
});

module.exports = app;
