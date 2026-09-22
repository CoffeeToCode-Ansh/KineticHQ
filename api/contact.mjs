// api/contact.mjs (ES Module)
// Vercel's file-based routing maps this file to /api/contact. It's the only
// ESM file in the project — Node's ESM loader can `import` a CommonJS
// module directly, so this just re-exports the shared Express app from
// ../app.js (CommonJS) without needing "type": "module" in package.json.

import "dotenv/config";
import app from "../app.js";

export default app;
