// app.js (CommonJS)
// Single source of truth for the Express app.

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { ObjectId } = require("mongodb");
const { validateEnquiryPayload } = require("./validate");
const { getEnquiriesCollection } = require("./db");

const app = express();

const ALLOWED_STATUSES = ["new", "in-progress", "resolved"];

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
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

// ---------- Body parsing ----------
app.use(express.json({ limit: "20kb" }));

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

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- Admin auth ----------
// Single shared-secret header, checked against ADMIN_TOKEN. Enquiries
// contain real names/emails/phone numbers, so these routes must not be public.
function requireAdmin(req, res, next) {
  if (!process.env.ADMIN_TOKEN) {
    console.error("ADMIN_TOKEN is not configured.");
    return res.status(500).json({ ok: false, error: "Admin access is not configured." });
  }
  const token = req.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "Unauthorized." });
  }
  return next();
}

// ---------- Routes ----------
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "KineticHQ contact API",
    smtpConfigured: isSmtpConfigured(),
  });
});

app.post("/api/contact", async (req, res, next) => {
  try {
    const { errors, data, isBot } = validateEnquiryPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ ok: false, error: "Validation failed.", errors });
    }

    if (isBot) {
      return res.status(200).json({ ok: true, message: "Your enquiry was received." });
    }

    // Persist first — the database is the source of truth for the admin
    // dashboard, so a submission must not be lost even if email fails.
    let insertedId = null;
    try {
      const col = await getEnquiriesCollection();
      const doc = { ...data, status: "new", createdAt: new Date() };
      const result = await col.insertOne(doc);
      insertedId = result.insertedId;
    } catch (dbErr) {
      console.error("Failed to save enquiry:", dbErr);
      return res.status(500).json({
        ok: false,
        error: "Could not save your enquiry right now. Please try again later.",
      });
    }

    // Email is now a best-effort notification, not a hard requirement —
    // its failure no longer fails the whole request.
    if (isSmtpConfigured()) {
      try {
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
      } catch (mailErr) {
        console.error("Enquiry saved but email notification failed:", mailErr);
      }
    } else {
      console.warn("SMTP not configured — enquiry saved but no email sent.");
    }

    return res.status(200).json({
      ok: true,
      message: "Your enquiry was sent successfully. KineticHQ will be in touch.",
      id: insertedId,
    });
  } catch (err) {
    return next(err);
  }
});

app.all("/api/contact", (req, res) => {
  res.set("Allow", "POST");
  res.status(405).json({ ok: false, error: "Method not allowed." });
  
});

// ---------- Admin: enquiries ----------

app.get("/api/enquiries", requireAdmin, async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const filter = {};
    if (status) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({
          ok: false,
          error: `Invalid status filter. Allowed: ${ALLOWED_STATUSES.join(", ")}`,
        });
      }
      filter.status = status;
    }
    if (search && String(search).trim()) {
      const re = new RegExp(escapeRegex(String(search).trim()), "i");
      filter.$or = [{ name: re }, { email: re }, { phone: re }, { message: re }];
    }

    const col = await getEnquiriesCollection();
    const total = await col.countDocuments(filter);
    const enquiries = await col
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    res.status(200).json({ ok: true, total, page, limit, enquiries });
  } catch (err) {
    next(err);
  }
});

app.get("/api/enquiries/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, error: "Invalid enquiry id." });
    }
    const col = await getEnquiriesCollection();
    const enquiry = await col.findOne({ _id: new ObjectId(id) });
    if (!enquiry) {
      return res.status(404).json({ ok: false, error: "Enquiry not found." });
    }
    res.status(200).json({ ok: true, enquiry });
  } catch (err) {
    next(err);
  }
});

app.patch("/api/enquiries/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, error: "Invalid enquiry id." });
    }
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        ok: false,
        error: `Status is required and must be one of: ${ALLOWED_STATUSES.join(", ")}`,
      });
    }

    const col = await getEnquiriesCollection();
    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!result || !result.value) {
      return res.status(404).json({ ok: false, error: "Enquiry not found." });
    }

    res.status(200).json({ ok: true, enquiry: result.value });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/enquiries/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, error: "Invalid enquiry id." });
    }
    const col = await getEnquiriesCollection();
    const result = await col.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ ok: false, error: "Enquiry not found." });
    }
    res.status(200).json({ ok: true, deletedId: id });
  } catch (err) {
    next(err);
  }
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
