const dns = require("dns");
const mongoose = require("mongoose");
const { lookupWithDohFallback } = require("./dnsFallback");

// Optional: force specific DNS resolvers (e.g. "8.8.8.8,1.1.1.1") for the SRV
// lookup that mongodb+srv:// URIs need. Doesn't affect plain mongodb:// URIs.
if (process.env.MONGODB_DNS_SERVERS) {
  dns.setServers(process.env.MONGODB_DNS_SERVERS.split(",").map((s) => s.trim()));
}

/**
 * Mongoose options hardened for unreliable local DNS:
 * - family 4: Atlas shards are reachable over IPv4; avoids broken IPv6 paths.
 * - lookup: OS resolver first, DNS-over-HTTPS fallback (MONGODB_DOH_FALLBACK=false disables).
 */
function mongoConnectOptions() {
  const options = { serverSelectionTimeoutMS: 20000, family: 4 };
  if (process.env.MONGODB_DOH_FALLBACK !== "false") {
    options.lookup = lookupWithDohFallback;
  }
  return options;
}

/** Adds an actionable hint to the most common Atlas connection failures. */
function explainMongoError(err) {
  const message = err.message || String(err);
  if (/querySrv|_mongodb\._tcp/.test(message)) {
    return `${message}\n  -> Your DNS resolver cannot look up the SRV record. Use the standard ` +
      "mongodb:// URI (see .env.example) or set MONGODB_DNS_SERVERS=8.8.8.8,1.1.1.1.";
  }
  if (/ENOTFOUND|getaddrinfo/.test(message)) {
    return `${message}\n  -> DNS could not resolve the cluster hosts, even via DNS-over-HTTPS. ` +
      "Set Windows DNS to 1.1.1.1 / 8.8.8.8, or use a local MongoDB (mongodb://127.0.0.1:27017/skin_disease).";
  }
  if (/bad auth|Authentication failed/i.test(message)) {
    return `${message}\n  -> Username/password rejected. Reset the password under Atlas > ` +
      "Database Access and URL-encode any special characters.";
  }
  if (err.name === "MongooseServerSelectionError") {
    return `${message}\n  -> Cluster unreachable. Check Atlas > Network Access allows your IP ` +
      "and that outbound port 27017 isn't blocked.";
  }
  return message;
}

/** Validates MONGODB_URI and connects, throwing an error with a helpful hint. */
async function connectMongo(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error("MONGODB_URI must be set (see .env.example)");
  if (uri.includes("<db_password>")) {
    throw new Error("Replace <db_password> in MONGODB_URI with your Atlas database password");
  }
  try {
    await mongoose.connect(uri, mongoConnectOptions());
  } catch (err) {
    throw new Error(explainMongoError(err));
  }
  return mongoose.connection;
}

module.exports = { connectMongo };
