// The whole system as one Vercel project. Plain boxes so it works in both themes and at phone width.

function Box({ title, sub, strong }: { title: string; sub: string; strong?: boolean }) {
  return (
    <div
      className={`rounded-md border p-3 ${
        strong
          ? "border-zinc-900 bg-white dark:border-zinc-100 dark:bg-zinc-900"
          : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
      }`}
    >
      <div className="font-mono text-xs font-semibold">{title}</div>
      <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{sub}</div>
    </div>
  );
}

function Down({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
      <span>↓</span>
      {label && <span>{label}</span>}
    </div>
  );
}

export function Architecture() {
  return (
    <figure className="space-y-2">
      <div className="text-center font-mono text-xs text-zinc-600 dark:text-zinc-400">Browser</div>
      <Down label="HTTPS" />

      <div className="rounded-xl border-2 border-zinc-900 p-3 dark:border-zinc-100 sm:p-4">
        <div className="mb-3 flex items-center gap-2 font-mono text-sm font-semibold">
          <span aria-hidden>▲</span> Vercel · one project, one deployment
        </div>

        <Box strong title="Next.js on Vercel" sub="Pages, report UI, server actions that queue runs" />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Box title="Vercel Flags" sub="live-runs: checked before any run is queued" />
          <Box title="Neon Postgres · Vercel Marketplace" sub="Runs, stages, labels, full reports" />
        </div>

        <Down label="/eve/v1 · same origin" />

        <div className="rounded-lg border border-dashed border-zinc-400 p-3 dark:border-zinc-600">
          <Box strong title="eve agent service" sub="Vercel's agent framework, deployed as its own service" />
          <Down />
          <Box strong title="Vercel Workflow · investigate_cve" sub="Durable steps: record → claims → investigators → judge → policy" />
          <Down label="in parallel" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Box title="Technical subagent → Vercel Sandbox" sub="Isolated microVM, egress limited to npm + GitHub" />
            <Box title="Discourse subagent" sub="Advisories, GitHub issues, vendor notes" />
          </div>
        </div>

        <Down label="every model call" />
        <Box strong title="Vercel AI Gateway" sub="Claude (investigators) · OpenAI (claims) · Jev (judge)" />

        <div className="mt-3 border-t border-zinc-200 pt-2 text-center font-mono text-xs text-zinc-600 dark:text-zinc-400 dark:border-zinc-800">
          Vercel OIDC authenticates the Gateway, Sandbox, and Flags. No AI provider API keys.
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 pt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
        <span>↕</span>
        <span>public data: NVD · GitHub Advisories · OSV · GitHub issues · npm</span>
      </div>
    </figure>
  );
}
