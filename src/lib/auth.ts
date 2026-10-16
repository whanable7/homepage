import { cookies } from "next/headers";
import { compare } from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE, verifySession } from "./session";
import { getAdminSettings } from "./data";
import { isLocalStore } from "./archive-store";

export async function isAuthenticated() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}
export async function checkPassword(password: unknown) {
  if (typeof password !== "string" || !password || password.length > 1024)
    return false;
  const local = isLocalStore() && process.env.LOCAL_ADMIN_PASSWORD;
  const settings = local ? null : await getAdminSettings();
  if (settings?.password_hash) return compare(password, settings.password_hash);
  const expected = local || process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
