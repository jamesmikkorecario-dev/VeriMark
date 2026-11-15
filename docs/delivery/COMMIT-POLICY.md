# VeriMark commit-message policy

Applies to every commit by the owner, the orchestrator and all delegated workers, on every branch.

- No AI co-author trailers (`Co-Authored-By: Claude/Codex/...`), no AI promotional footers ("Generated with ..."), no AI session markers or links.
- Commit with the existing repository Git identity (`git config user.name` / `user.email`). Never change the identity or pass `--author`.
- Human `Co-authored-by` trailers are legitimate and must be kept.
- Use conventional subjects (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Before committing, check the message. After committing, inspect it: `git log -1 --format=%B`.
- Never rewrite published history to remove attribution without explicit owner approval.

## Enforcement

`tools/hooks/commit-msg` rejects offending messages. It is installed once per clone, and then covers every worktree:

```sh
cp tools/hooks/commit-msg "$(git rev-parse --git-common-dir)/hooks/commit-msg"
```

Do not overwrite a different existing `commit-msg` hook; merge the checks instead. Never bypass with `--no-verify`.
The tracked `.claude/settings.json` disables Claude Code attribution for this repository. User-level settings (`~/.claude/settings.json`, `~/.codex/config.toml`) were inspected on 2026-11-16 and contain no attribution setting; they were left unchanged, so the hook is the control that counts.

Range check used by the orchestrator before integrating a worker branch:

```sh
git log <base>..<branch> --format=%B | grep -Ei "co-authored-by|generated with|anthropic|openai"   # must print nothing
```

## History cleanup record (2026-11-16)

Unpublished `feat/full-stack-implementation` (only `main` exists on origin) was rewritten to drop three `Co-Authored-By: Claude Opus 5.5` trailers. Trees are identical before and after (`9308c5f13ac6e51c4a36ac7e57e36a9488393d51`). Author, dates and subjects are unchanged.

| Original | Rewritten | Subject |
| --- | --- | --- |
| ed673cf5b0c580c017d14a2616cb5f4556294fef | cae55247d4bb7ab21770c4f2efecfb7bfa7863e2 | docs(M1-SCROLL): record final scroll refinement verification and evidence |
| 64bbb9ce2c7cd5600c0c9e98adf84d537774c7a9 | d0e390af5ef5b7cbdf8228edc2533da4289e29b6 | test(e2e): guard mobile horizontal overflow and sticky header stability |
| e294e819ffb3db52f83ccc4b457fd31b6f666934 | cd9ba4957d7063e6463b9398a55291f9be9e419e | docs(M1-MOBILE): record mobile overflow and sticky header diagnosis |
| c5ef90edc29950190742db63dbb96141ba52d97c | c45bf281ac8f9155f4d0fb77272f04ef62e9b5b7 | docs(M1-MOBILE): record coordinator verification of mobile overflow diagnosis |

Backups of the original head `c5ef90e`: branch `backup/m1-pre-attribution-cleanup-20261116` and `refs/original/refs/heads/feat/full-stack-implementation`. The historical worker branch `jamesmikkorecario-dev/m1-mobile-fix` (`e294e81`) still carries the original trailers and was deliberately not moved. Do not push it.
