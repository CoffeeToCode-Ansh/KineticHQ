// server.js (CommonJS) — local dev entry point (node server.js).
// Vercel deployments use api/contact.mjs instead, which imports this same
// app.js so the validation/mail logic is never duplicated.

require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`KineticHQ contact API listening on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
