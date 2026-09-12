# Contributing to MITIGA

## Branches

- `main` is always deployable and protected after repository publication.
- Use `feat/<area>-<summary>`, `fix/<area>-<summary>`, `chore/<area>-<summary>`, or `docs/<summary>`.
- A branch has one owner, one bounded outcome, and a short lifetime.

## Commits

Use Conventional Commits in English, for example:

- `feat(risk): add policy version evaluation`
- `fix(auth): enforce tenant membership on case query`
- `docs(adr): record webhook retry policy`

Do not include agent names in commit subjects. Authorship and review are recorded in the pull request handoff.

## Pull requests

Every pull request must include objective, acceptance criteria, affected contexts, security and rollback impact, verification results, visible-change screenshots, limitations, and follow-up work.

Use squash merge. Codex performs the final integration review; a human approves changes involving production data, authentication, billing, legal rules, destructive migrations, or external communication.

## Definition of done

A change is done only when it is scoped, reviewed, tested, documented where necessary, free of committed secrets, and safely reversible or accompanied by a rollback plan.

Before handoff, run the repository gates that apply:

```text
./scripts/check-secrets.sh
./scripts/verify-web.sh
```
