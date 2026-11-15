# Anchor scrolling and route playback

Actual installed-Chrome recordings from the independent final42-case scroll run on implementation3188609. Mobile clips use440x956; desktop clips use1440x900. No physical-device claim. manifest.json maps each clip to its original scenario and preserves hashes of videos, sampled frames and timing data.

| Scenario | Mobile | Desktop |
| --- | --- | --- |
| Purposeful same-page smooth anchor | [Play](anchor-normal-mobile.webm) | [Play](anchor-normal-desktop.webm) |
| Reduced-motion immediate anchor | [Play](anchor-reduced-mobile.webm) | [Play](anchor-reduced-desktop.webm) |
| Direct/cross-route hash and history restoration | [Play](hash-history-mobile.webm) | [Play](hash-history-desktop.webm) |
| Live reduction/resize and native scroll | [Play](reduction-resize-mobile.webm) | [Play](reduction-resize-desktop.webm) |
| Manual interruption without a stale target jump | [Play](manual-scroll-mobile.webm) | [Play](manual-scroll-desktop.webm) |
| Landing/workspace entrance replay and basic placeholders | [Play](route-entries-mobile.webm) | [Play](route-entries-desktop.webm) |

Recordings include initial document loading and automated test preparation. Anchor cases deliberately scroll to the footer after the first arrival to activate the same-hash link again; that setup jump is distinct from the tested smooth section navigation. Reduced-mode arrival is intentionally immediate. Route recordings preserve the existing finite480ms content entrances and focus without a blank exit transition.

Samples contain actual scroll positions, focus IDs, measured sticky-header heights, route animation observations and start/middle/end PNGs. anchor-filmstrip.png and route-after-load-filmstrip.png are video-derived sequences independently inspected by coordinator and Q; the latter montage excludes initial document-loading frames, which remain in raw video.

Reproduce from the implementation worktree with existing npm dependencies and installed Chrome:

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome'
$env:PLAYWRIGHT_PORT='3108'
npm run test:e2e -- e2e/scroll.spec.ts --workers=2
```

The full182-case suite includes existing motion/nav/axe regressions. No unrelated process is stopped or reused; strictPort rejects collisions. Full independent traces/videos are retained locally under artifacts/m1-scroll-worker/focus-boundary-scroll/. Replay with npx playwright show-trace followed by an individual trace.zip path. The initial coordinator pre-commit sampling failure is retained under artifacts/m1-scroll-coordinator-initial; it is not final passing evidence.

Full audit/results: [M1-SCROLL report](../../../ai/handoffs/M1-SCROLL.md). M1 remains awaiting owner visual approval.
