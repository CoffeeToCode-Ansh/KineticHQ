require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");

app.disable("x-powered-by");

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Same-origin browser requests and local tools may not send Origin.
    if (!origin) return callback(null, true);
    if (!allowedOrigins.length || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS origin not allowed."));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

// Protect the API from unexpectedly large JSON bodies.
app.use(express.json({ limit: "20kb" }));

app.use(express.static(PUBLIC_DIR));

function clean(value, maxLength) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function validateContact(body = {}) {
  const name = clean(body.name, 80);
  const email = clean(body.email, 254);
  const objective = clean(body.objective, 100);
  const message = clean(body.message, 1500);
  const website = clean(body.website, 100);

  const errors = [];

  if (name.length < 2) errors.push("Please enter your name.");
  if (name.length > 80) errors.push("Name is too long.");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Please enter a valid email address.");
  }

  if (!objective) errors.push("Please select an objective.");

  if (message.length < 10) errors.push("Message must be at least 10 characters.");
  if (message.length > 1500) errors.push("Message is too long.");

  return {
    valid: errors.length === 0,
    errors,
    data: { name, email, objective, message, website }
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const required = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "COMPANY_EMAIL"
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length) {
    const error = new Error(`Missing SMTP configuration: ${missing.join(", ")}`);
    error.code = "SMTP_CONFIG_MISSING";
    throw error;
  }

  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const error = new Error("SMTP_PORT must be a valid TCP port.");
    error.code = "SMTP_CONFIG_INVALID";
    throw error;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
}

// Health endpoint — useful for local testing and Vercel deployment checks.
app.get("/api/health", (req, res) => {
  const smtpReady = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "COMPANY_EMAIL"
  ].every(key => Boolean(process.env[key]));

  res.status(200).json({
    ok: true,
    service: "KineticHQ contact API",
    smtpConfigured: smtpReady
  });
});

// Main deliverable: Frontend -> POST /api/contact -> Express -> Nodemailer -> SMTP -> Company Email
app.post("/api/contact", async (req, res) => {
  try {
    const { valid, errors, data } = validateContact(req.body);

    // Honeypot: respond neutrally to obvious automated submissions.
    if (data.website) {
      return res.status(200).json({
        ok: true,
        message: "Thanks — your message has been received."
      });
    }

    if (!valid) {
      return res.status(400).json({
        ok: false,
        error: "Validation failed.",
        errors
      });
    }

    const mailer = getTransporter();

    const safeName = escapeHtml(data.name);
    const safeEmail = escapeHtml(data.email);
    const safeObjective = escapeHtml(data.objective);
    const safeMessage = escapeHtml(data.message).replaceAll("\n", "<br>");

    const subject = `KineticHQ enquiry — ${data.objective}`;

    await mailer.sendMail({
      from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      to: process.env.COMPANY_EMAIL,
      replyTo: data.email,
      subject,
      text:
`New KineticHQ enquiry

Name: ${data.name}
Email: ${data.email}
Objective: ${data.objective}

Message:
${data.message}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#241712">
          <h2 style="color:#8b402b">New KineticHQ enquiry</h2>
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Objective:</strong> ${safeObjective}</p>
          <hr>
          <p><strong>Message</strong></p>
          <p>${safeMessage}</p>
        </div>
      `
    });

    return res.status(200).json({
      ok: true,
      message: "Your message was sent successfully. KineticHQ will be in touch."
    });
  } catch (error) {
    console.error("Contact API error:", {
      code: error.code,
      message: error.message
    });

    if (error.code === "SMTP_CONFIG_MISSING" || error.code === "SMTP_CONFIG_INVALID") {
      return res.status(500).json({
        ok: false,
        error: "Email service is not configured yet."
      });
    }

    return res.status(502).json({
      ok: false,
      error: "We could not deliver your message right now. Please try again later."
    });
  }
});

// Return JSON for unknown API routes instead of an HTML page.
app.use("/api", (req, res) => {
  res.status(404).json({
    ok: false,
    error: "API route not found."
  });
});

// Frontend fallback for browser routes.
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Express is exported for Vercel. Locally, start the HTTP server.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`KineticHQ running at http://localhost:${PORT}`);
  });
}

module.exports = app;
