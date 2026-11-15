# VeriMark Git and ownership

Use short-lived isolated branches and PRs to protected main; no standing dev branch needed. Main protection is required, not verified host configuration. No remote push, merge or deployment is authorized by this document.

Initialization coordinator owns init/verimark-initialization; four isolated child workers own product/workflow, architecture/security, design, and quality/delivery. INIT-D owns delivery/operations, test strategy/performance, .github, templates, .env.example and its handoff; security threat model belongs to architecture/security. Coordinator reviews and sequentially cherry-picks local commits; reconcile shared contracts before integration. Never reset/clean/rebase/delete another worker's worktree.

Future branches: feat/<task>-<slug>, fix/<task>-<slug>, docs/<task>-<slug>. Record task, goal, acceptance, ownership, risks and checks before edits. Use small conventional commits. Task-scoped local commits are authorized during initialization; remote/main operations need explicit approval.

PRs identify behavior, tenant/privacy/schema impacts, exact verification and rollback compatibility. Independent review is required, especially auth/file/release changes. Coordinator supplies INIT-D review; no own helper workers. Commit synthetic fixtures only, never recipient CSVs or secrets.
