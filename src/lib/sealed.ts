import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// AES-256-GCM for creator ID documents. The key comes from ID_DOC_KEY, or is
// derived from JWT_SECRET, so the ciphertext can sit in ordinary blob
// storage: a leaked URL yields nothing readable. Only owner routes decrypt.
function key(): Buffer {
  const explicit = process.env.ID_DOC_KEY;
  if (explicit) return Buffer.from(hkdfSync("sha256", explicit, "nomohoes", "id-docs", 32));
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return Buffer.from(hkdfSync("sha256", secret, "nomohoes", "id-docs", 32));
}

// Layout: 12-byte IV | 16-byte auth tag | ciphertext
export function seal(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function unseal(sealed: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key(), sealed.subarray(0, 12));
  decipher.setAuthTag(sealed.subarray(12, 28));
  return Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()]);
}
