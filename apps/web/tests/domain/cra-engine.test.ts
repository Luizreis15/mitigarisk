import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CraEvaluationError, evaluateCra } from "../../lib/domain/cra-engine.ts";
import type { CraResult, CraTemplate } from "../../lib/domain/cra-engine.ts";

interface CasebookCase {
  id: string;
  title: string;
  facts: Record<string, unknown>;
  expected: CraResult;
}

const readFixture = (name: string): string =>
  readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");
const template = JSON.parse(readFixture("cra-template-v1-draft.json")) as CraTemplate;
const casebook = JSON.parse(readFixture("cra-casebook-v1.json")) as CasebookCase[];

const baseFacts = (): Record<string, unknown> => structuredClone(casebook.find((c) => c.id === "CB-01")!.facts);

void test("the casebook has 24 cases with unique ids", () => {
  assert.equal(casebook.length, 24);
  assert.equal(new Set(casebook.map((c) => c.id)).size, 24);
});

for (const item of casebook) {
  void test(`casebook ${item.id} matches exactly: ${item.title}`, () => {
    assert.deepStrictEqual(evaluateCra(template, item.facts), item.expected);
  });
}

void test("Template v1 weights are consistent: categories and every category's factors sum to 100", () => {
  assert.equal(template.categories.reduce((sum, c) => sum + c.weight, 0), 100);
  for (const category of template.categories) {
    assert.equal(category.factors.reduce((sum, f) => sum + f.weight, 0), 100, category.key);
  }
});

void test("a null fact counts as absent, exactly like a missing key", () => {
  const withNull = evaluateCra(template, { ...baseFacts(), purpose: null });
  const withoutKey = evaluateCra(template, (({ purpose: _purpose, ...rest }) => rest)(baseFacts()));
  assert.deepStrictEqual(withNull, withoutKey);
  assert.deepStrictEqual(withNull.missing_factors, ["purpose"]);
  assert.ok(!withNull.reason_codes.includes("INVALID_VALUE_PURPOSE"));
});

void test("a non-string or unmapped value is missing and invalid", () => {
  for (const bad of [5, true, "nonsense", ["ecommerce"]]) {
    const result = evaluateCra(template, { ...baseFacts(), purpose: bad });
    assert.deepStrictEqual(result.missing_factors, ["purpose"]);
    assert.ok(result.reason_codes.includes("DATA_MISSING_PURPOSE"));
    assert.ok(result.reason_codes.includes("INVALID_VALUE_PURPOSE"));
  }
});

void test("an array fact never hits an override (exact scalar match only)", () => {
  const result = evaluateCra(template, { ...baseFacts(), sanctions_match: ["confirmed"] });
  assert.deepStrictEqual(result.overrides_hit, []);
});

void test("unknown extra facts are ignored and inputs are never mutated", () => {
  const facts = Object.freeze({ ...baseFacts(), unrelated_fact: "x" });
  const result = evaluateCra(template, facts);
  assert.deepStrictEqual(result, casebook.find((c) => c.id === "CB-01")!.expected);
  assert.equal(Object.keys(facts).includes("purpose"), true);
});

void test("required actions are de-duplicated across overrides (Amendment 1)", () => {
  const result = evaluateCra(template, {
    ...baseFacts(),
    adverse_media_material: "material",
    blacklisted_country_link: true,
  });
  assert.equal(result.required_actions.filter((a) => a === "REPORT_TO_MLRO").length, 1);
  assert.deepStrictEqual(result.overrides_hit, ["OVR_BLACKLISTED_COUNTRY", "OVR_ADVERSE_MEDIA_MATERIAL"]);
});

void test("evaluation is deterministic", () => {
  const facts = baseFacts();
  assert.deepStrictEqual(evaluateCra(template, facts), evaluateCra(template, facts));
});

void test("it fails closed when an override needs a HIGH band the template lacks", () => {
  const noHigh: CraTemplate = { ...template, bands: template.bands.filter((b) => b.band !== "HIGH") };
  assert.throws(
    () => evaluateCra(noHigh, { ...baseFacts(), hnwi: true }),
    (error: unknown) => error instanceof CraEvaluationError,
  );
});

// Drift guards: the SQL suite and the dev seed embed these fixtures verbatim,
// so the database evaluator and this mirror are always judged on the same bytes.
void test("supabase/tests/090-cra-engine-v2.sql embeds the casebook byte-for-byte", () => {
  const sql = readFileSync(new URL("../../../../supabase/tests/090-cra-engine-v2.sql", import.meta.url), "utf8");
  assert.ok(sql.includes(readFixture("cra-casebook-v1.json").trimEnd()));
});

void test("supabase/seed.sql embeds Template v1 byte-for-byte", () => {
  const seed = readFileSync(new URL("../../../../supabase/seed.sql", import.meta.url), "utf8");
  assert.ok(seed.includes(readFixture("cra-template-v1-draft.json").trimEnd()));
});
