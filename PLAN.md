# TOTS — Plan

**TOTS.** Given a published CVE and the component@version it is being flagged on, decide how well the public evidence supports it: real, disputed, overstated, or noise?

TOTS does not replace the CVE Program's status. It shows the official status (`PUBLISHED`, `DISPUTED`, `REJECTED`) next to its own evidence-based assessment and cites a source for every conclusion.

Status: built. Changes made during the build are listed in §10.

---

## 1. Demo goal

A public web page on Vercel that lists a small set of assessments. Each assessment is a **CVE + component@version** pair, and opens a report showing:

- the official record (NVD / GHSA / OSV) and its status
- the CVE description broken into **atomic claims**, each with a verdict for the target version
- **technical evidence**: code, patch diff, and PoC output from a sandbox run
- **discourse evidence**: who said what, their role, a verbatim quote, and a link
- the **Jev scores**, and the deterministic policy that turns them into the final label
- a **Re-run** button and an **Add CVE** form, both behind a feature flag that is off by default (§3.9)

### Seed cases

| # | CVE | Target | Background | Expected |
|---|-----|--------|------------|----------|
| 1 | CVE-2024-45296 ([GHSA-9wv6-86v2-598j](https://github.com/advisories/GHSA-9wv6-86v2-598j)) | `path-to-regexp@6.2.2` | ReDoS from backtracking regexes on `/:a-:b` routes; fixed in 6.3.0. The maintainer wrote the advisory and the fix. The PoC is a single input string. | **SUPPORTED** |
| 2 | CVE-2024-10491 | `express@5.2.1` | `res.links` Link-header injection. NVD scopes it to express 3.x, but some scanners also flag 4.x and 5.x. In [expressjs/express#6222](https://github.com/expressjs/express/issues/6222) the maintainers say it was patched in v4 and that the 4.x/5.x reports are wrong. One commenter says they reproduced it on 5.1.0. | **DISPUTED** (first run, 2026-10-04): the PoC injects the same `Link` header on 3.21.2, 4.x, and 5.2.1, and no fix commit exists, while the maintainers say 4.x/5.x are unaffected. |

Only express@5.2.1 is being judged in case 2. The technical agent still runs the PoC once against a known-vulnerable version (3.21.2) as a **positive control**: a PoC that fails on 5.2.1 only means something if it succeeds on a version that is actually vulnerable.

---

## 2. Architecture

```
  Browser ── Next.js UI (app/) ── useEveAgent ──► eve agent "tots" (agent/) at /eve/v1
     │              │                                       │
     │       reads assessments                    investigate_cve (workflow tool)
     │              ▼                                       │
     │       Neon Postgres  ◄── 6. persist ─────────────────┤
     │                                                      │
     │   1. fetch_cve_record ── NVD + GHSA + OSV (plain code, no LLM)
     │   2. decompose claims ── LLM with outputSchema → Claim[]
     │   3. fan out in parallel; each side sees only record + claims + target
     │          ├── subagent: technical  (own Vercel Sandbox)
     │          └── subagent: discourse  (web_fetch + GitHub API)
     │   4. judge ── evaluate() with typesafe-ai/jev over the compact evidence bundle
     │   5. policy ── deterministic thresholds → TOTS label (agent/lib/policy.ts)
     │
     └── flag "live-runs" (Vercel Flags) gates Re-run / Add CVE, in the UI and in the tool
```

Design rules:

- **The two investigators are independent.** Neither sees the other's output. Only the judge sees both. This stops online opinion from leaking into the technical verdict, and stops the technical result from steering the discourse summary.
- **Jev judges and nothing else.** It never investigates. It answers typed questions over evidence the subagents already gathered.
- **The final label is code, not a model.** Jev's probabilities go into `policy.ts`, so a reviewer can trace the label to its thresholds.
- **Every discourse item carries provenance:** speaker, role, URL, verbatim quote. No sentiment scores.

---

## 3. Components

### 3.1 Record fetch — `agent/tools/fetch_cve_record.ts`
- Sources:
  - NVD 2.0 API: description, CVSS, CWE, CPE ranges, `vulnStatus`
  - GitHub Advisory API: GHSA, affected/patched ranges, references
  - OSV.dev: ecosystem ranges
- Normalizes these into one `CveRecord`, keeping **each source's own version range**. Disagreement between sources is evidence in its own right.
- Plain HTTP. GitHub calls go through `agent/lib/github.ts` (§3.4).

### 3.2 Claim decomposition
- An LLM call with `outputSchema` turns the description and ranges into claims:
  - `kind`: `product | versions | auth | vector | impact | reachability | weakness`
  - `text`
  - `assertedBy`: which source(s) make the claim
- One extra claim is always added: **"`<target>` is affected"**. This is the claim the label hinges on.

### 3.3 Technical subagent — `agent/subagents/technical/`
- Has its own sandbox (`sandbox.ts`), on Vercel when deployed and Docker locally. Network egress is allowlisted to `registry.npmjs.org`, `github.com`, and `codeload.github.com`.
- Steps:
  1. Locate the fix commit or PR from the advisory references.
  2. Install the target version, the fixed version, and one known-vulnerable version (the positive control).
  3. Diff, and identify the vulnerable code path in the target.
  4. Write and run a minimal PoC against each version, capturing commands, stdout (truncated), and timing.
- Returns `TechnicalFinding[]`: one per claim, with `supported | contradicted | not_tested`, the evidence, and the commands it ran.
- npm only for now.

### 3.4 Discourse subagent — `agent/subagents/discourse/`
- **GitHub access** uses a `GITHUB_TOKEN` env var, set with `vercel env add`.
  - The token is a fine-grained PAT with read-only access to public repositories and no other permissions.
  - All GitHub calls go through one helper, `agent/lib/github.ts`, which adds the header.
  - Tools run in the app runtime, so the token never enters the sandbox.
  - Moving to Vercel Connect later (e.g. for private repos) only changes that helper.
- Tools: `web_fetch`, plus GitHub issues, PRs, and comments. GitHub's `author_association` field (`MEMBER`, `OWNER`, `NONE`) is what makes maintainer authority checkable rather than guessed.
- Returns `DiscourseItem[]`:
  - `speaker`
  - `role`: `maintainer | cna | reporter | vuln_db | scanner_vendor | community`
  - `url`
  - `quote` (verbatim, ≤ 300 chars)
  - `stance`: `supports | disputes | neutral`
  - `claimId`
- Also returns an unresolved-questions list.

### 3.5 Judge — `agent/lib/judge.ts`
- `evaluate()` from `eve/ai` (default model `typesafe-ai/jev`, through AI Gateway).
- Per-claim questions, keyed by `claim_<id>_…`:
  - `technically_supported` (boolean)
  - `credibly_disputed` (boolean)
- Global questions:
  - `bug_exists`
  - `target_affected`
  - `reproduced_on_target`
  - `positive_control_reproduced`
  - `patch_addresses_claim`
  - `impact_matches_description`
  - `credible_dispute_exists`
  - `evidence_sufficient`
  - `authority_of_dispute` (score: none → community → vendor → maintainer)
- Jev's `state` is limited to about 32k tokens. Subagents therefore return compact, schema-shaped evidence rather than transcripts.

### 3.6 Policy — `agent/lib/policy.ts`
The policy maps Jev answers to a label. These are the starting rules, to be tuned after the first runs:

| Label | Rule (sketch) |
|-------|---------------|
| INSUFFICIENT EVIDENCE | evidence_sufficient < .5 (checked first) |
| SUPPORTED | target_affected ≥ .9, reproduced_on_target ≥ .8, no claim `credibly_disputed` ≥ .5 |
| LIKELY SUPPORTED | target_affected ≥ .75, not reproduced, no strong dispute |
| DISPUTED | credible_dispute_exists ≥ .6 and the technical evidence does not settle it |
| LIKELY OVERSTATED | bug_exists ≥ .75 but impact or prerequisites claims are unsupported |
| LIKELY INVALID | positive control reproduced, target did not, and/or a maintainer disputes the target being affected |

Alongside the label, it computes an **Evidence Quality** checklist: fix commit found, vulnerable code identified, positive control reproduced, target tested, vendor acknowledgment.

### 3.7 Orchestrator — `agent/tools/investigate_cve.ts`
- A `defineWorkflowTool` that runs steps 1–6. It is durable and resumes after a crash.
- `ctx.agent("technical").send(..., { outputSchema })` and the discourse call run under `Promise.all`.
- Both subagents set `tool: false`, so the root model can't call them ad hoc.
- Its input is a `runId`. It starts only if it can atomically claim a `queued` row (§3.9), and refuses otherwise.
- It updates the run row as it goes (`running` → `succeeded` / `failed`) and writes the `TotsAssessment` (§3.8).

### 3.8 Persistence — Neon Postgres (Vercel Marketplace)
A deployed function can't write back into the git repo; its filesystem is ephemeral. Results go in **Neon Postgres**, provisioned with `vercel integration add neon`. That command also injects `DATABASE_URL` into the project.

Two tables:

- **`targets`** — `id`, `cve_id`, `purl`, `created_at`.
  - Unique on `(cve_id, purl)`.
  - One row per assessment shown in the list.
- **`runs`** — `id`, `target_id`, `status` (`running | succeeded | failed`), `session_id`, `label`, `assessment` (jsonb), `error`, `started_at`, `finished_at`.
  - Every run is kept, so history comes for free.
  - The list page shows the latest succeeded run per target.

Why a database rather than JSON files in Blob:
- Runs started from the UI need a **status while they're in flight**. That includes reconnecting to the eve `session_id` after a page reload.
- The list view needs **"latest run per target"** and sorting by label.
- Uniqueness on `(cve_id, purl)` stops duplicate Add CVE submissions.

The full report stays a single jsonb document, shaped by the zod schema, so the database is just as easy to work with as files.

Access goes through `@neondatabase/serverless` with a lazily created client, so `next build` works without the env var. Migrations are plain SQL in `db/migrations/`. The seed cases come from `pnpm seed`, which runs the investigation for both cases locally against the same database.

### 3.9 Live-run flag — Vercel Flags
- One boolean flag, `live-runs`, default **off**, defined with the Flags SDK (`flags` + `@flags-sdk/vercel`).
- **UI:** the Re-run button and the Add CVE form are disabled when it's off.
- **Server:** the Add CVE and Re-run server actions check the flag, then create a `queued` run row and open the eve session. `investigate_cve` only runs a run it can claim from `queued`. Since `/eve/v1` is public under `none()`, this is what stops anonymous callers from starting investigations: they can't create queued rows.
- **Turning it on:** two ways.
  - **Live demo or adding new cases:** turn the flag on in the Vercel dashboard. This takes effect immediately, with no redeploy. Turn it off afterwards.
  - **Just you:** override it in your own browser with the Vercel Toolbar's Flags Explorer. Because the check happens in the server action, inside your own request, the override applies to starting runs as well as to the UI.
- **Cost guard:** the root agent's default tools (bash, web_search, …) are switched off, so anonymous chat with `/eve/v1` can't do much. A Vercel Firewall rate limit on `/eve/v1/*` is a cheap extra layer.

### 3.10 UI — `app/` (Next.js + `withEve`)
- `/` lists targets with their latest run. Each row shows the CVE, the target purl, the official status badge, the TOTS label, and the evidence quality bar. The Add CVE form (CVE ID + purl) is flag-gated.
- `/CVE-…/<package>@<version>` (e.g. `/CVE-2024-10491/express@5.2.1`) is the report page; old `/a/<uuid>` links redirect there:
  - claims table
  - technical and discourse evidence side by side
  - Jev scores
  - the policy trace
- Re-run (flag-gated) queues a run and the server action opens the eve session (`eve/client`). The page polls `/api/runs/<id>` for the run's stage and reloads the report when it finishes. The browser holds no long-lived stream, so a reload or closed tab doesn't affect the run.

### 3.11 Evals
- Case 1 checks the label is SUPPORTED and the positive control reproduced.
- Case 2's expectation is filled in after the first real run, once we've looked at the output.
- A "provenance" eval checks that every discourse item has a URL and a quote that actually appears on that page.

---

## 4. Shared schemas — `agent/lib/schemas.ts`
zod v4. The types are `CveRecord`, `Claim`, `TechnicalFinding`, `DiscourseItem`, `JudgeResult`, and `TotsAssessment`. The UI imports the same types.

`TotsAssessment` includes:
- `id`, `cveId`, `target` (purl)
- `officialStatus`
- `claims[]`, each with `verdict`
- `technical[]`, `discourse[]`
- `jev` (raw answers + confidence)
- `label`, `evidenceQuality`, `policyTrace[]`
- `generatedAt`, `models`

## 5. Models
Models are referenced as AI Gateway strings, which use the existing `vercel link` and OIDC token. Gateway needs paid credits; free-tier accounts can't call these models or Jev.

| Role | Model |
|------|-------|
| Root (only dispatches `investigate_cve`) | `openai/gpt-5.6-luna-fast` |
| Claim decomposition | `openai/gpt-5.6-sol` |
| Technical and discourse investigators | `anthropic/claude-sonnet-5.5` (OpenAI's cyber safety filter rejected the PoC work) |
| Judge | `typesafe-ai/jev` |

Locally, `agent/lib/models.ts` uses the ChatGPT subscription from `eve dev` /login unless `TOTS_MODELS=gateway` is set. Jev is Gateway-only, so in that mode the judge asks the ChatGPT model the same typed questions through structured output, and the report records which judge produced the scores.

---

## 6. Build phases

1. **Models and flags.** Switch `agent.ts` to a Gateway string. Set up the `live-runs` flag and Neon (`vercel integration add neon`), then `vercel env pull`. Write the migrations.
2. **Record fetch.** Write `fetch_cve_record` and `schemas.ts`. `GITHUB_TOKEN` is already set in the project env.
3. **Technical subagent and sandbox.** Get the path-to-regexp ReDoS timing PoC running end to end first, since it is the easiest.
4. **Discourse subagent.** Get the express #6222 extraction working with maintainer roles from `author_association`.
5. **Judge and policy.** Add the Jev questions, `policy.ts`, and unit tests for the policy on hand-written Jev outputs.
6. **Orchestrator and persistence.** Write `investigate_cve` and the database access code. Run both seed cases with `pnpm seed`, review the output, then tune the policy.
7. **UI.** Build the list page, report page, flag-gated Add / Re-run, and live streaming.
8. **Evals.** Add the seed-case evals, with case 2's expectation set from step 6, and the provenance eval.
9. **Deploy.** Switch the channel auth to `none()`, add a Firewall rate limit on `/eve/v1/*`, and deploy to the linked `tots` project with `live-runs` off.

Phases 3 and 4 can be built in parallel.

---

## 7. Out of scope
- Ecosystems other than npm, and compiled or native code analysis.
- Reddit, X, or mailing-list scraping. The discourse sources are GitHub, advisories, vulnerability databases, and maintainer blogs.
- User accounts. Access control is the flag.

## 8. Decisions
1. **What is assessed:** CVE + component@version. Case 2 cares only about express@5.2.1. Its expected label is decided after the first run.
2. **Seed cases:** just the two. New cases are added through the flag-gated Add CVE form.
3. **Models:** AI Gateway strings.
4. **Auth:** `none()`, public on Vercel. The `live-runs` flag (checked on the server) controls who can start runs.
5. **GitHub:** a `GITHUB_TOKEN` (fine-grained, read-only, public repos). It's simpler than Vercel Connect with `none()` auth, and it's only used through `agent/lib/github.ts`.
6. **Storage:** Neon Postgres from the Vercel Marketplace, with the full report as jsonb.

## 9. Risks
- **Public endpoint:** with `none()`, anyone can open a chat session. Mitigations: only flag-checked server actions can queue a run, the root agent has no default tools, and a Firewall rate limit.
- **Jev's state limit and its experimental API.** `experimental_evaluate` can change in patch releases. Pin `ai` and wrap the call in `judge.ts`.
- **Sandbox cold start** makes live runs slow (tens of seconds or more). Saved results cover the normal page load.

## 10. Changes during the build
- **Run gating:** the flag is checked in the server action, and the workflow tool only runs `queued` rows. This replaces "the tool checks the flag" and resolves the earlier Toolbar-override question.
- **Live progress:** the run row's `stage` is polled instead of streaming the session with `useEveAgent`. eve does not follow sessions that a workflow tool opens with `ctx.agent`, so `followSubagents` wouldn't have shown investigator progress anyway.
- **Investigator independence is enforced, not just instructed:** the technical investigator's `web_fetch` refuses GitHub issue, discussion, and PR-conversation pages, and its `web_search` is disabled.
- **Models:** the investigators run on Claude, and there is a local ChatGPT mode (see §11).
- **Case 2 result:** DISPUTED, not LIKELY INVALID (see §1).

## 11. Build notes: models and complications

What went wrong on the first runs (2026-10-04), and what changed because of it.

1. **AI Gateway free tier blocked every model.** The first seed run failed with "Free tier users do not have access to this model". The same applied to `openai/gpt-5.6-*`, `openai/gpt-6-*`, `anthropic/claude-*`, and `typesafe-ai/jev`.
   - Fix: $10 of paid credits on the team's AI Gateway, after which all of them worked.
   - Deployed runs need a paid balance. Check it at `https://ai-gateway.vercel.sh/v1/credits` with the OIDC token.
   - Cost so far is about $0.55 for three full investigations plus probes.

2. **ChatGPT subscription as a local fallback.** `chatgpt()` from `eve/models/openai` uses the `eve dev` /login and returns a normal AI SDK model, but it cannot run in a deployment.
   - `agent/lib/models.ts` uses it locally unless `TOTS_MODELS=gateway`. Deployments always use Gateway.
   - Jev is Gateway-only, and the subscription has no evaluation model. In ChatGPT mode, `judge.ts` therefore asks the ChatGPT model the same typed questions in one structured-output call.
   - Such assessments record `judgeModel: "chatgpt/gpt-5.6-sol (Jev unavailable)"`.
   - The seed results in the database used Gateway and Jev.

3. **OpenAI's cyber safety filter refused the technical investigator.** On `openai/gpt-5.6-sol`, both seed runs failed with "This content was flagged for possible cybersecurity risk…". The investigator was writing PoCs for published advisories against library code in an isolated sandbox.
   - OpenAI offers more permissive access ("Daybreak") on application.
   - Instead, both investigators moved to `anthropic/claude-sonnet-5.5`.
   - Root and claim decomposition stay on OpenAI, since they don't touch exploit details.
   - The local ChatGPT mode still uses OpenAI models for the investigators, so expect the same refusals there.

4. **Anthropic's filter stopped one ReDoS run.** On Claude, the express run succeeded, but path-to-regexp failed with `finishReason: content-filter`.
   - The technical instructions now open by stating that this is defensive verification of a published advisory.
   - They also require PoCs to be maintainer-style regression tests: time the generated regex on a long input compared with the fixed version, or print the string the library produces. Nothing may target a network service.
   - The retry succeeded.
   - Expect occasional filtered runs on new CVEs, especially DoS and RCE classes. A failed run is marked `failed` with the reason and can be re-run.

5. **GitHub issue search needs a type qualifier.** `/search/issues` now returns 422 unless the query includes `is:issue` or `is:pull-request`. `github_search` adds `is:issue` when neither is given.

6. **Smaller setup notes.**
   - `vercel integration add neon` installed Neon agent skills into `agent/skills/`, which would load them into the TOTS agent. They were removed.
   - `eve dev` added `just-bash` and `microsandbox` as devDependencies (local sandbox fallbacks; Docker wasn't running).
   - `eve eval` won't start while `pnpm dev` runs. Use `pnpm eval -- --url http://localhost:3000`.
   - `next dev` appends its own agent-rules block to CLAUDE.md.
