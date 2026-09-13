import { test } from "node:test";
import assert from "node:assert/strict";
import { isEvaluationImmutable } from "../../lib/domain/evaluation.ts";

void test("isEvaluationImmutable is true only for terminal statuses", () => {
  assert.equal(isEvaluationImmutable({ status: "pending" }), false);
  assert.equal(isEvaluationImmutable({ status: "completed" }), true);
  assert.equal(isEvaluationImmutable({ status: "failed" }), true);
});
