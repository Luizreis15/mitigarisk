# ADR 0001 — Modular monolith and trunk-based delivery

- Status: accepted
- Date: 2026-09-12

## Context

MITIGA is early-stage, has substantial compliance and tenant-isolation requirements, and will be built collaboratively by humans and multiple coding agents. Product boundaries will change faster than independent service contracts can safely stabilize.

## Decision

Build the MVP as an API-first modular monolith. Use one permanent `main` branch, short-lived task branches, pull-request previews, independent review for high-risk changes, and squash merges controlled by the merge owner.

## Consequences

The team gains faster cross-domain change, simpler observability, and lower operational cost. Domain boundaries, database ownership, and internal contracts must still be explicit. A future service extraction requires evidence and a new ADR. Long-lived agent branches and direct main changes are prohibited after bootstrap because they increase merge ambiguity.
