// The CVE lifecycle as five illustrated scenes. Plain HTML so it works in both themes and at phone width.
// The package, CVE ID, and ranges are illustrative, not a real record.

const PKG = "some-lib@2.3.0";

function Icon({ d }: { d: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </span>
  );
}

const ICONS = {
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  tag: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01",
  database: "M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  upgrade: "M12 19V5M5 12l7-7 7 7",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0",
};

function Bubble({ who, text, right, tone = "zinc" }: { who: string; text: string; right?: boolean; tone?: "zinc" | "amber" | "sky" }) {
  const tones = {
    zinc: "bg-zinc-100 dark:bg-zinc-800",
    amber: "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
    sky: "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100",
  };
  return (
    <div className={`flex flex-col ${right ? "items-end text-right" : "items-start"}`}>
      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{who}</span>
      <span className={`max-w-[95%] rounded-lg px-2 py-1 text-xs ${right ? "rounded-tr-sm" : "rounded-tl-sm"} ${tones[tone]}`}>{text}</span>
    </div>
  );
}

function Scene({
  steps,
  title,
  icon,
  arrow,
  children,
}: {
  steps: [string, string];
  title: string;
  icon: string;
  arrow?: boolean;
  children: React.ReactNode;
}) {
  const [from, to] = steps;
  return (
    <div className="relative flex flex-col">
      <div className="flex flex-1 flex-col rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <Icon d={icon} />
          <span className="text-sm font-medium leading-tight">{title}</span>
        </div>
        <div className="mt-3 flex-1 space-y-1.5">{children}</div>
        <a href={`#stage-${from}`} className="mt-3 font-mono text-[11px] text-zinc-500 hover:underline dark:text-zinc-400">
          {from === to ? `step ${from}` : `steps ${from}–${to}`} ↓
        </a>
      </div>
      {arrow && (
        <>
          <span
            aria-hidden
            className="absolute top-1/2 -right-[13px] z-10 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-300 bg-white text-[11px] text-zinc-500 sm:flex dark:border-zinc-700 dark:bg-zinc-950"
          >
            →
          </span>
          <div aria-hidden className="pt-2 text-center font-mono text-zinc-500 sm:hidden dark:text-zinc-400">
            ↓
          </div>
        </>
      )}
    </div>
  );
}

function PhaseLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{children}</div>
  );
}

const DATABASES: { db: string; adds: string }[] = [
  { db: "NVD", adds: "CVSS 7.5 · High" },
  { db: "GitHub", adds: "High" },
  { db: "OSV", adds: "listed" },
];

export function Lifecycle() {
  return (
    <figure className="space-y-3">
      <PhaseLabel>🔒 Behind closed doors</PhaseLabel>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
        <Scene steps={["01", "03"]} title="A bug is found and reported" icon={ICONS.search} arrow>
          <Bubble who="Researcher" text="This input freezes the server." />
          <Bubble who="Maintainer" text="Confirmed. We'll ship a fix soon." right />
        </Scene>
        <Scene steps={["04", "06"]} title="It gets a number and a fix" icon={ICONS.tag}>
          <div className="rounded-md border border-zinc-300 px-2 py-1.5 font-mono text-xs dark:border-zinc-700">CVE-2024-XXXXX</div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">Reserved, not public yet</div>
          <div className="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            ✓ patched in 2.4.0
          </div>
        </Scene>
      </div>

      <div className="flex items-center gap-2 py-2" aria-label="Disclosure day">
        <span className="h-0 flex-1 border-t-2 border-dashed border-sky-500" />
        <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-medium text-white dark:bg-sky-500 dark:text-sky-950">
          ↓ Disclosure day
        </span>
        <span className="h-0 flex-1 border-t-2 border-dashed border-sky-500" />
      </div>

      <PhaseLabel>Out in the open</PhaseLabel>
      <div className="grid gap-2 sm:grid-cols-3 sm:gap-4">
        <Scene steps={["07", "08"]} title="Databases copy it and score it" icon={ICONS.database} arrow>
          {DATABASES.map(({ db, adds }) => (
            <div key={db} className="flex items-center justify-between gap-2 rounded bg-zinc-50 px-2 py-1 text-xs dark:bg-zinc-800/60">
              <span className="font-mono">{db}</span>
              <span className="text-zinc-600 dark:text-zinc-400">{adds}</span>
            </div>
          ))}
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            Affected: <span className="font-mono">&lt; 2.4.0</span>
          </div>
        </Scene>
        <Scene steps={["09", "09"]} title="Your scanner sounds the alarm" icon={ICONS.bell} arrow>
          <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs dark:border-rose-800 dark:bg-rose-950/60">
            <div className="font-semibold text-rose-800 dark:text-rose-200">⚠ High severity</div>
            <div className="mt-0.5 font-mono text-rose-900 dark:text-rose-100">{PKG}</div>
            <div className="text-rose-800/80 dark:text-rose-200/80">is vulnerable. Upgrade now.</div>
          </div>
        </Scene>
        <Scene steps={["10", "10"]} title="You upgrade" icon={ICONS.upgrade}>
          <div className="rounded-md border border-zinc-300 px-2 py-1.5 font-mono text-xs dark:border-zinc-700">
            some-lib 2.3.0 → 2.4.0
          </div>
          <div className="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            ✓ Alert cleared
          </div>
        </Scene>
      </div>

      <figcaption className="text-center text-xs text-zinc-500 dark:text-zinc-400">
        Illustrative example. The package, CVE ID, and scores are made up.
      </figcaption>
    </figure>
  );
}
