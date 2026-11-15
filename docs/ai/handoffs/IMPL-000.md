# IMPL-000: implementation preparation

## Scope and acceptance
Preserve the primary checkout on main; establish a separate implementation worktree from the integrated initialization; copy and commit approved Editorial Systems references without changing their bytes. No application scope is inferred from a missing prompt.

## Baseline and authority
- Primary checkout remains main at 197711b; it contains the starter template.
- Baseline: init/verimark-initialization at 9d28106, integrating product, architecture/security, visual exploration and delivery initialization.
- design/civic-ledger-round2 at 88fd42b is a later alternative design review branch, preserved rather than selected as the implementation baseline.
- The current user instruction identifies Editorial Systems as approved. This supersedes pending-approval wording inside the copied historical prototype; the artifact itself is unchanged.
- Dedicated branch: feat/full-stack-implementation. Worktree: C:/Users/James/orca/workspaces/VeriMark/full-stack-implementation.

## Verification and cleanup
All 40 copied reference files matched source SHA-256 hashes before commit. Primary untracked design-references and artifacts remain untouched. No archive files were copied into the implementation branch.

All six legacy worker worktrees were clean. git cherry against design/civic-ledger-round2 reports patch equivalence for every commit on product-workflow, architecture-security, visual-design, design-ledger-critique and design-ledger-round2. Their obsolete worktrees were removed normally, preserving branches and commits. Quality-delivery has a non-equivalent patch (83f57c4); retain its worktree pending deeper inspection. Never use forced removal.

## Remaining work and risks
The user message refers to a Master Full-Stack Implementation Prompt below, but no such prompt was supplied. Request that prompt before determining full-stack scope, policy choices and acceptance. No application dependencies, runtime tests, build or deployment are configured or claimed. Independent read-only review found no blocking findings: baseline, all 40 reference hashes and primary checkout preservation verified. Initialization validator PASS and final staged whitespace check PASS. No push, merge, provisioning or deployment performed.
