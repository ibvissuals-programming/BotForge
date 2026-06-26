import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 24 * 60 * 60 * 1000;

function getSecret(): string {
  const s = process.env.BOTFORGE_CEO_PASSWORD;
  if (!s) throw new Error("BOTFORGE_CEO_PASSWORD is not set");
  return s;
}

export function generateToken(): string {
  const expiry = Date.now() + TTL_MS;
  const sig = createHmac("sha256", getSecret())
    .update(String(expiry))
    .digest("hex");
  return `${expiry}.${sig}`;
}

export function verifyToken(token: string): boolean {
  try {
    const dotIndex = token.indexOf(".");
    if (dotIndex === -1) return false;

    const expiryStr = token.slice(0, dotIndex);
    const providedSig = token.slice(dotIndex + 1);

    const expiry = parseInt(expiryStr, 10);
    if (Number.isNaN(expiry) || Date.now() > expiry) return false;

    const expected = createHmac("sha256", getSecret())
      .update(expiryStr)
      .digest();

    const provided = Buffer.from(providedSig, "hex");
    if (expected.length !== provided.length) return false;

    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}
