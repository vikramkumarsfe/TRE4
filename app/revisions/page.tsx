"use client";
import { AppShell } from "@/components/AppShell";
import { Records,specs } from "@/components/Records";
export default function Page(){return <AppShell><Records spec={specs.revisions}/></AppShell>}
