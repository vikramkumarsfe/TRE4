import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { User } from "@/models";
import { createSession, setSessionCookie } from "@/lib/auth";
import { passwordDigest } from "@/lib/password";
const schema = z.object({ name: z.string().min(1).max(100), email: z.string().email().max(254), password: z.string().min(10).max(128) });
const attempts = new Map<string, { count: number; at: number }>();
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "local", current = attempts.get(ip), now = Date.now();
  if (current && now - current.at < 60_000 && current.count >= 5) return NextResponse.json({ error: "Please wait a minute before trying again." }, { status: 429 });
  attempts.set(ip, { count: current && now-current.at<60_000 ? current.count+1 : 1, at: now });
  try { const body = schema.parse(await req.json()); await connectDb(); if (await User.exists({ email: body.email.toLowerCase() })) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    const user = await User.create({ name: body.name, email: body.email, passwordHash: await bcrypt.hash(passwordDigest(body.password), 12) });
    const response = NextResponse.json({ user: { name: user.name, email: user.email } }, { status: 201 }); setSessionCookie(response, await createSession(user.id)); return response;
  } catch (error) { const msg = error instanceof z.ZodError ? error.issues[0]?.message : "Could not create account."; return NextResponse.json({ error: msg }, { status: error instanceof z.ZodError ? 400 : 500 }); }
}
