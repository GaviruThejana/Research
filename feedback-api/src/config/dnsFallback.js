const dns = require("dns");
const https = require("https");

/**
 * Some ISP/router DNS resolvers intermittently fail to resolve MongoDB Atlas
 * hostnames (getaddrinfo ENOTFOUND ac-xxxx-shard-00-00...). This module gives
 * the MongoDB driver a `lookup` function that tries the OS resolver first and,
 * only if that fails, asks Cloudflare's DNS-over-HTTPS service over port 443,
 * which bypasses the broken local resolver.
 *
 * The DoH endpoint is addressed by IP (1.1.1.1) so it doesn't itself depend
 * on local DNS. Answers are cached for their TTL.
 */

const DOH_HOST = "1.1.1.1";
const RETRYABLE_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "ESERVFAIL", "ETIMEOUT"]);
const cache = new Map(); // hostname -> { addresses: string[], expiresAt: number }

function dohResolve4(hostname) {
  const cached = cache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.addresses);

  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        host: DOH_HOST,
        servername: "one.one.one.one", // the certificate's name for 1.1.1.1
        path: `/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
        headers: { accept: "application/dns-json" },
        timeout: 5000,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            const body = JSON.parse(raw);
            // Answers include the CNAME chain; keep only the A records.
            const records = (body.Answer || []).filter((a) => a.type === 1);
            if (records.length === 0) {
              return reject(Object.assign(new Error(`DoH: no A record for ${hostname}`), { code: "ENOTFOUND" }));
            }
            const ttl = Math.max(30, Math.min(...records.map((r) => r.TTL)));
            const addresses = records.map((r) => r.data);
            cache.set(hostname, { addresses, expiresAt: Date.now() + ttl * 1000 });
            return resolve(addresses);
          } catch (err) {
            return reject(err);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error(`DoH lookup timed out for ${hostname}`)));
    req.on("error", reject);
  });
}

/**
 * Drop-in replacement for dns.lookup(hostname, options, callback), as used by
 * net/tls sockets. Supports both `all: true` (Node's happy-eyeballs path) and
 * single-address callbacks. IPv4 only on the fallback path.
 */
function lookupWithDohFallback(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  } else if (typeof options === "number") {
    options = { family: options };
  }

  dns.lookup(hostname, options, (err, address, family) => {
    if (!err || !RETRYABLE_CODES.has(err.code)) return callback(err, address, family);

    dohResolve4(hostname)
      .then((addresses) => {
        console.warn(`[dns] OS resolver failed for ${hostname} (${err.code}); using DNS-over-HTTPS -> ${addresses[0]}`);
        if (options.all) return callback(null, addresses.map((a) => ({ address: a, family: 4 })));
        return callback(null, addresses[0], 4);
      })
      // Report the original OS error; it's the more meaningful one.
      .catch(() => callback(err));
  });
}

module.exports = { lookupWithDohFallback };
