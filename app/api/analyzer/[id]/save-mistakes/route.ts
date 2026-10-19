import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { getRequestUserId } from "@/lib/auth";
import { AnalyzerRun, QuestionMistake } from "@/models";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid analyzer run id." }, { status: 400 });
  try {
    await connectDb();
    const run = await AnalyzerRun.findOne({ _id: id, userId });
    if (!run || run.data?.status !== "completed") return NextResponse.json({ error: "Completed analyzer run not found." }, { status: 404 });
    if (run.data.savedMistakesAt) return NextResponse.json({ error: "Wrong answers from this report were already saved." }, { status: 409 });
    const questions = (run.data.results?.questions || []).filter((question: any) => question.correctness === "incorrect" && question.selectedAnswer);
    if (!questions.length) return NextResponse.json({ error: "This report has no confirmed incorrect answers to save." }, { status: 400 });
    const rows = questions.map((question: any) => ({
      userId,
      data: {
        question: `${question.number ? `Q${question.number}. ` : ""}${question.question || "Question text not detected"}`.slice(0, 3000),
        subject: String(question.subject || "Computer Science").slice(0, 100),
        topic: String(question.topic || "").slice(0, 120) || undefined,
        selected: String(question.selectedAnswer).slice(0, 500),
        answer: question.correctAnswer ? String(question.correctAnswer).slice(0, 500) : undefined,
        explanation: String(question.explanation || "").slice(0, 3000) || undefined,
        type: ["Concept Gap", "Calculation Error", "Misreading", "Guessing", "Forgotten Fact"].includes(question.mistakeType) ? question.mistakeType : "Concept Gap",
        difficulty: "Moderate", status: "Due",
      },
    }));
    await QuestionMistake.insertMany(rows);
    run.data.savedMistakesAt = new Date().toISOString();
    run.markModified("data");
    await run.save();
    return NextResponse.json({ saved: rows.length });
  } catch {
    return NextResponse.json({ error: "Could not save these questions to your mistake notebook." }, { status: 500 });
  }
}
