"use client";
import { AppShell } from "@/components/AppShell";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Empty,
  Input,
  Progress,
  Radio,
  Statistic,
  Tag,
  message,
  Segmented,
} from "antd";
import { ChevronLeft,ClipboardPaste, Eye, RotateCcw, Trophy } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

type Question = {
  id: string | number;
  question: string;
  options: Record<string, string>;
  correct_answer: string | number;
  answer_text?: string;
  category: string;
};
type Test = {
  id?: string;
  name: string;
  exam?: string;
  date?: string;
  attemptGroupId?: string;
  attemptNumber?: number;
  questions: Question[];
  answers?: Record<string, string>;
  finishedAt?: string;
};
type CategoryResult = {
  category: string;
  total: number;
  correct: number;
  incorrect: number;
  skipped: number;
  marks: number;
  accuracy: number;
};

function normalizeTest(input: any): Test {
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray(input.questions) ||
    !input.questions.length
  )
    throw new Error("JSON must contain a non-empty questions array.");
  const questions = input.questions.map((q: any, i: number) => {
    if (!q || typeof q.question !== "string" || !q.question.trim())
      throw new Error("Question " + (i + 1) + " needs question text.");
    const options = Array.isArray(q.options)
      ? Object.fromEntries(
          q.options.map((v: unknown, n: number) => [
            String.fromCharCode(65 + n),
            String(v),
          ]),
        )
      : q.options;
    if (
      !options ||
      typeof options !== "object" ||
      Object.keys(options).length < 2 ||
      Object.values(options).some((v) => typeof v !== "string")
    )
      throw new Error(
        "Question " + (i + 1) + " needs at least two text options.",
      );
    const answer = q.correct_answer ?? q.correctAnswer ?? q.answer;
    if (
      answer === undefined ||
      !Object.keys(options).some(
        (key) => key.toLowerCase() === String(answer).toLowerCase(),
      )
    )
      throw new Error(
        "Question " +
          (i + 1) +
          " needs a correct_answer matching one of its option keys.",
      );
    return {
      id: q.id ?? i + 1,
      question: q.question.trim(),
      options,
      correct_answer: String(answer),
      answer_text:
        typeof q.answer_text === "string" ? q.answer_text : undefined,
      category:
        typeof q.category === "string" && q.category.trim()
          ? q.category.trim()
          : "General Studies",
    };
  });
  return {
    name: String(
      input.exam || input.name || input.section || "GS Practice Test",
    ),
    exam: input.exam,
    date: input.date,
    questions,
  };
}

function calculate(test: Test): CategoryResult[] {
  const stats = new Map<string, CategoryResult>();
  test.questions.forEach((q) => {
    const category = q.category || "General Studies";
    const row = stats.get(category) ?? {
      category,
      total: 0,
      correct: 0,
      incorrect: 0,
      skipped: 0,
      marks: 0,
      accuracy: 0,
    };
    const answer = test.answers?.[String(q.id)];
    row.total++;
    if (!answer) row.skipped++;
    else if (answer.toLowerCase() === String(q.correct_answer).toLowerCase()) {
      row.correct++;
      row.marks++;
    } else {
      row.incorrect++;
      row.marks -= 1 / 3;
    }
    stats.set(category, row);
  });
  return [...stats.values()]
    .map((row) => ({
      ...row,
      accuracy:
        row.correct + row.incorrect
          ? Math.round((row.correct / (row.correct + row.incorrect)) * 100)
          : 0,
    }))
    .sort(
      (a, b) => a.accuracy - b.accuracy || a.category.localeCompare(b.category),
    );
}
function score(test: Test) {
  return calculate(test).reduce((sum, row) => sum + row.marks, 0);
}
function groupId(test: Test) {
  return test.attemptGroupId || test.id || test.name + "-" + (test.date || "");
}

function statusOf(q: Question, answers?: Record<string, string>) {
  const a = answers?.[String(q.id)];
  if (!a) return "skipped";
  return a.toLowerCase() === String(q.correct_answer).toLowerCase() ? "correct" : "incorrect";
}

const CHART_COLORS = ["#286448", "#d58a37", "#4f8fc0", "#a86f19", "#7b6cb5", "#c4524a", "#5aa88a", "#8a8f98"];

