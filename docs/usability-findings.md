# Usability Findings

Last reviewed: 2026-07-26

Human participant sessions completed: **0**. Participants are unavailable in the agent execution environment; no user-study observations are fabricated.

Open P0: **0**

Open P1: **0**

| ID | Priority | Task | Observation | Frequency | User impact | Correction | Status | Coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UV-001 | P1 | Import | Fixed success/error notifications could cover lower-right import actions at 1280×720. | Reproducible | Retry and cancel actions could be obscured. | Put notifications in workspace flow; cap at three; coalesce duplicates; add severity lifecycle and dismissal. | fixed | `e2e/toasts.spec.js` |
| UV-002 | P2 | Navigation | Collapsing the sidebar removed the page’s only level-one heading from the accessibility tree. | Every collapsed state | Screen-reader users lost the document heading. | Keep a persistent workspace heading and connect the restore control to the library. | fixed | `e2e/accessibility/axe.spec.js` |
| UV-003 | P2 | Evaluation | Safari behavior has not been manually verified. | Environment limitation | Safari users have lower release confidence. | Run `manual-safari-checklist.md` before RC sign-off. | open beta limitation | manual |
| UV-004 | Gate | RC decision | First-time-user observation has not been completed with independent participants. | Required human gate | Discoverability and terminology cannot be validated by automation alone. | Run this study with at least three participants and resolve resulting P0/P1 findings. | open RC blocker | `usability-test-plan.md` |
| UV-005 | P1 | Visualize | Enabling the ECharts slider zoom collapsed category charts to the first x-axis position even though the runtime reported a full range. | Reproducible | Valid line charts appeared empty or malformed. | Use the stable inside-zoom interaction, emit explicit category/series data, and verify real series point counts. | fixed | `tests/viz-compiler.test.js`, `e2e/release/real-chart-matrix.spec.js` |

Technical inspection found no additional P0 or P1 defects in the current automated primary workflow. This statement is not a substitute for participant observation.
