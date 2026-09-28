// db.js (CommonJS)
// MongoDB Atlas connection, cached across invocations the way Vercel/MongoDB
// recommend for serverless: reuse one client/connection promise instead of
// opening a new one per request (which would exhaust connection limits).

const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "kinetichq";

if (!uri) {
  console.warn("MONGODB_URI is not set — database-backed routes will fail.");
}

// `global` survives across warm serverless invocations (not across cold
// starts/deploys), which is exactly the reuse window we want.
let clientPromise = global._kineticHqMongoClientPromise;

function getClientPromise() {
  if (!uri) return null;
  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
    global._kineticHqMongoClientPromise = clientPromise;
  }
  return clientPromise;
}

async function getDb() {
  const cp = getClientPromise();
  if (!cp) throw new Error("MONGODB_URI is not configured.");
  const client = await cp;
  return client.db(dbName);
}

async function getEnquiriesCollection() {
  const db = await getDb();
  return db.collection("enquiries");
}

module.exports = { getDb, getEnquiriesCollection };
