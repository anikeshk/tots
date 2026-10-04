# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

`tots` is an AI agent built with [eve](https://eve.dev/docs), Vercel's filesystem-first framework for durable AI agents. It is at an early, scaffolded stage: a single agent with default instructions and the eve channel.

- Package manager: **pnpm** (see `pnpm-workspace.yaml`)
- Runtime: **Node.js 24.x**
- Key dependencies: `eve`, `ai` (AI SDK 7), `@vercel/connect`, `zod` v4

## Layout

```
agent/                 # The eve agent — everything here is compiled by eve
  agent.ts             # defineAgent(): model + reasoning config
  instructions.md      # System prompt / agent identity
  channels/eve.ts      # eve channel + auth (vercelOidc, localDev, placeholderAuth)
  skills/eve/SKILL.md  # eve skill (installed via skills-lock.json, do not hand-edit)
.eve/                  # Local eve dev state (snapshots, logs, caches) — gitignored, never edit
skills-lock.json       # Lockfile for installed agent skills
```

In eve, an agent is a directory: instructions, skills, tools, connections, channels, subagents, and schedules are each files under `agent/`. Add capabilities by adding files in the matching subdirectory (e.g. `agent/tools/`, `agent/connections/`, `agent/schedules/`) rather than wiring them up manually.

## eve docs — read before writing eve code

The bundled docs match the installed version exactly and are the source of truth:

```
node_modules/eve/docs/README.md
```

Read the relevant guide there before adding or changing tools, skills, connections, channels, subagents, schedules, or evals. Do not rely on memorized eve APIs. Likewise for AI SDK 7, check `node_modules/ai/docs/`.

## Commands

```sh
pnpm install          # install deps (required before docs/ types are available)
npx eve dev           # run the agent locally with hot reload (writes to .eve/)
```

There are no build/test/lint scripts in `package.json` yet.

## Notes and gotchas

- **Model:** `agent/agent.ts` uses `chatgpt(...)` from `eve/models/openai`; the selected provider is recorded in `.eve/provider.json`.
- **Auth:** `placeholderAuth()` in `agent/channels/eve.ts` blocks browser requests in production. Replace it with a real auth provider (or `none()` for a public demo) before deploying.
- **Module type:** the package is ESM (`"type": "module"`), which AI SDK 7 requires. Use `import`/`export`, not `require`.
- **Vercel:** The project is not yet linked (no `.vercel/`, `vercel.ts`, or `vercel.json`). Use `vercel link` / `vercel env pull` when deploying; never commit `.env*` files.
- Do not edit anything under `.eve/` or `node_modules/.cache/eve/` — they are generated.
