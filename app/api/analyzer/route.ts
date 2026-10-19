import { NextRequest, NextResponse } from "next/server";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { getRequestUserId } from "@/lib/auth";
import { analyzerUploadDir } from "@/lib/analyzer-files";
import { getQStashClient } from "@/lib/qstash";
import { AnalyzerRun } from "@/models";

export const runtime = "nodejs";
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const uploadDir = analyzerUploadDir;

function cleanName(value: string, fallback: string) {
  return value.replace(/[\\/\u0000-\u001f]/g, " ").trim().slice(0, 100) || fallback;
}

async function readPdf(form: FormData, field: string, required: boolean) {
  const entry = form.get(field);
  if (!(entry instanceof File) || !entry.size) {
    if (!required && !entry) return null;
    throw new Error(field === "answerSheet" ? "Choose an answer sheet PDF." : "The answer key must be a PDF.");
  }
  if (entry.size > MAX_PDF_BYTES) throw new Error("Each PDF must be 20 MB or smaller.");
  if (!entry.name.toLowerCase().endsWith(".pdf")) throw new Error("Upload PDF files only.");
  const bytes = Buffer.from(await entry.arrayBuffer());
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("This file is not a valid PDF.");
  return { bytes, filename: cleanName(entry.name, "answer-sheet.pdf") };
}

export async function GET(req: NextRequest) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    await connectDb();
    const records = await AnalyzerRun.find({ userId }).sort({ createdAt: -1 }).limit(20).lean();
    return NextResponse.json(records.map((record: any) => ({ id: String(record._id), ...record.data, createdAt: record.createdAt })));
  } catch {
    return NextResponse.json({ error: "Could not load analyzer runs." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Set GEMINI_API_KEY before using the analyzer." }, { status: 503 });
  if (!process.env.QSTASH_TOKEN || !process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
    return NextResponse.json({ error: "Set all QStash credentials before using the analyzer." }, { status: 503 });
  }
  if (!mongoose.isValidObjectId(userId)) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  let answerPath: string | undefined;
  let keyPath: string | undefined;
  let runId: string | undefined;
  try {
    const form = await req.formData();
    const answer = await readPdf(form, "answerSheet", true);
    const key = await readPdf(form, "answerKey", false);
    const testName = cleanName(String(form.get("testName") || ""), answer!.filename.replace(/\.pdf$/i, ""));
    await mkdir(uploadDir, { recursive: true });
    runId = new mongoose.Types.ObjectId().toString();
    answerPath = path.join(uploadDir, `${randomUUID()}-answer.pdf`);
    await writeFile(answerPath, answer!.bytes, { flag: "wx", mode: 0o600 });
    if (key) {
      keyPath = path.join(uploadDir, `${randomUUID()}-key.pdf`);
      await writeFile(keyPath, key.bytes, { flag: "wx", mode: 0o600 });
    }

    await connectDb();
    await AnalyzerRun.create({
      _id: runId, userId,
      data: { status: "queued", testName, filename: answer!.filename, hasAnswerKey: Boolean(key), createdAt: new Date().toISOString() },
    });
    const workerBaseUrl = (process.env.ANALYZER_WORKER_URL || "").replace(/\/+$/, "");
    if (!workerBaseUrl) throw new Error("Set ANALYZER_WORKER_URL so QStash can reach the analyzer worker.");
    const workerUrl = new URL("/api/analyzer/worker", workerBaseUrl);
    if (workerUrl.protocol !== "https:" && process.env.NODE_ENV === "production") {
      throw new Error("The analyzer worker URL must use HTTPS in production.");
    }
    const failureUrl = new URL("/api/analyzer/worker/failure", workerBaseUrl).toString();
    const scheduled = await getQStashClient().publishJSON({
      url: workerUrl.toString(),
      body: { runId, userId, answerPath, keyPath },
      retries: 3,
      timeout: "15m",
      failureCallback: failureUrl,
    });
    return NextResponse.json({ id: runId, status: "queued", messageId: scheduled.messageId }, { status: 202 });
  } catch (error) {
    if (answerPath) await unlink(answerPath).catch(() => {});
    if (keyPath) await unlink(keyPath).catch(() => {});
    if (runId) await AnalyzerRun.deleteOne({ _id: runId, userId }).catch(() => {});
    const message = error instanceof Error ? error.message : "Could not queue this analyzer run.";
    const status = message.includes("PDF") || message.includes("Choose") ? 400 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
