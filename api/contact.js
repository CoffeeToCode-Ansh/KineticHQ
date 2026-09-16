// netlify/functions/contact.js — Netlify Functions equivalent
//
// Setup:
//   1. npm install nodemailer
//   2. In Netlify → Site settings → Environment variables, add:
//        SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CONTACT_TO_EMAIL
//   3. Add a netlify.toml at the repo root (see snippet below) so requests to
//      /api/contact are routed to this function.
//   4. Push to GitHub — Netlify redeploys automatically.
//
// netlify.toml:
//   [[redirects]]
//     from = "/api/*"
//     to = "/.netlify/functions/:splat"
//     status = 200

const nodemailer = require('nodemailer');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed.' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const { name = '', email = '', objective = '', message = '', website = '' } = payload;

  if (website && website.trim()) {
    return { statusCode: 200, body: JSON.stringify({ message: 'Thanks — your message has been received.' }) };
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
    return { statusCode: 400, body: JSON.stringify({ errors }) };
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

    return { statusCode: 200, body: JSON.stringify({ message: 'Your message was sent successfully.' }) };
  } catch (err) {
    console.error('Contact form email error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'We could not send your message. Please try again.' }) };
  }
};