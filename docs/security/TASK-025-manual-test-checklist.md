# TASK-025 manual verification checklist

Use only an isolated local or approved Development environment and entirely
fictional supplier records. Do not inspect local environment files or use a
service-role credential.

1. Sign in as an active `tenant_admin` with an authorized tenant membership.
2. Open a fictional supplier with a completed deterministic evaluation.
3. Confirm the engine recommendation is labelled separately from the final
   Company decision.
4. Choose `approve`, `review`, or `reject`, optionally enter a concise fictional
   rationale, and record the decision.
5. Confirm the persisted result shows the selected decision and UTC timestamp.
6. Reload the page and confirm the same immutable decision remains visible and
   the form is absent.
7. Confirm a decision may differ from the recommendation without an error claim.
8. Repeat with `risk_analyst`, `operator`, and `auditor`; confirm each sees a
   truthful read-only state and no decision form.
9. Confirm a platform administrator is redirected out of the operational
   supplier workspace.
10. Confirm pending and failed evaluations never show the decision form.
11. Confirm keyboard focus reaches every radio option, rationale, and submit
    control, and that action errors are announced.

Record the tested URL, fictional record reference, role, viewport, timestamp,
and pass/fail result. Never copy cookies, tokens, registration identifiers, or
evidence declarations into the verification record.
