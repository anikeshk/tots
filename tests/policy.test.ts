import assert from "node:assert/strict";
import { test } from "node:test";
import { applyPolicy, claimVerdict } from "../agent/lib/policy";
import type { Claim, CveRecord, DiscourseReport, JudgeResult, TechnicalReport } from "../agent/lib/schemas";

const claims: Claim[] = [
  { id: "c1", kind: "impact", text: "ReDoS", assertedBy: ["NVD"] },
  { id: "target", kind: "target", text: "pkg@1.0.0 is affected", assertedBy: ["scan"] },
];

const technical: TechnicalReport = {
  fixReference: "https://github.com/o/r/commit/abc",
  vulnerableCode: "index.js:compile",
  poc: { description: "time a crafted path", script: "..." },
  versionsTested: [
    { version: "1.0.0", role: "target", reproduced: true, observation: "900ms" },
    { version: "0.9.0", role: "positive_control", reproduced: true, observation: "880ms" },
    { version: "1.1.0", role: "fixed", reproduced: false, observation: "1ms" },
  ],
  findings: [{ claimId: "target", status: "supported", evidence: "slow on target" }],
  notes: "",
};

const discourse: DiscourseReport = { items: [], unresolved: [], summary: "" };

const record: CveRecord = {
  cveId: "CVE-2024-0001",
  target: { purl: "pkg:npm/pkg@1.0.0", ecosystem: "npm", name: "pkg", version: "1.0.0" },
  official: { state: "PUBLISHED", nvdStatus: "Analyzed" },
  description: "",
  cwes: [],
  cvss: null,
  ghsaIds: [],
  ranges: [],
  osvTargetVulns: [],
  references: [],
};

function judge(global: Partial<Record<string, number>>, opts: Partial<JudgeResult> = {}): JudgeResult {
  return {
    global: {
      bug_exists: 0.95,
      target_affected: 0.95,
      reproduced_on_target: 0.95,
      positive_control_reproduced: 0.95,
      patch_addresses_claim: 0.9,
      impact_matches_description: 0.9,
      credible_dispute_exists: 0.05,
      evidence_sufficient: 0.95,
      ...global,
    } as Record<string, number>,
    claims: {
      c1: { technicallySupported: 0.9, crediblyDisputed: 0.05 },
      target: { technicallySupported: 0.9, crediblyDisputed: 0.05 },
    },
    authorityOfDispute: 0,
    judgeModel: "test",
    ...opts,
  };
}

const label = (j: JudgeResult) => applyPolicy(j, claims, technical, discourse, record).label;

test("reproduced on target with no dispute is SUPPORTED", () => {
  assert.equal(label(judge({})), "SUPPORTED");
});

test("insufficient evidence is checked first", () => {
  assert.equal(label(judge({ evidence_sufficient: 0.2, credible_dispute_exists: 0.9 })), "INSUFFICIENT EVIDENCE");
});

test("positive control reproduced but target not is LIKELY INVALID", () => {
  assert.equal(
    label(judge({ target_affected: 0.1, reproduced_on_target: 0.05, positive_control_reproduced: 0.9 })),
    "LIKELY INVALID",
  );
});

test("maintainer dispute with target unlikely affected is LIKELY INVALID even without a PoC", () => {
  assert.equal(
    label(
      judge(
        { target_affected: 0.2, reproduced_on_target: 0.1, positive_control_reproduced: 0.2, credible_dispute_exists: 0.9 },
        { authorityOfDispute: 2.9 },
      ),
    ),
    "LIKELY INVALID",
  );
});

test("credible dispute the PoC did not settle is DISPUTED", () => {
  assert.equal(
    label(
      judge({ target_affected: 0.5, reproduced_on_target: 0.5, positive_control_reproduced: 0.5, credible_dispute_exists: 0.8 }),
    ),
    "DISPUTED",
  );
});

test("real bug with overstated impact is LIKELY OVERSTATED", () => {
  assert.equal(label(judge({ impact_matches_description: 0.2 })), "LIKELY OVERSTATED");
});

test("affected but not reproduced is LIKELY SUPPORTED", () => {
  assert.equal(label(judge({ target_affected: 0.8, reproduced_on_target: 0.3 })), "LIKELY SUPPORTED");
});

test("every decision ends the trace with the chosen label", () => {
  const out = applyPolicy(judge({}), claims, technical, discourse, record);
  assert.match(out.trace.at(-1)!, /^→ SUPPORTED:/);
});

test("claim verdicts", () => {
  assert.equal(claimVerdict({ technicallySupported: 0.9, crediblyDisputed: 0.1 }, undefined), "supported");
  assert.equal(
    claimVerdict({ technicallySupported: 0.1, crediblyDisputed: 0.6 }, { claimId: "t", status: "contradicted", evidence: "" }),
    "contradicted",
  );
  assert.equal(claimVerdict({ technicallySupported: 0.5, crediblyDisputed: 0.7 }, undefined), "disputed");
  assert.equal(claimVerdict({ technicallySupported: 0.5, crediblyDisputed: 0.1 }, undefined), "unverified");
});
