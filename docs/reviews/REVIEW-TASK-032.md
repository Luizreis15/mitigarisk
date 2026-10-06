# Independent review — TASK-032 (27 Sep 2026)

Reviewer: Claude (Cowork, orchestrator) · Author: Claude Code · Object: `feat/cra-engine-v2` @ `1cd2c54`

## Verdict: APPROVED for integration

I reproduced the result on a `git archive` snapshot of `1cd2c54` with a disposable Postgres 16.

- SQL harness: exit 0.

  | Suite | 010 | 020 | 030 | 040 | 050 | 060 | 070 | 080 | 090 | Total |
  |---|---|---|---|---|---|---|---|---|---|---|
  | Assertions | 16 | 21 | 18 | 43 | 26 | 28 | 40 | 26 | 120 | **338** |

- `npm test`: 258/258 passed. `tsc`: 0 errors.
- **Differential fuzz (independent of the author).** I generated 3,000 random fact documents with my own generator: valid values, absent facts, JSON `null`, and invalid strings, across all factors and override facts. Each one ran through `app.evaluate_cra` on the seeded demo policy and through the reference engine. **0 divergences**, comparing the whole result object.

Security probes:

| Probe | Result |
|---|---|
| `authenticated` executes `app.evaluate_cra` | Denied (42501) |
| `authenticated` inserts CRA child rows | Denied (42501) |
| Tenant admin publishes an empty `cra_v2` draft | Denied (22023, validation) |
| Flip `engine_kind` on a published `weighted_v1` | Denied (23001, immutability) |
| Supplier flow | Suites 040–080 unchanged; regression test present |

I accept all of the author's own decisions: `min_score`/`max_score`, extended immutability, the extra publish validations, the demo tenant without members, and the evaluator not requiring a published policy.

## Finding for the next task (does not block 032)

**MEDIUM — override inputs fail open when their type or case is wrong.** `{"hnwi":"true","pep_status":"Confirmed","sanctions_match":1}` produces **no override** (band MEDIUM). The evaluator compares values strictly, which is correct for a pure function. But if an integration sends a value with a different type or casing, a PEP or sanctions hit is silently ignored. **TASK-033 must validate facts strictly at intake, fail closed:**
- every override fact is mandatory, including an explicit `"none"`;
- only enumerated values are accepted, with the exact type;
- unknown keys are rejected;
- any violation returns 22023 and the assessment is not stored.
