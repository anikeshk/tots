import type {
  Claim,
  ClaimVerdict,
  CveRecord,
  DiscourseReport,
  JudgeResult,
  Label,
  TechnicalReport,
} from "./schemas";

// Deterministic mapping from Jev's answers to a tots label. No model decides the label;
// every rule that fires (or is skipped) is recorded in the trace so a reviewer can follow it.

const fmt = (n: number) => n.toFixed(2);

export interface PolicyOutput {
  label: Label;
  trace: string[];
  claimVerdicts: Record<string, ClaimVerdict>;
  evidenceQuality: { check: string; ok: boolean | null }[];
}

export function claimVerdict(
  scores: { technicallySupported: number; crediblyDisputed: number },
  finding: TechnicalReport["findings"][number] | undefined,
): ClaimVerdict {
  const { technicallySupported: s, crediblyDisputed: d } = scores;
  if (s >= 0.7 && d < 0.6) return "supported";
  if (s <= 0.3 && finding?.status === "contradicted") return "contradicted";
  if (d >= 0.5) return "disputed";
  return "unverified";
}

export function applyPolicy(
  judge: JudgeResult,
  claims: Claim[],
  technical: TechnicalReport,
  discourse: DiscourseReport,
  record: CveRecord,
): PolicyOutput {
  const g = judge.global;
  const get = (key: string) => g[key] ?? 0;
  const sufficient = get("evidence_sufficient");
  const bug = get("bug_exists");
  const target = get("target_affected");
  const onTarget = get("reproduced_on_target");
  const control = get("positive_control_reproduced");
  const dispute = get("credible_dispute_exists");
  const impact = get("impact_matches_description");
  const authority = judge.authorityOfDispute;

  const claimVerdicts: Record<string, ClaimVerdict> = {};
  for (const claim of claims) {
    claimVerdicts[claim.id] = claimVerdict(
      judge.claims[claim.id] ?? { technicallySupported: 0, crediblyDisputed: 0 },
      technical.findings.find((f) => f.claimId === claim.id),
    );
  }
  const maxClaimDispute = Math.max(0, ...Object.values(judge.claims).map((c) => c.crediblyDisputed));

  const trace: string[] = [];
  const decide = (label: Label, reason: string): PolicyOutput => {
    trace.push(`→ ${label}: ${reason}`);
    return { label, trace, claimVerdicts, evidenceQuality: evidenceQuality(technical, discourse, record) };
  };

  // Technical evidence "settles" the question when the PoC is conclusive either way.
  const technicallyConfirmed = onTarget >= 0.8;
  const technicallyRefuted = control >= 0.7 && onTarget < 0.3;
  const settled = technicallyConfirmed || technicallyRefuted;

  if (sufficient < 0.5) return decide("INSUFFICIENT EVIDENCE", `evidence_sufficient ${fmt(sufficient)} < 0.50`);
  trace.push(`evidence_sufficient ${fmt(sufficient)} ≥ 0.50`);

  if (dispute >= 0.6 && !settled && target >= 0.3 && target < 0.75) {
    return decide(
      "DISPUTED",
      `credible_dispute_exists ${fmt(dispute)} ≥ 0.60, target_affected ${fmt(target)} is between 0.30 and 0.75, and the PoC did not settle it`,
    );
  }

  if (target < 0.3 && (technicallyRefuted || authority >= 2.5)) {
    const why = technicallyRefuted
      ? `positive control reproduced (${fmt(control)}) but target did not (${fmt(onTarget)})`
      : `a maintainer-level source disputes it (authority ${fmt(authority)} ≥ 2.50)`;
    return decide("LIKELY INVALID", `target_affected ${fmt(target)} < 0.30 and ${why}`);
  }

  if (bug >= 0.75 && target >= 0.75 && impact < 0.4) {
    return decide(
      "LIKELY OVERSTATED",
      `bug_exists ${fmt(bug)} and target_affected ${fmt(target)} ≥ 0.75 but impact_matches_description ${fmt(impact)} < 0.40`,
    );
  }

  if (target >= 0.9 && technicallyConfirmed && maxClaimDispute < 0.5) {
    return decide(
      "SUPPORTED",
      `target_affected ${fmt(target)} ≥ 0.90, reproduced_on_target ${fmt(onTarget)} ≥ 0.80, no claim disputed ≥ 0.50`,
    );
  }

  if (target >= 0.75 && dispute < 0.6) {
    return decide(
      "LIKELY SUPPORTED",
      `target_affected ${fmt(target)} ≥ 0.75 without reproduction on target or with minor disputes (credible_dispute_exists ${fmt(dispute)})`,
    );
  }

  if (target < 0.3) {
    return decide("LIKELY INVALID", `target_affected ${fmt(target)} < 0.30`);
  }

  if (dispute >= 0.6) {
    return decide("DISPUTED", `credible_dispute_exists ${fmt(dispute)} ≥ 0.60 and no stronger rule applied`);
  }

  return decide(
    "INSUFFICIENT EVIDENCE",
    `no rule matched (target_affected ${fmt(target)}, credible_dispute_exists ${fmt(dispute)})`,
  );
}

export function evidenceQuality(technical: TechnicalReport, discourse: DiscourseReport, record: CveRecord) {
  const tested = (role: string) => technical.versionsTested.filter((v) => v.role === role);
  const rangeVotes = record.ranges.map((r) => r.affectsTarget).filter((v) => v !== null);
  return [
    { check: "Fix commit or release identified", ok: technical.fixReference !== null },
    { check: "Vulnerable code path identified", ok: technical.vulnerableCode !== null },
    {
      check: "Positive control reproduced",
      ok: tested("positive_control").length === 0 ? null : tested("positive_control").some((v) => v.reproduced === true),
    },
    { check: "Target version tested", ok: tested("target").some((v) => v.reproduced !== null) },
    {
      check: "Maintainer or vendor statement found",
      ok: discourse.items.some((i) => i.role === "maintainer" || i.role === "cna"),
    },
    {
      check: "Sources agree on whether the target is in range",
      ok: rangeVotes.length === 0 ? null : rangeVotes.every((v) => v === rangeVotes[0]),
    },
  ];
}
