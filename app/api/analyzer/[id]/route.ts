import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { getRequestUserId } from "@/lib/auth";
import { AnalyzerRun } from "@/models";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid analyzer run id." }, { status: 400 });
  try {
    await connectDb();
    const record = await AnalyzerRun.findOne({ _id: id, userId }).lean() as any;
    if (!record) return NextResponse.json({ error: "Analyzer run not found." }, { status: 404 });
    return NextResponse.json({ id: String(record._id), ...record.data, createdAt: record.createdAt });
  } catch {
    return NextResponse.json({ error: "Could not load this analyzer run." }, { status: 500 });
  }
}
