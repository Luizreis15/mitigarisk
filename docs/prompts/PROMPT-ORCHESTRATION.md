# Prompt system for Codex, Cursor, and Claude Code

These prompts are task templates. Replace bracketed fields with repository facts. Never include secrets, raw customer data, or hidden credentials.

## 1. Codex — architect and task designer

```text
Act as MITIGA's technical orchestrator and merge owner. Read AGENTS.md, the accepted ADRs, PLATFORM-ARCHITECTURE.md, and MULTI-AGENT-DEVELOPMENT.md.

Convert [business outcome] into the smallest independently reviewable task contracts. For each task define scope, non-scope, bounded contexts, allowed files, dependencies, acceptance criteria, tenant/security/audit requirements, required tests, reviewer profile, and merge order.

Identify decisions that require human approval. Do not include credentials. Prefer the modular monolith and existing contracts. Output the dependency graph, task contracts, and integration risks.
```

## 2. Cursor — implementation owner

```text
Implement the attached MITIGA task contract on branch [branch]. Read the repository rules before editing. Stay within the allowed files and scope.

Preserve pt-BR product copy, MITIGA design tokens, accessibility, strict TypeScript, server-side authorization, tenant isolation, and auditability. Use existing components and contracts. Do not invent provider credentials or alter architecture.

Run every required check. Finish with the exact agent handoff template from MULTI-AGENT-DEVELOPMENT.md, including screenshots for visible UI work and all known limitations.

[TASK CONTRACT]
```

## 3. Claude Code — independent reviewer or backend owner

```text
Review or implement the attached MITIGA task contract as [reviewer/backend owner]. Read CLAUDE.md and the accepted architecture first.

Prioritize correctness, tenant-bound authorization, RLS, immutable evidence, idempotency, privacy, failure behavior, migration safety, and test quality. Treat the author handoff as a claim to verify, not proof. Do not modify unrelated files.

If reviewing, report findings by severity with file and line evidence, then list verified acceptance criteria and residual risks. If implementing, return the standard agent handoff.

[TASK CONTRACT OR DIFF]
```

## 4. Codex — merge owner

```text
Act as MITIGA's merge owner for [pull request/branch]. Compare the task contract, diff, test evidence, architecture, ADRs, and reviewer findings.

Reject scope drift, hidden coupling, untested tenant boundaries, missing audit evidence, unsafe migrations, committed secrets, and UI regressions. Resolve conflicts according to MULTI-AGENT-DEVELOPMENT.md. Do not weaken a contract merely to make the merge pass.

Return one decision: READY TO SQUASH, CHANGES REQUIRED, or HUMAN APPROVAL REQUIRED. Include verified gates, blocking findings, exact remediation, merge order, squash message, and post-merge checks.
```

## 5. Supabase slice prompt

```text
Design and implement [slice] using Supabase without exposing privileged credentials. Include schema, RLS, grants, indexes, migration, typed access boundary, positive and negative tenant tests, audit events, and rollback/remediation notes. Browser code may use only public configuration. Service-role use must be server-only and justified.
```

## 6. Resend slice prompt

```text
Implement [email flow] through a server-only notification boundary. Persist the internal request before sending, map the provider message ID, verify webhook signatures, process events idempotently, model delivery/bounce/complaint states, redact logs, and test retry and failure behavior. Do not send a real external email without explicit human approval.
```
