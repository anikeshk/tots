# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Given a CVE and a package version (npm only), tots assesses whether the CVE is valid for that version. It is a Next.js app plus an [eve](https://eve.dev/docs) agent, deployed together on Vercel.

**`PLAN.md` is the design.** Read it before changing behaviour, and keep its Decisions (§8) and Changes (§10) sections current.

- Package manager: **pnpm**. Runtime: **Node.js 24.x**. ESM only (`"type": "module"`).
- Key dependencies: `eve`, `next` 16, `ai` (AI SDK 7, pinned), `zod` v4, `flags` + `@flags-sdk/vercel`, `@neondatabase/serverless`.

## Layout

```
agent/                      # The eve agent, compiled by eve, mounted at /eve/v1 by withEve
  agent.ts                  # Root: defaultTools off; its only tool is investigate_cve
  instructions.md
  channels/eve.ts           # Auth: vercelOidc, localDev, none() (public demo)
  tools/investigate_cve.ts  # Workflow tool: the whole pipeline (claim run → record → claims → investigators → Jev → policy → save)
  subagents/technical/      # Sandbox PoC investigator (Vercel Sandbox; web_fetch blocks discourse pages)
  subagents/discourse/      # Who-said-what investigator (GitHub tools, web_fetch, web_search)
  lib/                      # Shared with the UI: schemas, db, records, claims, judge, policy, models, github
  skills/eve/               # eve skill (installed via skills-lock.json, do not hand-edit)
app/                        # Next.js UI: list (/), report (/[cve]/[...pkg], e.g. /CVE-2024-10491/express@5.2.1), server actions, /api/runs/[id]
flags.ts                    # live-runs flag (Vercel Flags)
db/migrations/              # Plain SQL, applied by pnpm db:migrate
evals/                      # eve evals: one per seed case + provenance
tests/                      # node:test unit tests (policy)
scripts/                    # migrate.ts, seed.ts
```

## Docs: read before writing code

- eve: `node_modules/eve/docs/README.md` (matches the installed version; do not rely on memorized eve APIs)
- AI SDK 7: `node_modules/ai/docs/`
- Next.js 16: `node_modules/next/dist/docs/`

## Commands

```sh
pnpm dev              # Next.js + eve dev server (local models: ChatGPT login; TOTS_MODELS=gateway for AI Gateway)
pnpm typecheck        # tsc --noEmit
pnpm test             # policy unit tests
pnpm db:migrate       # apply db/migrations to DATABASE_URL
pnpm seed             # run both seed cases against a running `pnpm dev`, writing to Neon
pnpm eval             # eve evals; while `pnpm dev` runs, add `-- --url http://localhost:3000`. Each runs a full investigation and writes a run to the shared DB
```

## Notes and gotchas

- **Run gating:** only the flag-checked server actions in `app/actions.ts` create `queued` runs; `investigate_cve` only runs a run it can claim from `queued`. Keep it that way, because `/eve/v1` is public.
- **Models:** `agent/lib/models.ts`. Deployed code always uses AI Gateway (needs paid credits). OpenAI models refuse the technical PoC work (cyber safety filter), so the investigators use Claude.
- **Workflow tools:** side effects, `process.env`, and dates belong in `"use step"` functions; the workflow body must stay deterministic.
- **Model output schemas:** avoid `z.record`, `.optional()`, and array `.max()` in schemas sent to models (`TechnicalReport`, `DiscourseReport`, `ClaimList`).
- **Vercel:** linked to the `tots` project. Run `vercel env pull` to refresh `.env.local` (the OIDC token expires). Never commit `.env*` files.
- **Marketplace installs** (e.g. `vercel integration add`) may drop provider skills into `agent/skills/`, which would load them into the tots agent. Remove them.
- Do not edit anything under `.eve/`, `.next/`, or `node_modules/.cache/eve/`; they are generated.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
