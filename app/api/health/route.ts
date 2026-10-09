import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
export async function GET(){try{await connectDb();return NextResponse.json({status:"ok",database:"connected"});}catch{return NextResponse.json({status:"error",database:"unavailable"},{status:503});}}
