# Task contracts

A contract records what a task was meant to deliver. It is not evidence that the capability exists: for that, read [`../STATUS.md`](../STATUS.md).

## What a `Status:` line means here

Every contract carries a `Status:` line. The lines added on 24 Nov 2026 (TASK-001 to TASK-025) use only evidence already in this repository:

- **Merged** cites the merge commit on `main` whose history contains the contract's last handoff commit. It means the branch reached `main`. It does not mean the result is product functionality: several of these tasks delivered screens that are now prototypes behind `ENABLE_PROTOTYPE_ROUTES`.
- **Approved** (TASK-026, TASK-028 to TASK-030, TASK-032 to TASK-035) was written when the contract was approved and was left unchanged. It records approval of the contract, not delivery. Their delivery is visible in the merge history: pull requests #1, #3, #4, #5, #7, #8, #9 and #10.
- **Unknown — not reconstructed** would be used where no evidence exists. No contract needed it.

## Gaps and irregularities in the numbering

| Item | What the repository shows |
|---|---|
| TASK-027 | No file, and no commit message, branch name or document on any local branch mentions it. Whether it was cancelled or renumbered cannot be established from git history. |
| TASK-031 | Same as TASK-027. |
| TASK-005 | Two files share the number: `TASK-005-cursor-authenticated-product-shell.md` (the contract, added in `21e123d`) and `TASK-005-cursor-authenticated-shell.md` (added with the handoff in `17c4ed1`). Both titles are identical. Neither was renamed. |
| TASK-036 | Committed on 24 Nov 2026 from the copy on the human owner's machine, which matches the Google Drive copy in size (6,978 bytes) and timestamp (16 Oct 2026). Unchanged except for its `Status:` line. It is not implemented. Its "Inputs" section lists files under `docs/produto/cra/` and `docs/insumos-lucimara/` that are not in this repository. |
| TASK-037 and later | TASK-037 (the documentation alignment that added this file) has no contract file here. TASK-036 refers to TASK-039 and TASK-040; neither has a file here. |

## Files in this folder that are not contracts

`PLAN-FRONTEND-10-DIAS-APRESENTACAO-LUCIMARA.md` and `WALKTHROUGH-LUCIMARA-26-OUT-2026.md` are a plan and a demo script. They carry no `Status:` line.
