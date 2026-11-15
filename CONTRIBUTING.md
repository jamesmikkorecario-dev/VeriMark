# Contributing to VeriMark

Read AGENTS.md and README.md's source matrix. Select a stable story/task from tasks/BACKLOG.md and use docs/ai/TASK-TEMPLATE.md. Initialization is documentation/prototypes only; implementation needs a separate authorized task.

Use an assigned short-lived branch (feat/, fix/, docs/, test/, chore/) and one file owner per task. Preserve setup-inputs and existing work. Scoped local commits are authorized; remote push, main merge and release require explicit authorization.

Review the diff, requirement IDs and links. Record actual checks; engineering scripts are not configured. Future changes must cover tenant/role denial, private storage, immutable issuance and public field restrictions, plus accessible loading/empty/error/success states. Use configured focused tests then the available full gate.

Submit docs/ai/HANDOFF-TEMPLATE.md to the coordinator for independent review. No worker self-approves a release. Human owns final design, scope, production and paid/destructive actions. See docs/delivery/GIT-BRANCHING.md and DEFINITION-OF-DONE.md.
