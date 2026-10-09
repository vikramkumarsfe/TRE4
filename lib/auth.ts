import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "");
export async function createSession(userId: string) {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters");
  return new SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret());
}
export async function getUserId() {
  const token = (await cookies()).get("tre_session")?.value;
  if (!token) return null;
  try { return (await jwtVerify(token, secret())).payload.sub ?? null; } catch { return null; }
}
export async function getRequestUserId(req: NextRequest) {
  const token = req.cookies.get("tre_session")?.value;
  if (!token) return null;
  try { return (await jwtVerify(token, secret())).payload.sub ?? null; } catch { return null; }
}
export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set("tre_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
}
