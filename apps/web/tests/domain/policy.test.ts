import { test } from "node:test";
import assert from "node:assert/strict";
import { isEditablePolicyVersion, resolveDecisionBand } from "../../lib/domain/policy.ts";

void test("isEditablePolicyVersion allows only draft", () => {
  assert.equal(isEditablePolicyVersion({ status: "draft" }), true);
  assert.equal(isEditablePolicyVersion({ status: "published" }), false);
  assert.equal(isEditablePolicyVersion({ status: "archived" }), false);
});

void test("resolveDecisionBand picks the matching threshold band", () => {
  const thresholds = [
    { minScore: 0, maxScore: 30, decisionBand: "approve" as const },
    { minScore: 31, maxScore: 70, decisionBand: "review" as const },
    { minScore: 71, maxScore: 100, decisionBand: "reject" as const },
  ];

  assert.equal(resolveDecisionBand(0, thresholds), "approve");
  assert.equal(resolveDecisionBand(30, thresholds), "approve");
  assert.equal(resolveDecisionBand(31, thresholds), "review");
  assert.equal(resolveDecisionBand(100, thresholds), "reject");
});

void test("resolveDecisionBand returns null when no threshold covers the score", () => {
  const thresholds = [{ minScore: 0, maxScore: 30, decisionBand: "approve" as const }];
  assert.equal(resolveDecisionBand(31, thresholds), null);
});
