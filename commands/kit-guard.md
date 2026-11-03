---
description: Prove the product still works (baseline before a change, check after)
---

Call `kit_guard` with action `status`. If there is no baseline, call it with action `baseline` now, before any change. If there is one and work has been done, call it with action `check`. Report the verdict in one line, name any regression, and say what the checks do and do not cover. On REGRESSION, stop and propose the fix or the undo; do not continue the work.
