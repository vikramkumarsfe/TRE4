"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Empty, message, Progress, Table, Tag } from "antd";
import { FileSearch, Upload, BookOpen, CircleCheck, CircleAlert, RefreshCw } from "lucide-react";

type Question = {
  number: string; question: string; options: string[]; selectedAnswer: string | null; correctAnswer: string | null;
  correctness: "correct" | "incorrect" | "unknown"; topic: string; subject: string; mistakeType: string; explanation: string; confidence: number;
};
type Topic = { topic: string; attempted: number; correct: number; incorrect: number; accuracy: number | null; status: string; averageConfidence: number };
type Resource = { topic: string; title: string; url: string; type: string; reason: string };
type Run = { id: string; testName: string; filename: string; status: string; error?: string; createdAt: string; savedMistakesAt?: string; results?: { summary: string; note: string; questionCount: number; gradedCount: number; topics: Topic[]; questions: Question[]; resources: Resource[] } };

function statusColor(status: string) {
  if (status === "Weak") return "red";
  if (status === "Needs practice") return "orange";
  if (status === "On track") return "green";
  return "default";
}

export function MockAnalyzer() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [testName, setTestName] = useState("");
  const [answerSheet, setAnswerSheet] = useState<File>();
  const [answerKey, setAnswerKey] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, holder] = message.useMessage();

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/analyzer", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load reports.");
      setRuns(body);
    } catch (error) {
      msg.error(error instanceof Error ? error.message : "Could not load reports.");
    }
  }, [msg]);

  useEffect(() => { void load(); }, [load]);
  const hasActiveRun = runs.some((run) => run.status === "queued" || run.status === "processing");
  useEffect(() => {
    if (!hasActiveRun) return;
    const timer = setInterval(() => { void load(); }, 4000);
    return () => clearInterval(timer);
  }, [hasActiveRun, load]);

  const current = useMemo(() => runs.find((run) => run.id === selectedId) || runs[0], [runs, selectedId]);

  async function submit() {
    if (!answerSheet) { msg.warning("Choose your attempted answer sheet PDF first."); return; }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("answerSheet", answerSheet);
      if (answerKey) form.set("answerKey", answerKey);
      form.set("testName", testName);
      const response = await fetch("/api/analyzer", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not start analysis.");
      setSelectedId(body.id);
      setTestName(""); setAnswerSheet(undefined); setAnswerKey(undefined);
      const answerInput = document.getElementById("answer-sheet-file") as HTMLInputElement | null;
      const keyInput = document.getElementById("answer-key-file") as HTMLInputElement | null;
      if (answerInput) answerInput.value = "";
      if (keyInput) keyInput.value = "";
      msg.success("PDF queued. This page will update when the analysis finishes.");
      await load();
    } catch (error) {
      msg.error(error instanceof Error ? error.message : "Could not start analysis.");
    } finally { setBusy(false); }
  }

  async function saveMistakes() {
    if (!current) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/analyzer/${current.id}/save-mistakes`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save wrong answers.");
      msg.success(`${body.saved} wrong question${body.saved === 1 ? "" : "s"} added to your mistake notebook.`);
      await load();
    } catch (error) { msg.error(error instanceof Error ? error.message : "Could not save wrong answers."); }
    finally { setSaving(false); }
  }

  const questionColumns = [
    { title: "Q", dataIndex: "number", key: "number", width: 70, render: (value: string) => value || "—" },
    { title: "Topic", dataIndex: "topic", key: "topic", width: 190 },
    { title: "Result", dataIndex: "correctness", key: "correctness", width: 115, render: (value: string) => <Tag color={value === "correct" ? "green" : value === "incorrect" ? "red" : "default"}>{value === "unknown" ? "Unscored" : value}</Tag> },
    { title: "Your answer", dataIndex: "selectedAnswer", key: "selectedAnswer", width: 160, render: (value: string | null) => value || "Not detected" },
    { title: "Answer key", dataIndex: "correctAnswer", key: "correctAnswer", width: 160, render: (value: string | null) => value || "Not available" },
    { title: "Scan confidence", dataIndex: "confidence", key: "confidence", width: 160, render: (value: number) => <Progress percent={Math.round(value * 100)} size="small" showInfo={false} /> },
  ];

  const questions = current?.results?.questions || [];
  const incorrectCount = questions.filter((question) => question.correctness === "incorrect").length;

  return <>
    {holder}
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><div className="text-sm font-medium text-forest">Practice insights</div><h1 className="mt-1 text-3xl font-semibold tracking-tight">Mock test analyzer</h1><p className="mb-0 mt-2 max-w-2xl text-sm leading-6 text-muted">Upload a scanned answer sheet to classify questions, find topics to revisit, and get linked study resources.</p></div>
      <Button icon={<RefreshCw size={15} />} onClick={() => void load()}>Refresh reports</Button>
    </div>

    <Card className="mb-6 shadow-soft" title={<span className="flex items-center gap-2"><FileSearch size={18} />Analyze an answer sheet</span>}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">Test name <span className="font-normal text-muted">(optional)</span><input value={testName} onChange={(event) => setTestName(event.target.value)} maxLength={100} className="mt-2 block w-full rounded-lg border border-[#dfe6e1] px-3 py-2 font-normal outline-none focus:border-[#648974]" placeholder="e.g. TRE mock test 4" /></label>
        <label className="block text-sm font-medium">Attempted answer sheet PDF <span className="text-red-500">*</span><input id="answer-sheet-file" type="file" accept="application/pdf,.pdf" onChange={(event) => setAnswerSheet(event.target.files?.[0])} className="mt-2 block w-full rounded-lg border border-[#dfe6e1] p-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-mint file:px-3 file:py-1.5" /><span className="mt-1 block text-xs font-normal text-muted">PDF only, up to 20 MB. Scanned PDFs are supported.</span></label>
        <label className="block text-sm font-medium">Answer key PDF <span className="font-normal text-muted">(optional, for accuracy and weakness scoring)</span><input id="answer-key-file" type="file" accept="application/pdf,.pdf" onChange={(event) => setAnswerKey(event.target.files?.[0])} className="mt-2 block w-full rounded-lg border border-[#dfe6e1] p-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-mint file:px-3 file:py-1.5" /></label>
        <div className="flex items-end"><Button type="primary" icon={<Upload size={16} />} loading={busy} onClick={() => void submit()}>Queue analysis</Button></div>
      </div>
      <Alert className="mt-4" type="info" showIcon message="The PDF is sent to the configured OpenAI API for analysis, then the temporary local and API file copies are deleted. Add an answer key to calculate accuracy; unclear marks remain ungraded." />
    </Card>

    {runs.length > 0 && <div className="mb-4 flex flex-wrap gap-2">{runs.map((run) => <Button key={run.id} type={run.id === current?.id ? "primary" : "default"} onClick={() => setSelectedId(run.id)}>{run.testName || run.filename || "Mock report"} · {run.status}</Button>)}</div>}

    {!current ? <Card><Empty description="Your analyzer reports will appear here." /></Card> : <>
      {current.status === "queued" || current.status === "processing" ? <Card className="mb-5"><div className="flex items-center gap-3"><RefreshCw className="animate-spin text-forest" size={20} /><div><div className="font-semibold">{current.status === "queued" ? "Waiting for the analyzer worker" : "Reading and analyzing your PDFs"}</div><div className="text-sm text-muted">This can take a little while for a long scanned answer sheet.</div></div></div></Card> : null}
      {current.status === "failed" ? <Alert className="mb-5" type="error" showIcon message="Analysis could not be completed" description={current.error || "Check the PDF and API setup, then try uploading it again."} /> : null}
      {current.status === "completed" && current.results && <>
        <Card className="mb-5 shadow-soft" title={current.testName || current.filename || "Analysis report"}>
          <p className="text-sm leading-6">{current.results.summary}</p>
          <div className="flex flex-wrap gap-3 text-sm"><Tag>{current.results.questionCount} questions read</Tag><Tag color="blue">{current.results.gradedCount} graded</Tag><Tag color="red">{incorrectCount} confirmed wrong</Tag></div>
          {current.results.note && <Alert className="mt-4" type="warning" showIcon message={current.results.note} />}
        </Card>

        <Card className="mb-5 shadow-soft" title={<span className="flex items-center gap-2"><CircleAlert size={18} />Topic performance</span>}>
          {current.results.topics.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{current.results.topics.map((topic) => <div key={topic.topic} className="rounded-xl border border-[#e8ede9] p-4"><div className="flex items-start justify-between gap-2"><div className="font-semibold">{topic.topic}</div><Tag color={statusColor(topic.status)}>{topic.status}</Tag></div><div className="mt-2 text-xs text-muted">{topic.attempted} seen · {topic.incorrect} wrong{topic.accuracy === null ? " · no answer key" : ` · ${topic.accuracy}% accuracy`}</div>{topic.accuracy !== null && <Progress className="mt-2" percent={topic.accuracy} size="small" showInfo={false} status={topic.status === "Weak" ? "exception" : "normal"} />}</div>)}</div> : <Empty description="No questions could be classified." />}
        </Card>

        <Card className="mb-5 shadow-soft" title={<span className="flex items-center gap-2"><CircleCheck size={18} />Question review</span>} extra={<Button type="primary" disabled={!incorrectCount || Boolean(current.savedMistakesAt)} loading={saving} onClick={() => void saveMistakes()}>{current.savedMistakesAt ? "Saved to mistake notebook" : "Save wrong answers"}</Button>}>
          <Table rowKey={(row: Question, index?: number) => `${row.number}-${index}`} dataSource={questions} columns={questionColumns as any} scroll={{ x: 850 }} pagination={{ pageSize: 10, showSizeChanger: false }} expandable={{ expandedRowRender: (question: Question) => <div className="space-y-2"><div className="whitespace-pre-wrap text-sm font-medium">{question.question}</div>{question.options.length > 0 && <div className="text-sm text-muted">{question.options.join(" · ")}</div>}<div className="text-sm text-muted">{question.subject} · {question.mistakeType}</div>{question.explanation && <p className="mb-0 text-sm leading-6">{question.explanation}</p>}</div>}} locale={{ emptyText: <Empty description="No questions were extracted." /> }} />
        </Card>

        <Card className="shadow-soft" title={<span className="flex items-center gap-2"><BookOpen size={18} />Study resources</span>}>
          {current.results.resources.length ? <div className="grid gap-3 md:grid-cols-2">{current.results.resources.map((resource, index) => <article key={`${resource.url}-${index}`} className="rounded-xl border border-[#e8ede9] p-4"><div className="flex flex-wrap items-center gap-2"><Tag color="blue">{resource.type}</Tag><span className="text-xs text-muted">{resource.topic}</span></div><a className="mt-2 block font-semibold text-forest underline" href={resource.url} target="_blank" rel="noreferrer">{resource.title}</a><p className="mb-0 mt-1 text-sm leading-6 text-muted">{resource.reason}</p></article>)}</div> : <Empty description="No matching resources were returned. Try refreshing this report later." />}
        </Card>
      </>}
    </>}
  </>;
}