export default function GsPage() {
  const [raw, setRaw] = useState("");
  const [test, setTest] = useState<Test | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Test[]>([]);
  const [report, setReport] = useState<Test | null>(null);
  const [reportTab, setReportTab] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, holder] = message.useMessage();
  const [filter, setFilter] = useState<"all" | "correct" | "incorrect" | "skipped">("all");

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/data/gsTests", { cache: "no-store" });
      if (res.ok) setHistory(await res.json());
    } catch {
      /* History can be loaded again on the next visit. */
    }
  }, []);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const current = test?.questions[index];
  const groups = Array.from(
    history
      .filter((item) => item.finishedAt)
      .reduce((map, item) => {
        const key = groupId(item);
        map.set(key, [...(map.get(key) || []), item]);
        return map;
      }, new Map<string, Test[]>())
      .entries(),
  ).map(([key, attempts]) => ({
    key,
    attempts: attempts.sort(
      (a, b) =>
        (a.attemptNumber ?? 0) - (b.attemptNumber ?? 0) ||
        String(a.finishedAt).localeCompare(String(b.finishedAt)),
    ),
  }));
  const attempts = report
    ? [
        ...history.filter((item) => groupId(item) === groupId(report)),
        ...(history.some((item) => item.id === report.id) ? [] : [report]),
      ]
        .filter((item) => item.finishedAt)
        .sort(
          (a, b) =>
            (a.attemptNumber ?? 0) - (b.attemptNumber ?? 0) ||
            String(a.finishedAt).localeCompare(String(b.finishedAt)),
        )
        .map((item, i) => ({
          ...item,
          attemptNumber: item.attemptNumber ?? i + 1,
        }))
    : [];
  const activeReport =
    attempts.find((item) => item.id === reportTab) ||
    attempts[attempts.length - 1] ||
    report;
  const results = useMemo(
    () => (activeReport ? calculate(activeReport) : []),
    [activeReport],
  );

  const totalQuestions = results.reduce((sum, r) => sum + r.total, 0);

  const distributionData = [...results]
    .sort((a, b) => b.total - a.total)
    .map((r) => ({
      name: r.category,
      questions: r.total,
      percent: totalQuestions ? Math.round((r.total / totalQuestions) * 1000) / 10 : 0,
    }));

  const breakdownData = [...results]
    .sort((a, b) => b.total - a.total)
    .map((r) => ({ name: r.category, Correct: r.correct, Incorrect: r.incorrect, Skipped: r.skipped }));
    
  const filteredQuestions = useMemo(
    () => activeReport
      ? activeReport.questions
          .map((q, i) => ({ q, i, status: statusOf(q, activeReport.answers) }))
          .filter((x) => filter === "all" || x.status === filter)
      : [],
    [activeReport, filter]
  );
  const categories = [
    ...new Set(
      attempts.flatMap((item) => calculate(item).map((row) => row.category)),
    ),
  ].sort();
  const totals = results.reduce(
    (a, r) => ({
      correct: a.correct + r.correct,
      incorrect: a.incorrect + r.incorrect,
      skipped: a.skipped + r.skipped,
      marks: a.marks + r.marks,
    }),
    { correct: 0, incorrect: 0, skipped: 0, marks: 0 },
  );

  function parse() {
    try {
      const parsed = normalizeTest(JSON.parse(raw));
      setTest(parsed);
      setAnswers({});
      setIndex(0);
      setReport(null);
      setReportTab("");
      msg.success(parsed.questions.length + " questions are ready.");
    } catch (error) {
      msg.error(
        error instanceof Error ? error.message : "Could not read this JSON.",
      );
    }
  }
  async function start() {
    if (!test) return;
    setLoading(true);
    try {
      const { id: _id, ...payload } = test;
      const res = await fetch("/api/data/gsTests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, answers: {}, finishedAt: "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save test.");
      setTest({ ...test, id: data.id });
    } catch (error) {
      msg.error(
        error instanceof Error ? error.message : "Could not start test.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function finish(finalAnswers: Record<string, string>) {
    if (!test?.id) return;
    setLoading(true);
    try {
      const finishedAt = new Date().toISOString();
      const res = await fetch("/api/data/gsTests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: test.id,
          answers: finalAnswers,
          finishedAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save report.");
      const finished = { ...test, answers: finalAnswers, finishedAt };
      setReport(finished);
      setReportTab(finished.id || "");
      setTest(null);
      await loadHistory();
    } catch (error) {
      msg.error(
        error instanceof Error ? error.message : "Could not save report.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function saveNext() {
    if (!test || !current) return;
    if (index < test.questions.length - 1) setIndex(index + 1);
    else await finish({ ...answers });
  }
  function reattempt(item: Test, items: Test[]) {
    const {
      id: _id,
      answers: _answers,
      finishedAt: _finished,
      ...source
    } = item;
    setReport(null);
    setReportTab("");
    setAnswers({});
    setIndex(0);
    setTest({
      ...source,
      attemptGroupId: groupId(item),
      attemptNumber: items.length + 1,
    });
  }

  function goPrevious() {
    if (index > 0) setIndex(index - 1);
  }

  return (
    <AppShell>
      {holder}
      <div className="mb-6">
        <div className="text-sm font-medium text-forest">
          Practice and review
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          General Studies section
        </h1>
        <p className="mb-0 mt-2 max-w-3xl text-sm leading-6 text-muted">
          Paste a question set as JSON, take it as a multiple choice test, then
          review your score and category-wise improvement suggestions.
        </p>
      </div>
      {test && !test.id && (
        <Card className="mb-5 rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="mb-1 text-lg font-semibold">{test.name}</h2>
              <p className="mb-0 text-sm text-muted">
                {test.questions.length} questions
                {test.attemptNumber ? " · Attempt " + test.attemptNumber : ""}
                {test.date ? " · " + test.date : ""}
              </p>
            </div>
            <Button type="primary" loading={loading} onClick={start}>
              Start assessment
            </Button>
          </div>
        </Card>
      )}
      {test?.id && current && (
        <Card className="rounded-2xl">
          <div className="mb-5 flex items-center justify-between">
            <div className="text-sm text-muted">
              Question {index + 1} of {test.questions.length}
            </div>
            <Tag color="green">{current.category}</Tag>
          </div>
          <Progress
            percent={Math.round(((index + 1) / test.questions.length) * 100)}
            showInfo={false}
            strokeColor="#286448"
          />
          <h2 className="mb-5 mt-6 text-xl font-semibold leading-relaxed">
            {current.question}
          </h2>
          <Radio.Group
            value={answers[String(current.id)]}
            onChange={(e) =>
              setAnswers((prev) => ({
                ...prev,
                [String(current.id)]: e.target.value,
              }))
            }
            className="w-full"
          >
            <div className="space-y-3">
              {Object.entries(current.options).map(([key, value]) => (
                <Radio
                  key={key}
                  value={key}
                  className="!flex w-full items-start rounded-xl border border-[#e8ede9] p-4"
                >
                  <span className="font-semibold">{key}.</span> {value}
                </Radio>
              ))}
            </div>
          </Radio.Group>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <Button icon={<ChevronLeft size={15}/>} disabled={index === 0 || loading} onClick={goPrevious}>Previous</Button>
            <div className="flex flex-wrap gap-2">
              <Button danger loading={loading} onClick={() => finish({ ...answers })}>Final Assessment</Button>
              <Button type="primary" loading={loading} onClick={saveNext}>
                {index === test.questions.length - 1 ? "Save & View Report" : "Save & Next"}
              </Button>
            </div>
          </div>
        </Card>
      )}
      {report && activeReport && (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e5ece7] bg-gradient-to-r from-[#edf7f0] via-white to-[#fffaf1] p-5 shadow-soft">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Tag color="green">
                  {attempts.length}{" "}
                  {attempts.length === 1 ? "attempt" : "attempts"}
                </Tag>
                <span className="text-xs font-medium text-muted">
                  {activeReport.attemptNumber
                    ? "Viewing attempt " + activeReport.attemptNumber
                    : "Assessment report"}
                </span>
              </div>
              <h2 className="mb-1 text-2xl font-semibold">{report.name}</h2>
              <p className="mb-0 text-sm text-muted">
                Review answers, track category progress, and compare your
                attempts.
              </p>
            </div>
            <Button
              icon={<RotateCcw size={15} />}
              onClick={() => {
                setReport(null);
                setReportTab("");
              }}
            >
              Back to tests
            </Button>
          </div>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[#e8ede9] pb-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[.1em] text-muted">
                Assessment history
              </div>
              <p className="mb-0 mt-1 text-sm text-muted">
                Select an attempt or compare performance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {attempts.map((item) => (
                <Button
                  key={item.id}
                  type={reportTab === item.id ? "primary" : "default"}
                  onClick={() => setReportTab(item.id || "")}
                >
                  Attempt {item.attemptNumber}
                </Button>
              ))}
              <Button
                type={reportTab === "comparison" ? "primary" : "default"}
                onClick={() => setReportTab("comparison")}
              >
                Compare attempts
              </Button>
            </div>
          </div>
          {reportTab === "comparison" ? (
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {attempts.map((item) => {
                const rows = calculate(item);
                const correct = rows.reduce((sum, row) => sum + row.correct, 0);
                const incorrect = rows.reduce(
                  (sum, row) => sum + row.incorrect,
                  0,
                );
                const accuracy =
                  correct + incorrect
                    ? Math.round((correct / (correct + incorrect)) * 100)
                    : 0;
                return (
                  <Card
                    key={item.id}
                    className="rounded-2xl border-0 shadow-soft"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        Attempt {item.attemptNumber}
                      </span>
                      <span className="text-xs text-muted">
                        {item.finishedAt
                          ? new Date(item.finishedAt).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-forest">
                      {score(item).toFixed(2)}{" "}
                      <span className="text-sm font-medium text-muted">
                        marks
                      </span>
                    </div>
                    <Progress
                      className="mb-0 mt-2"
                      percent={accuracy}
                      showInfo={false}
                      strokeColor="#286448"
                    />
                    <div className="mt-1 text-xs text-muted">
                      {accuracy}% accuracy · {correct} correct · {incorrect}{" "}
                      incorrect
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="mb-5 rounded-2xl border-0 bg-gradient-to-r from-[#edf7f0] to-white shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[.1em] text-forest">
                    Attempt {activeReport.attemptNumber ?? 1} result
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {activeReport.finishedAt
                      ? new Date(activeReport.finishedAt).toLocaleString()
                      : ""}{" "}
                    · {activeReport.questions.length} questions
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold text-forest">
                    {totals.marks.toFixed(2)}{" "}
                    <span className="text-sm font-medium text-muted">
                      marks
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    {totals.correct + totals.incorrect
                      ? Math.round(
                          (totals.correct /
                            (totals.correct + totals.incorrect)) *
                            100,
                        )
                      : 0}
                    % accuracy on attempted questions
                  </div>
                </div>
              </div>
            </Card>
          )}
          {reportTab === "comparison" ? (
            <Card className="overflow-x-auto rounded-2xl">
              <h3 className="mb-4 text-lg font-semibold">Attempt comparison</h3>
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e8ede9] text-muted">
                    <th className="p-3">Category</th>
                    {attempts.map((item) => (
                      <th key={item.id} className="p-3">
                        Attempt {item.attemptNumber}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category} className="border-b border-[#eef1ee]">
                      <th className="p-3 font-medium">{category}</th>
                      {attempts.map((item) => {
                        const row = calculate(item).find(
                          (x) => x.category === category,
                        );
                        return (
                          <td key={item.id} className="p-3">
                            {row
                              ? row.marks.toFixed(2) +
                                " marks / " +
                                row.accuracy +
                                "% / " +
                                row.correct +
                                " of " +
                                row.total +
                                " correct"
                              : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="bg-paper font-semibold">
                    <th className="p-3">Overall</th>
                    {attempts.map((item) => {
                      const rows = calculate(item);
                      const correct = rows.reduce(
                        (sum, row) => sum + row.correct,
                        0,
                      );
                      const total = rows.reduce(
                        (sum, row) => sum + row.total,
                        0,
                      );
                      return (
                        <td key={item.id} className="p-3">
                          {score(item).toFixed(2)} marks /{" "}
                          {total ? Math.round((correct / total) * 100) : 0}% /{" "}
                          {correct} of {total} correct
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </Card>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  ["Marks", totals.marks.toFixed(2)],
                  ["Correct", totals.correct],
                  ["Incorrect", totals.incorrect],
                  ["Unattempted", totals.skipped],
                ].map(([label, value]) => (
                  <Card key={label} className="rounded-2xl">
                    <Statistic title={label} value={value} />
                  </Card>
                ))}
              </div>

              <div className="mb-5 grid gap-5 lg:grid-cols-2">
                <Card className="mb-5 rounded-2xl">
                  <h3 className="mb-1 text-lg font-semibold">Topic distribution</h3>
                  <p className="mb-4 text-sm text-muted">Har topic se kitne % questions aaye ({totalQuestions} total)</p>
                  <div style={{ width: "100%", height: Math.max(280, distributionData.length * 32) }}>
                    <ResponsiveContainer>
                      <BarChart data={distributionData} layout="vertical" margin={{ left: 0, right: 48, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" unit="%" tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12 }} interval={0} />
                        <Tooltip formatter={(v: number, name: string) => (name === "percent" ? v + "%" : v)} />
                        <Bar dataKey="percent" fill="#286448" radius={[0, 6, 6, 0]} barSize={16}>
                          <LabelList dataKey="percent" position="right" formatter={(v: number) => v + "%"} style={{ fontSize: 12, fill: "#6b7280" }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="mb-5 rounded-2xl">
                  <h3 className="mb-1 text-lg font-semibold">Performance by category</h3>
                  <p className="mb-4 text-sm text-muted">Sahi, galat aur chhode hue questions</p>
                  <div style={{ width: "100%", height: Math.max(280, breakdownData.length * 36) }}>
                    <ResponsiveContainer>
                      <BarChart data={breakdownData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12 }} interval={0} />
                        <Tooltip />
                        <Legend verticalAlign="top" height={32} />
                        <Bar dataKey="Correct" stackId="a" fill="#286448" barSize={16} />
                        <Bar dataKey="Incorrect" stackId="a" fill="#c4524a" barSize={16} />
                        <Bar dataKey="Skipped" stackId="a" fill="#c9cfca" barSize={16} radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>


              <Card className="mb-5 rounded-2xl">
                <h3 className="mb-4 text-lg font-semibold">
                  Category-wise performance
                </h3>
                <div className="space-y-4">
                  {results.map((r) => (
                    <div
                      key={r.category}
                      className="rounded-xl border border-[#e8ede9] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold">{r.category}</div>
                        <Tag
                          color={
                            r.accuracy >= 70
                              ? "green"
                              : r.accuracy >= 40
                                ? "orange"
                                : "red"
                          }
                        >
                          {r.accuracy}% accuracy
                        </Tag>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted sm:grid-cols-5">
                        <span>{r.correct} correct</span>
                        <span>{r.incorrect} incorrect</span>
                        <span>{r.skipped} skipped</span>
                        <span>{r.marks.toFixed(2)} marks</span>
                        <span>{r.total} questions</span>
                      </div>
                      <Progress
                        className="mt-2"
                        percent={r.accuracy}
                        showInfo={false}
                        strokeColor={r.accuracy >= 70 ? "#286448" : "#d58a37"}
                      />
                      <p className="mb-0 mt-2 text-sm leading-6">
                        {r.incorrect + r.skipped === 0
                          ? "Keep this category strong with short revision sessions and mixed practice."
                          : "Prioritize " +
                            r.category +
                            ": review " +
                            r.incorrect +
                            " incorrect and " +
                            r.skipped +
                            " skipped questions, then solve a focused set of " +
                            Math.max(5, r.incorrect + r.skipped) +
                            " questions."}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="rounded-2xl">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="mb-0 text-lg font-semibold">Question-wise analysis</h3>
                  <Segmented
                    value={filter}
                    onChange={(v) => setFilter(v as typeof filter)}
                    options={[
                      { label: "All (" + activeReport.questions.length + ")", value: "all" },
                      { label: "Correct (" + totals.correct + ")", value: "correct" },
                      { label: "Incorrect (" + totals.incorrect + ")", value: "incorrect" },
                      { label: "Not attempted (" + totals.skipped + ")", value: "skipped" },
                    ]}
                  />
                </div>
                {filteredQuestions.length ? (
                  <div className="space-y-3">
                    {filteredQuestions.map(({ q, i, status }) => {
                      const answer = activeReport.answers?.[String(q.id)];
                      const selected = answer ? answer + ". " + (q.options[answer] ?? "") : "Not attempted";
                      const correctAnswer = q.answer_text || String(q.correct_answer) + ". " + (q.options[String(q.correct_answer)] ?? "");
                      return (
                        <div key={String(q.id) + "-" + i} className="rounded-xl border border-[#e8ede9] p-4">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <Tag>{q.category}</Tag>
                            <Tag color={status === "skipped" ? "default" : status === "correct" ? "green" : "red"}>
                              {status === "skipped" ? "Skipped" : status === "correct" ? "Correct (+1)" : "Incorrect (-1/3)"}
                            </Tag>
                          </div>
                          <h4 className="mb-3 font-semibold leading-6">{i + 1}. {q.question}</h4>
                          <p className="mb-1 text-sm"><span className="font-medium">Your answer: </span>{selected}</p>
                          <p className="mb-1 text-sm"><span className="font-medium">Correct answer: </span>{correctAnswer}</p>
                          {q.answer_text && <p className="mb-0 mt-2 text-sm leading-6 text-muted"><span className="font-medium">Answer note: </span>{q.answer_text}</p>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No questions in this filter." />
                )}
              </Card>
            </>
          )}
        </>
      )}
      {!test && !report && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
          <Card className="rounded-2xl border-0 shadow-soft">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-forest">
                <ClipboardPaste size={19} />
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[.12em] text-forest">
                  Create a practice test
                </div>
                <h2 className="mb-0 mt-0.5 text-lg font-semibold">
                  Import question JSON
                </h2>
              </div>
            </div>
            <p className="text-sm leading-6 text-muted">
              Paste your exam questions with answer keys and categories. You can
              review results after submitting.
            </p>
            <Input.TextArea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={
                '{"exam":"GS practice","questions":[{"id":1,"question":"Question text?","options":{"A":"Option 1","B":"Option 2"},"correct_answer":"A","category":"History"}]}'
              }
              autoSize={{ minRows: 12, maxRows: 22 }}
              className="font-mono text-xs"
            />
            <Button
              type="primary"
              className="mt-4"
              icon={<ClipboardPaste size={15} />}
              onClick={parse}
            >
              Load questions
            </Button>
          </Card>
          <Card className="rounded-2xl border-0 shadow-soft">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff4df] text-[#a86f19]">
                <Trophy size={19} />
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[.12em] text-muted">
                  Your saved results
                </div>
                <h2 className="mb-0 mt-0.5 text-lg font-semibold">
                  Past assessments
                </h2>
              </div>
            </div>
            {groups.length ? (
              <div className="space-y-4">
                {groups.map(({ key, attempts: items }) => {
                  const latest = items[items.length - 1];
                  return (
                    <div
                      key={key}
                      className="overflow-hidden rounded-xl border border-[#e8ede9] bg-white"
                    >
                      <div className="bg-gradient-to-br from-[#f0f7f2] to-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Tag color="green">
                              {items.length}{" "}
                              {items.length === 1 ? "attempt" : "attempts"}
                            </Tag>
                            <h3
                              className="mb-1 mt-2 truncate text-base font-semibold"
                              title={latest.name}
                            >
                              {latest.name}
                            </h3>
                            <div className="text-xs text-muted">
                              Latest score · {score(latest).toFixed(2)} marks ·{" "}
                              {latest.finishedAt
                                ? new Date(
                                    latest.finishedAt,
                                  ).toLocaleDateString()
                                : ""}
                            </div>
                          </div>
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-forest shadow-sm">
                            <Trophy size={18} />
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            type="primary"
                            size="small"
                            icon={<Eye size={14} />}
                            onClick={() => {
                              setReport(latest);
                              setReportTab(latest.id || "");
                            }}
                          >
                            View Result
                          </Button>
                          <Button
                            size="small"
                            icon={<RotateCcw size={14} />}
                            onClick={() => reattempt(latest, items)}
                          >
                            Attempt Again
                          </Button>
                        </div>
                      </div>
                      <div className="border-t border-[#edf0ed] px-4 py-3">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">
                          Attempt history
                        </div>
                        <div className="space-y-1">
                          {items.map((item, i) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                setReport(item);
                                setReportTab(item.id || "");
                              }}
                              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition hover:bg-paper"
                            >
                              <span>
                                <span className="font-medium text-ink">
                                  Attempt {item.attemptNumber ?? i + 1}
                                </span>
                                <span className="ml-2 text-xs text-muted">
                                  {item.finishedAt
                                    ? new Date(
                                        item.finishedAt,
                                      ).toLocaleDateString()
                                    : ""}
                                </span>
                              </span>
                              <span className="font-medium text-forest">
                                {score(item).toFixed(2)} marks
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Your completed assessments will show up here."
              />
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
