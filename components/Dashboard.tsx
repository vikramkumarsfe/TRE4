"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Progress, Spin } from "antd";
import { ArrowUpRight, BookOpenCheck, CalendarCheck, Clock3, Flame, Target, TrendingUp, ClipboardCheck, RotateCcw,} from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";

import { calculateMockScore } from "@/lib/scoring.mjs";

const indiaToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const score = calculateMockScore;

export function Dashboard() {
  const [data, setData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(
      [
        "profile",
        "tasks",
        "sessions",
        "syllabus",
        "mocks",
        "mistakes",
        "revisions",
      ].map(async (k) => {
        const response = await fetch(`/api/data/${k}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw Error();
        }

        return [k, await response.json()] as const;
      }),
    )
      .then((items) => setData(Object.fromEntries(items)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const rows = (key: string) => data[key] || [];
  const today = indiaToday();
  const sessions = rows("sessions");
  const profile = rows("profile")[0] || {};

  const weekStart = new Date(`${today}T12:00:00+05:30`);

  weekStart.setDate(
    weekStart.getDate() - ((weekStart.getDay() + 6) % 7),
  );

  const weekDate = weekStart.toISOString().slice(0, 10);

  const weekSessions = sessions.filter(
    (session) => session.date >= weekDate && session.date <= today,
  );

  const weekHours =
    weekSessions.reduce(
      (total, session) => total + Number(session.minutes || 0),
      0,
    ) / 60;

  const tasks = rows("tasks");
  const syllabus = rows("syllabus");

  const group = (subject: string) =>
    syllabus.filter((topic) => topic.subject === subject);

  const pct = (items: any[]) =>
    items.length
      ? Math.round(
          (items.filter((item) => item.status === "Completed").length /
            items.length) *
            100,
        )
      : 0;

  const mocks = rows("mocks") .slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));

  console.log(mocks)
  const scores = mocks.map((mock) => ({
      name: String(mock.name).slice(0, 12),
      score: Number(score(mock).toFixed(1)),
    }))
    .reverse();

    console.log("scores", scores)

  const due = rows("revisions").filter(
      (revision) =>
        revision.status === "Due" && revision.dueDate <= today,
    ).length +
    rows("mistakes").filter(
      (mistake) =>
        mistake.status === "Due" && mistake.nextRevision <= today,
    ).length;

  const dayStudy =
    sessions
      .filter((session) => session.date === today)
      .reduce(
        (total, session) => total + Number(session.minutes || 0),
        0,
      ) / 60;

  const weeklyTarget = Number(profile.targetWeeklyHours || 36);
  const dailyTarget = Number(profile.dailyHours || 6);

  const cards = [
    {
      label: "Study hours · this week",
      value: weekHours.toFixed(1),
      suffix: "hrs",
      icon: Clock3,
      note: `${weeklyTarget} hr weekly target`,
    },
    {
      label: "Today's progress",
      value: `${dayStudy.toFixed(1)} / ${dailyTarget}`,
      suffix: "hrs",
      icon: Target,
      note: `${Math.min(100, Math.round((dayStudy / dailyTarget) * 100))}% of daily target`,
    },
    {
      label: "Syllabus covered",
      value: `${pct(syllabus)}%`,
      suffix: "",
      icon: BookOpenCheck,
      note: `${group("Computer Science").length} CS topics tracked`,
    },
    {
      label: "Latest mock score",
      value: mocks.length ? `${score(mocks[0]).toFixed(1)} %` : "—",
      suffix: "marks",
      icon: ClipboardCheck,
      note: mocks.length
        ? `Best ${Math.max(...mocks.map(score)).toFixed(1)} · ${mocks.length} tests`
        : "Add a first mock test",
    },
  ];

  const daysLeft = profile.examDate
    ? Math.ceil(
        (new Date(`${profile.examDate}T00:00:00+05:30`).getTime() -
          new Date(`${today}T00:00:00+05:30`).getTime()) /
          86400000,
      )
    : null;

  cards.push({
    label: "Days to exam",
    value:
      daysLeft === null ? "—" : String(Math.max(0, daysLeft)),
    suffix: "days",
    icon: CalendarCheck,
    note:
      daysLeft === null
        ? "Set date when officially confirmed"
        : "Configured exam date",
  });

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-forest">
            {new Intl.DateTimeFormat("en-IN", {
              timeZone: "Asia/Kolkata",
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date())}
          </div>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Your preparation overview
          </h1>

          <p className="mb-0 mt-2 text-sm text-muted">
            Keep your focus on the next useful step.
          </p>
        </div>

        <Link
          href="/planner"
          className="flex items-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white no-underline"
        >
          Plan a study session
          <ArrowUpRight size={16} />
        </Link>
      </div>

      {!profile.id && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#dcebe0] bg-mint p-5">
          <div>
            <b className="text-forest">Make this workspace yours</b>
            <p className="mb-0 mt-1 text-sm text-[#60776b]">
              Set your study schedule, personal score targets, and exam
              date if confirmed.
            </p>
          </div>

          <Link
            href="/onboarding"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-forest no-underline"
          >
            Set up profile
          </Link>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, suffix, icon: Icon, note }) => (
          <article
            key={label}
            className="rounded-2xl border border-[#e8ede9] bg-white p-5 shadow-soft"
          >
            <div className="flex items-start justify-between">
              <span className="text-sm font-medium text-muted">
                {label}
              </span>

              <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-forest">
                <Icon size={18} />
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-[30px] font-semibold tracking-tight">
                {value}
              </span>
              <span className="text-xs text-muted">{suffix}</span>
            </div>

            <div className="mt-1 text-xs text-muted">{note}</div>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <article className="rounded-2xl border border-[#e8ede9] bg-white p-5 shadow-soft md:p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="m-0 text-base font-semibold">
                Mock score trend (in percent %)
              </h2>
              <p className="mb-0 mt-1 text-xs text-muted">
                Merit marks only · qualifying language excluded
              </p>
            </div>

            <Link
              href="/mocks"
              className="text-xs font-semibold text-forest no-underline"
            >
              All tests →
            </Link>
          </div>

          {scores.length ? (
            <div className="mt-5 h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scores}>
                  <CartesianGrid
                    stroke="#edf1ed"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#829087" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#829087" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#197456"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: "#197456",
                      strokeWidth: 0,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="grid h-[250px] place-items-center">
              <div className="text-center">
                <TrendingUp className="mx-auto mb-3 text-muted" />
                <p className="mb-1 text-sm font-medium">
                  Your score trend starts with test one
                </p>
                <p className="mb-3 text-xs text-muted">
                  Record a mock to see how your performance changes.
                </p>
                <Link
                  href="/mocks"
                  className="text-sm font-semibold text-forest no-underline"
                >
                  Add first mock test →
                </Link>
              </div>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-[#e8ede9] bg-white p-5 shadow-soft md:p-6">
          <h2 className="m-0 text-base font-semibold">
            Preparation pulse
          </h2>
          <p className="mb-5 mt-1 text-xs text-muted">
            Topics marked completed in each area
          </p>

          <div className="space-y-5">
            {[
              {
                label: "Computer Science",
                value: pct(group("Computer Science")),
                color: "#197456",
              },
              {
                label: "General Studies",
                value: pct(group("General Studies")),
                color: "#8c72b5",
              },
              {
                label: "Language qualifying",
                value: pct(group("Language")),
                color: "#d2964b",
              },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-semibold">{item.value}%</span>
                </div>

                <Progress
                  percent={item.value}
                  showInfo={false}
                  strokeColor={item.color}
                  trailColor="#edf1ed"
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl bg-paper p-3">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <RotateCcw size={14} />
                  Revisions due
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {due}
                </div>
              </div>

              <div className="rounded-xl bg-paper p-3">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <CalendarCheck size={14} />
                  Active study days
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {new Set(weekSessions.map((session) => session.date)).size}
                  <span className="text-sm font-normal text-muted">
                    {" "}this week
                  </span>
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-[#e8ede9] bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 text-base font-semibold">
                This week at a glance
              </h2>
              <p className="mb-0 mt-1 text-xs text-muted">
                Study sessions recorded this week
              </p>
            </div>
            <Flame className="text-[#d2964b]" size={19} />
          </div>

          <div className="mt-5 flex items-center gap-5">
            <div className="grid h-[92px] w-[92px] shrink-0 place-items-center rounded-full bg-mint text-xl font-semibold text-forest">
              {Math.min(
                100,
                Math.round((weekHours / weeklyTarget) * 100),
              )}
              %
            </div>

            <div>
              <div className="text-2xl font-semibold">
                {weekHours.toFixed(1)}
                <span className="text-sm font-normal text-muted">
                  {" "}/ {weeklyTarget} hours
                </span>
              </div>
              <p className="mb-0 mt-1 text-sm text-muted">
                {weekSessions.length} study sessions saved
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-[#e8ede9] bg-white p-5 shadow-soft">
          <h2 className="m-0 text-base font-semibold">
            Next best actions
          </h2>
          <p className="mb-0 mt-1 text-xs text-muted">
            Stay focused on the targets you control.
          </p>

          <div className="mt-4 space-y-2">
            {[
              {
                text: `${due} revisions due`,
                href: "/revisions",
                icon: RotateCcw,
              },
              {
                text: `${Math.max(
                  0,
                  Math.round((dailyTarget - dayStudy) * 60),
                )} minutes left in today's study target`,
                href: "/planner",
                icon: Clock3,
              },
              {
                text: `${
                  tasks.filter((task) => task.status === "Completed")
                    .length
                } planner tasks completed`,
                href: "/planner",
                icon: CalendarCheck,
              },
            ].map(({ text, href, icon: Icon }) => (
              <Link
                key={text}
                href={href}
                className="flex items-center justify-between rounded-xl bg-paper px-3 py-3 text-sm text-ink no-underline"
              >
                <span className="flex items-center gap-3">
                  <Icon size={16} className="text-forest" />
                  {text}
                </span>
                <ArrowUpRight size={15} className="text-muted" />
              </Link>
            ))}
          </div>
        </article>
      </section>

      <p className="mt-6 text-center text-xs text-muted">
        TRE Tracker shows your personal preparation progress. It does
        not predict selection or represent official BPSC cutoffs.
      </p>
    </div>
  );
}