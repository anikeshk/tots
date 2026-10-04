import type { ClaimVerdict, Label, OfficialState } from "../../agent/lib/schemas";

const LABEL_STYLES: Record<Label, string> = {
  SUPPORTED: "bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800",
  "LIKELY SUPPORTED": "bg-orange-100 text-orange-800 ring-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:ring-orange-800",
  DISPUTED: "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  "LIKELY OVERSTATED": "bg-violet-100 text-violet-800 ring-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800",
  "LIKELY INVALID": "bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
  "INSUFFICIENT EVIDENCE": "bg-zinc-100 text-zinc-700 ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700",
};

export function LabelBadge({ label, large }: { label: string | null; large?: boolean }) {
  const style = label && label in LABEL_STYLES ? LABEL_STYLES[label as Label] : LABEL_STYLES["INSUFFICIENT EVIDENCE"];
  return (
    <span
      className={`inline-flex items-center rounded-md font-mono font-semibold ring-1 ring-inset ${style} ${
        large ? "px-3 py-1.5 text-base" : "px-2 py-0.5 text-xs"
      }`}
    >
      {label ?? "NOT ASSESSED"}
    </span>
  );
}

export function OfficialBadge({ state }: { state: OfficialState }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-0.5 font-mono text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
      CVE: {state}
    </span>
  );
}

const VERDICT_STYLES: Record<ClaimVerdict, string> = {
  supported: "text-rose-700 dark:text-rose-300",
  contradicted: "text-emerald-700 dark:text-emerald-300",
  disputed: "text-amber-700 dark:text-amber-300",
  unverified: "text-zinc-600 dark:text-zinc-400",
};

const VERDICT_ICONS: Record<ClaimVerdict, string> = {
  supported: "✓",
  contradicted: "✗",
  disputed: "?",
  unverified: "·",
};

export function Verdict({ verdict }: { verdict: ClaimVerdict }) {
  return (
    <span className={`font-mono text-xs font-semibold uppercase ${VERDICT_STYLES[verdict]}`}>
      {VERDICT_ICONS[verdict]} {verdict}
    </span>
  );
}

export function Prob({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs tabular-nums">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <span className="block h-full bg-zinc-600 dark:bg-zinc-300" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      {value.toFixed(2)}
    </span>
  );
}
