import type { TotsAssessment } from "../../agent/lib/schemas";

// One-glance summaries of the two independent investigations, for the list view.

type Tone = "affected" | "clear" | "mixed" | "none";

const TONE: Record<Tone, string> = {
  affected: "text-rose-700 dark:text-rose-300",
  clear: "text-emerald-700 dark:text-emerald-300",
  mixed: "text-amber-700 dark:text-amber-300",
  none: "text-zinc-600 dark:text-zinc-400",
};

function Signal({ main, sub, tone }: { main: string; sub: string; tone: Tone }) {
  return (
    <div>
      <div className={`text-sm font-medium ${TONE[tone]}`}>{main}</div>
      <div className="text-xs text-zinc-600 dark:text-zinc-400">{sub}</div>
    </div>
  );
}

export function CodeSignal({ a }: { a: TotsAssessment }) {
  const versions = a.technical.versionsTested;
  const target = versions.find((v) => v.role === "target");
  const fixed = versions.find((v) => v.role === "fixed");
  const control = versions.find((v) => v.role === "positive_control");

  const version = a.target.version;
  const [main, tone]: [string, Tone] =
    target?.reproduced === true
      ? [`Reproduces on ${version}`, "affected"]
      : target?.reproduced === false
        ? control?.reproduced === true
          ? [`Clean on ${version}`, "clear"]
          : [`Not reproduced on ${version}`, "mixed"]
        : ["Not tested", "none"];

  const sub = fixed
    ? fixed.reproduced === false
      ? `fixed ${fixed.version}: clean`
      : fixed.reproduced === true
        ? `fixed ${fixed.version}: still reproduces`
        : "no fixed release found"
    : "no fixed release found";


  return <Signal main={main} sub={sub} tone={tone} />;
}

export function PeopleSignal({ a }: { a: TotsAssessment }) {
  // Only statements about whether this exact version is affected.
  const items = a.discourse.items.filter((i) => i.claimId === "target");
  const supports = items.filter((i) => i.stance === "supports").length;
  const disputes = items.filter((i) => i.stance === "disputes").length;
  const maintainers = items.filter((i) => i.role === "maintainer" || i.role === "cna");
  const maintainerDisputes = maintainers.filter((i) => i.stance === "disputes").length;
  const maintainerSupports = maintainers.filter((i) => i.stance === "supports").length;

  const [main, tone]: [string, Tone] =
    maintainerDisputes > 0
      ? ["Maintainers dispute", maintainerSupports > 0 ? "mixed" : "clear"]
      : maintainerSupports > 0
        ? ["Maintainers confirm", "affected"]
        : disputes > 0
          ? ["Disputed by others", "mixed"]
          : supports > 0
            ? ["No dispute found", "affected"]
            : ["Little discussion", "none"];


  const sub = items.length === 0 ? "no statements about this version" : `${supports} say affected · ${disputes} say not`;
  return <Signal main={main} sub={sub} tone={tone} />;
}
