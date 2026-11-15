# Worktree registry

Rules (owner policy, 2026-11-16): record every worktree the orchestrator creates. Remove a worktree only when it was created by the current run, is listed here as disposable, its task is finished, its commits are integrated, it has no uncommitted, untracked or ignored files that matter, and nothing is running in it. Remove by exact path with `git worktree remove <path>` (never `--force`, never by pattern). When unsure, leave it.

Repository ID (Orca): `57c04b55-8f63-4efa-b7cc-718ff107fbdc`.

## Pre-existing (never remove)

| Path | Branch | Note |
| --- | --- | --- |
| C:/Users/James/orca/projects/VeriMark | main | Protected primary checkout |
| C:/Users/James/orca/workspaces/VeriMark/full-stack-implementation | feat/full-stack-implementation | M1 implementation |

## Unresolved incident: `init-quality-delivery`

`C:/Users/James/orca/workspaces/VeriMark/init-quality-delivery` (branch `jamesmikkorecario-dev/init-quality-delivery`, `83f57c4`) was present after the pilot run and absent after the M1 mobile run on 2026-11-16. The orchestrator's removal commands named only `pilot-claude`, `pilot-codex` and `m1-mobile-fix` by exact path through `orca worktree rm`; the third used `--force`. The cause is not established. The branch is intact at `83f57c4`; uncommitted files in that directory, if any, are lost. It has not been recreated. Because of this, `orca worktree rm` is no longer used by the orchestrator.

## Created by the full-stack run

| Path | Branch | Owner | Run | Created | Initial HEAD | Integration | Cleanup |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C:/Users/James/orca/workspaces/VeriMark/full-stack-integration | dev/full-stack-integration | orchestrator | – | 2026-11-16 | c45bf28 | integration branch | keep (permanent) |
