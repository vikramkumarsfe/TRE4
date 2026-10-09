"use client";
import { AppShell } from "@/components/AppShell";
import { Records,specs } from "@/components/Records";
export default function Page(){return <AppShell><Records spec={specs.planner}/><div className="my-8 border-t border-[#e1e8e2]"/><Records spec={specs.sessions}/></AppShell>}
