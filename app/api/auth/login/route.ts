import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { User } from "@/models";
import { createSession, setSessionCookie } from "@/lib/auth";
import { passwordDigest } from "@/lib/password";
const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(128) });
const attempts = new Map<string, { count: number; at: number }>();
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "local", current=attempts.get(ip), now=Date.now();
  if(current&&now-current.at<60_000&&current.count>=8)return NextResponse.json({error:"Too many attempts. Try again in a minute."},{status:429});
  attempts.set(ip,{count:current&&now-current.at<60_000?current.count+1:1,at:now});
  try { const body=schema.parse(await req.json()); await connectDb(); const user=await User.findOne({email:body.email.toLowerCase()});
    if(!user||!await bcrypt.compare(passwordDigest(body.password),user.passwordHash))return NextResponse.json({error:"Email or password is incorrect."},{status:401});
    const response=NextResponse.json({user:{name:user.name,email:user.email}});setSessionCookie(response,await createSession(user.id));return response;
  } catch(error){const msg=error instanceof z.ZodError?error.issues[0]?.message:"Could not sign in.";return NextResponse.json({error:msg},{status:error instanceof z.ZodError?400:500});}
}
