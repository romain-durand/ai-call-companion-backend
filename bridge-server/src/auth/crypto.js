const crypto = require("crypto");

const ALGO = "aes-256-gcm";
const KEY = process.env.TOKEN_ENCRYPTION_KEY; // hex-encoded 32-byte key

function getKey() {
  if (!KEY) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  return Buffer.from(KEY, "hex");
}

/**
 * Encrypt a plaintext string → "iv:authTag:ciphertext" (all hex).
 */
function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  let enc = cipher.update(plaintext, "utf8", "hex");
  enc += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${enc}`;
}

/**
 * Decrypt an "iv:authTag:ciphertext" string → plaintext.
 */
function decrypt(packed) {
  const [ivHex, authTagHex, cipherHex] = packed.split(":");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  let dec = decipher.update(cipherHex, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

/**
 * Sign a state payload (JSON-serializable) with HMAC-SHA256.
 * Returns "base64payload.signature".
 */
function signState(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getKey()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/**
 * Verify and decode a signed state string.
 * Returns the parsed payload or null if invalid.
 */
function verifyState(state) {
  const [data, sig] = state.split(".");
  if (!data || !sig) return null;
  const expected = crypto.createHmac("sha256", getKey()).update(data).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
}

module.exports = { encrypt, decrypt, signState, verifyState };
