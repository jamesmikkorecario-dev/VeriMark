# AI Development Workflow

## State machine

`IDEA → DISCOVERY → SPECIFIED → DESIGNED → IMPLEMENTING → VERIFIED → REVIEWED → APPROVED → RELEASED → OBSERVED`

A state advances only with evidence, not the AI saying 'done'. It is okay to revisit earlier states when requirements change.

## Phases and owners

| Stage | Lead | Specialist | Output | Gate |
| --- | --- | --- | --- | --- |
| Discover | human | product | PRD, stories, scope | human accepts goal |
| Design | architect | UI/UX, database, security | ADR, diagrams, tokens, threat model | design approved |
| Plan slice | orchestrator | frontend/backend/QA | task packet, branches, tests | scope agreed |
| Implement | relevant engineer | bounded parallel specialist | code/tests/doc diffs | local checks |
| Verify | QA | security reviewer | actual test evidence | acceptance pass |
| Review | independent reviewer | lead | findings + resolved changes | PR checks/review |
| Release | human owner | DevOps | deployment record | explicit production approval |
| Operate | human/ops | product + QA | alerts, incidents, insights | feedback → next story |

## Delegation rules

- One agent owns each editable file at a time; parallel only when files/interfaces are clearly split.
- Assign **task ID + branch + file paths + required docs + acceptance tests + forbidden changes**.
- The orchestrator reviews handoffs, never assumes a subagent's self-reported tests are true without evidence.
- If shared API contracts or schema changes, stop dependent tasks and synchronize before implementing both sides.
- Read-only review should be a separate context where possible.
- If the harness lacks native subagents, switch roles sequentially by reading the role prompt in `agents/`.

## Approval matrix

Agent may independently: inspect, propose plan, edit task-scoped local code, run non-destructive local checks (subject to your tool permissions). Human must approve: changing scope/contracts with broad impact, destructive migrations, prod credentials or data, paid resource creation, pushing/merging protected branch, production deploy or rollback.

## Efficient context

Use a short root contract + focused linked docs, rather than loading 30 long docs into every prompt. Close each task with `HANDOFF-TEMPLATE.md`. Split vertical slices when the diff becomes too large to review meaningfully.
