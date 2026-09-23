// api/health.mjs (ES Module)
// Vercel's file-based routing maps this file to /api/health. Like
// contact.mjs, it just re-exports the shared Express app from ../app.js.

import "dotenv/config";
import app from "../app.js";

export default app;
