"use client";
import { AppShell } from "@/components/AppShell";
import { Records,specs } from "@/components/Records";
import { MistakeReview } from "@/components/MistakeReview";
export default function Page(){return <AppShell><div className="mb-6"><div className="text-sm font-medium text-forest">Learn from the miss</div><h1 className="mt-1 text-3xl font-semibold">Mistake notebook</h1><p className="mb-0 mt-2 text-sm text-muted">Capture questions you want to understand, then revisit them until they stick.</p></div><MistakeReview/><Records spec={specs.mistakes}/></AppShell>}
