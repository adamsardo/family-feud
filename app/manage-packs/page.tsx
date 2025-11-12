'use client';

import { Suspense } from "react";
import Link from "next/link";
import { QuestionPackManager } from "@/components/question-manager";
import { Button } from "@/components/ui/button";

export default function ManagePacksPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-[#0b1020] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Manage Question Packs</h1>
            <p className="mt-1 text-sm text-white/60">
              Build custom decks, import shared packs, and organize your library.
            </p>
          </div>
          <Button asChild variant="ghost" className="text-white/80 hover:text-white">
            <Link href="/">← Back to game</Link>
          </Button>
        </div>
        <Suspense
          fallback={
            <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-center text-white/70">
              Loading question packs…
            </div>
          }
        >
          <QuestionPackManager />
        </Suspense>
      </div>
    </main>
  );
}
