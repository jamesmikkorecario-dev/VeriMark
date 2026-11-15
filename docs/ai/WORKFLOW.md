# VeriMark portable AI workflow

Discovery ? specified ? design proposed ? human design approval ? implementation authorized ? verified ? independently reviewed ? human merge/release approval ? observed. Each transition requires evidence. Initialization does not authorize application implementation or finalize tokens.

Coordinator assigns task ID, role, branch/worktree, exact paths, input docs, dependency versions, acceptance and forbidden actions. One writer per file; synchronize shared API/schema contracts before dependent work. agents/*.md are portable role prompts; see NATIVE-AGENTS.md before adapters. Do not imply agents ran from reading profiles.

Product supplies stable stories to architect/designer. Architect coordinates database/backend contracts. Frontend waits for design and contracts. QA tests an identified commit. Independent reviewers inspect diff and evidence. Coordinator integrates sequentially. Blocked dependencies pause dependent work, not independent read-only checks.

| Action | Authority |
| --- | --- |
| Scoped local documentation/prototypes/commits | authorized initialization task |
| Application code/packages | separately authorized implementation task |
| Tests | non-destructive assigned local checks; exact results required |
| Review | independent read-only context unless reassigned |
| Scope/major contracts/final design | recorded human decision |
| Remote push/merge/cloud/paid/destructive/production actions | explicit human authorization for action/target |

Never silently widen public fields, weaken RLS or expose assets. Public verification returns a projection, not table access. Recipient access tokens and public IDs have different privacy purposes; define lifetime/recovery before implementation.

Close with HANDOFF-TEMPLATE.md: actual evidence, deviations, open decisions and reviewer status. Coordinator arranges review; no unassigned helpers. Orca workers read installed orchestration skill, ask coordinator for blockers and send worker_done once. These files do not register Orca agents.
