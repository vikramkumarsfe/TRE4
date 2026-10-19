import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { deleteAnalyzerUploads, isAnalyzerUploadPath } from "@/lib/analyzer-files";
import { connectDb } from "@/lib/db";
import { AnalyzerRun } from "@/models";
import { analyzeAnalyzerJob } from "@/worker/analyzer-worker.mjs";

export const runtime = "nodejs";
export const maxDuration = 900;
export const dynamic = "force-dynamic";

type AnalyzerJob = { runId: string; userId: string; answerPath: string; keyPath?: string };

function validJob(value: unknown): value is AnalyzerJob {
  if (!value || typeof value !== "object") return false;
  const job = value as Partial<AnalyzerJob>;
  return mongoose.isValidObjectId(job.runId)
    && mongoose.isValidObjectId(job.userId)
    && isAnalyzerUploadPath(job.answerPath)
    && (!job.keyPath || isAnalyzerUploadPath(job.keyPath));
}

async function handler(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid job payload." }, { status: 400 }); }
  if (!validJob(payload)) return NextResponse.json({ error: "Invalid analyzer job." }, { status: 400 });
  const job = payload;

  await connectDb();
  const existing = await AnalyzerRun.findOne({ _id: job.runId, userId: job.userId }).lean() as any;
  if (!existing) {
    console.warn(`[Analyzer] Discarding orphaned QStash job for run ${job.runId}: no matching run exists.`);
    await deleteAnalyzerUploads(job.answerPath, job.keyPath);
    return NextResponse.json({ status: "orphaned" });
  }
  if (existing.data?.status === "completed") {
    await deleteAnalyzerUploads(job.answerPath, job.keyPath);
    return NextResponse.json({ status: "already-completed" });
  }

  const now = new Date();
  const claimed = await AnalyzerRun.findOneAndUpdate({
    _id: job.runId,
    userId: job.userId,
    $or: [
      { "data.status": "queued" },
      { "data.status": "processing", "data.processingLeaseUntil": { $lte: now } },
    ],
  }, {
    $set: {
      "data.status": "processing",
      "data.error": null,
      "data.processingLeaseUntil": new Date(now.getTime() + 16 * 60 * 1000),
    },
  }, { new: true }).lean();

  if (!claimed) {
    const latest = await AnalyzerRun.findOne({ _id: job.runId, userId: job.userId }).lean() as any;
    if (latest?.data?.status === "completed") {
      await deleteAnalyzerUploads(job.answerPath, job.keyPath);
      return NextResponse.json({ status: "already-completed" });
    }
    return NextResponse.json({ error: "Analyzer job is already processing; QStash should retry it." }, {
      status: 503,
      headers: { "Retry-After": "60" },
    });
  }

  try {
    await analyzeAnalyzerJob(job);
    await AnalyzerRun.updateOne({ _id: job.runId, userId: job.userId }, { $unset: { "data.processingLeaseUntil": 1 } });
    await deleteAnalyzerUploads(job.answerPath, job.keyPath);
    return NextResponse.json({ status: "completed" });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Analyzer job failed.";
    await AnalyzerRun.updateOne({ _id: job.runId, userId: job.userId }, {
      $set: {
        "data.status": "queued",
        "data.error": message,
        "data.processingLeaseUntil": new Date(0),
      },
    });
    throw error;
  }
}

export async function POST(request: Request) {
  if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
    return NextResponse.json({ error: "QStash signing keys are not configured." }, { status: 503 });
  }
  return verifySignatureAppRouter(handler)(request);
}
