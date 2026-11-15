# Motion playback evidence

Actual installed-Chrome recordings of the stage-corrected M1 source. These are short individual walkthrough cases, not screen mockups. View videos with native controls; accompanying samples contain running/middle/settled frames and measured Web Animations timing. See ../../../ai/handoffs/M1-MOTION.md for the complete audit and results.

| Behavior | Desktop1440 | Mobile390 |
| --- | --- | --- |
| Landing entrance, refresh, preference changes, mobile menu | [Play](landing-desktop.webm) | [Play](landing-mobile.webm) |
| Workspace entrance, filtering, refresh, mobile drawer | [Play](workspace-desktop.webm) | [Play](workspace-mobile.webm) |
| Scroll reveal, repeat scrolling, route reentry, fallback | [Play](reveals-desktop.webm) | [Play](reveals-mobile.webm) |
| Button hover/press, record feedback, reduced action displacement | [Play](interactions-desktop.webm) | [Play](interactions-mobile.webm) |
| Initial reduced motion and unavailable observer | [Play](reduced-desktop.webm) | [Play](reduced-mobile.webm) |
| Actual credential100ms stage | [Play](credential-stages-desktop.webm) | [Play](credential-stages-mobile.webm) |
| Actual dashboard0/60/110/160/180ms stages | [Play](dashboard-stages-desktop.webm) | [Play](dashboard-stages-mobile.webm) |

Reduced-mode recordings are intentionally still. Some clips include automated sample pauses and browser reloads so the same behavior is reproducible. They do not show the owner's OS settings or a physical phone. manifest.json maps friendly filenames to original cases and hashes.

From the implementation worktree, with npm dependencies installed and Chrome available:

```powershell
powershell -File e2e/capture-motion.ps1 -EvidenceName review -Port 3107
```

This runs14 cases at390/1440, records WebM/traces/timelines/frames and preserves results under artifacts/m1-motion/review. Use a free test port; no process is stopped. Full140-case matrix also covers320/440x956/768/1024/1920.

Original trace archives are retained locally under artifacts/m1-motion-worker/stage-corrected-final in their case directories. Replay an individual trace with:

```powershell
npx playwright show-trace <path-to-case/trace.zip>
```

Baseline audit is before-audit.json. Baseline, pre-correction and pre-stage videos/traces remain in the local ignored artifact archive, clearly separate from these final reviewed recordings. No static frame alone is offered as proof of animation.
