import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { deleteAnalyzerUploads, isAnalyzerUploadPath } from "@/lib/analyzer-files";
import { connectDb } from "@/lib/db";
import { AnalyzerRun } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const callback = await request.json().catch(() => null) as { sourceBody?: string; status?: number } | null;
  if (!callback?.sourceBody) return NextResponse.json({ error: "Invalid QStash failure callback." }, { status: 400 });

  let job: { runId?: string; userId?: string; answerPath?: string; keyPath?: string };
  try { job = JSON.parse(Buffer.from(callback.sourceBody, "base64").toString("utf8")); }
  catch { return NextResponse.json({ error: "Invalid failed job payload." }, { status: 400 }); }
  if (!mongoose.isValidObjectId(job.runId) || !mongoose.isValidObjectId(job.userId)) {
    return NextResponse.json({ error: "Invalid failed job identifiers." }, { status: 400 });
  }

  await connectDb();
  await AnalyzerRun.updateOne({ _id: job.runId, userId: job.userId, "data.status": { $ne: "completed" } }, {
    $set: {
      "data.status": "failed",
      "data.error": `QStash could not deliver this analyzer job (HTTP ${Number(callback.status) || "unknown"}). Retry by uploading the PDF again.`,
    },
    $unset: { "data.processingLeaseUntil": 1 },
  });
  await deleteAnalyzerUploads(
    isAnalyzerUploadPath(job.answerPath) ? job.answerPath : undefined,
    isAnalyzerUploadPath(job.keyPath) ? job.keyPath : undefined,
  );
  return NextResponse.json({ status: "marked-failed" });
}

export async function POST(request: Request) {
  if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
    return NextResponse.json({ error: "QStash signing keys are not configured." }, { status: 503 });
  }
  return verifySignatureAppRouter(handler)(request);
}
