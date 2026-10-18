export const SESSION_COOKIE = "admin_session";
export const SESSION_SECONDS = 60 * 60 * 12;
const encoder = new TextEncoder();
function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (!process.env.VERCEL && process.env.NODE_ENV !== "production")
    return "local-development-session-key-never-deploy";
  throw new Error("ADMIN_SESSION_SECRET 설정이 필요합니다.");
}
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
const decode = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
async function key() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function createSession(now = Date.now()) {
  const body = encode(
    encoder.encode(
      JSON.stringify({
        sub: "admin",
        exp: Math.floor(now / 1000) + SESSION_SECONDS,
        nonce: crypto.randomUUID(),
      }),
    ),
  );
  return `${body}.${encode(new Uint8Array(await crypto.subtle.sign("HMAC", await key(), encoder.encode(body))))}`;
}
export async function verifySession(value?: string, now = Date.now()) {
  try {
    if (!value || value.length > 2048) return false;
    const parts = value.split(".");
    if (parts.length !== 2) return false;
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await key(),
        decode(parts[1]),
        encoder.encode(parts[0]),
      ))
    )
      return false;
    const payload = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    return (
      payload.sub === "admin" &&
      Number.isInteger(payload.exp) &&
      payload.exp > now / 1000 &&
      payload.exp <= now / 1000 + SESSION_SECONDS + 5
    );
  } catch {
    return false;
  }
}
