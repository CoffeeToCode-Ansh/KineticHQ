// api/[...path].mjs (ES Module)
// Vercel's catch-all file convention: this matches any /api/* request that
// doesn't have its own exact-match file (contact.mjs, health.mjs keep taking
// priority for their specific paths). This is what routes /api/enquiries and
// /api/enquiries/:id through to the same Express app, without needing a
// separate .mjs file per enquiries route.

import "dotenv/config";
import app from "../app.js";

export default app;
