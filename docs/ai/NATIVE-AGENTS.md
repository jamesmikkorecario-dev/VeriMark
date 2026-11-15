# Native adapter status

Reviewed 2026-11-15: all eleven agents/*.md profiles and both native reviewer examples. Portable roles are not Orca registration files.

.claude/agents/code-reviewer.md and .opencode/agents/code-reviewer.md are **unverified examples**. Discovery, schema compatibility, instruction loading and tool permission enforcement have not been tested in installed harnesses. Prompt-level read-only instructions are not a security sandbox. OpenCode configuration is not omp configuration.

Before activation, the integration owner must consult installed-version primary documentation, validate schema, test discovery and denied writes in a disposable fixture, and record version/commands/results. Starting points, not consulted during this task: https://code.claude.com/docs/en/sub-agents and https://opencode.ai/docs/agents/. No current vendor-format claim is made.

INIT-A read the version-matched orchestration skill via orca skills get orchestration. It did not register or spawn agents. Independent integration review remains pending.
