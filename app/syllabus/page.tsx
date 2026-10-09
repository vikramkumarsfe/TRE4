"use client";
import { AppShell } from "@/components/AppShell";
import { Records,specs } from "@/components/Records";
import { StarterTopics } from "@/components/StarterTopics";
export default function Page(){return <AppShell><StarterTopics/><Records spec={specs.syllabus}/></AppShell>}
