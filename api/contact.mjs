// api/contact.mjs — Vercel serverless function (ES module)
//
// IMPORTANT: delete the old api/contact.js from your repo before adding this —
// having both would create two functions competing for the same route.
//
// Why .mjs: your project's package.json likely has "type": "module", which makes
// Vercel treat plain .js files as ES modules. The previous file used CommonJS
// (`module.exports`), which doesn't exist in ES module scope — Vercel couldn't
// find a valid export and returned "Invalid export found in module". The .mjs
// extension always forces ES module syntax, so this works regardless of your
// package.json settings.
//
// Setup (same as before):
//   1. npm install nodemailer
//   2. In Vercel → Project → Settings → Environment Variables, add:
//        SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CONTACT_TO_EMAIL
//   3. Push to GitHub — Vercel redeploys automatically.

import nodemailer from 'nodemailer';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { name = '', email = '', objective = '', message = '', website = '' } = req.body || {};

  // Honeypot: bots that fill this hidden field get a fake success, no email sent.
  if (website && website.trim()) {
    return res.status(200).json({ message: 'Thanks — your message has been received.' });
  }

  const errors = [];
  if (!name.trim() || name.trim().length < 2 || name.trim().length > 80) {
    errors.push('Name must be 2–80 characters.');
  }
  if (!isValidEmail(email)) {
    errors.push('Please enter a valid email address.');
  }
  if (!message.trim() || message.trim().length < 10 || message.trim().length > 1500) {
    errors.push('Message must be 10–1500 characters.');
  }
  if (errors.length) {
    return res.status(400).json({ errors });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: `"KineticHQ Website" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO_EMAIL || process.env.SMTP_USER,
      replyTo: email,
      subject: `New KineticHQ inquiry — ${objective || 'General'}`,
      text: `Name: ${name}\nEmail: ${email}\nObjective: ${objective}\n\n${message}`,
      html: `<p><b>Name:</b> ${name}</p><p><b>Email:</b> ${email}</p><p><b>Objective:</b> ${objective}</p><p>${message.replace(/\n/g, '<br>')}</p>`
    });

    return res.status(200).json({ message: 'Your message was sent successfully.' });
  } catch (err) {
    console.error('Contact form email error:', err);
    return res.status(500).json({ error: 'We could not send your message. Please try again.' });
  }
}
