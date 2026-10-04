"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { rerun } from "../actions";

const STAGES = [
  ["record", "Fetch NVD, GHSA, and OSV records"],
  ["claims", "Split the CVE into claims"],
  ["investigating", "Technical and discourse investigators (in parallel)"],
  ["judging", "Jev scores the evidence; policy sets the label"],
] as const;

interface ActiveRun {
  id: string;
  status: string;
  stage: string | null;
}

export function LiveRun({
  targetId,
  active,
  enabled,
  lastError,
}: {
  targetId: string;
  active: ActiveRun | null;
  enabled: boolean;
  lastError: string | null;
}) {
  const router = useRouter();
  const [run, setRun] = useState(active);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => setRun(active), [active]);

  // Poll the run row while it is in flight; refresh the page when it settles.
  useEffect(() => {
    if (!run) return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/runs/${run.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const next = (await response.json()) as ActiveRun;
      setRun((current) => (current ? { ...current, ...next } : current));
      if (next.status === "succeeded" || next.status === "failed") {
        clearInterval(timer);
        router.refresh();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [run?.id, router]);

  const inFlight = run && (run.status === "queued" || run.status === "running");
  const currentIndex = STAGES.findIndex(([key]) => key === (run?.stage ?? "record"));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!enabled || pending || Boolean(inFlight)}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await rerun(targetId);
              if (result.error) setError(result.error);
              router.refresh();
            })
          }
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-40 dark:border-zinc-700"
          title={enabled ? "Start a new live investigation" : "Live investigations are turned off"}
        >
          {pending ? "Starting…" : "Re-run"}
        </button>
        {!enabled && <span className="text-xs text-zinc-500">Live runs are off.</span>}
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </div>

      {inFlight && (
        <ol className="space-y-1 rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {STAGES.map(([key, text], index) => {
            const done = index < currentIndex;
            const now = index === currentIndex;
            return (
              <li key={key} className={`flex items-center gap-2 ${done ? "text-zinc-400" : now ? "font-medium" : "text-zinc-400"}`}>
                <span className="w-4 font-mono">{done ? "✓" : now ? <span className="animate-pulse">●</span> : "○"}</span>
                {text}
              </li>
            );
          })}
        </ol>
      )}

      {!inFlight && lastError && (
        <p className="rounded-md bg-rose-50 p-3 font-mono text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          Last run failed: {lastError}
        </p>
      )}
    </div>
  );
}
