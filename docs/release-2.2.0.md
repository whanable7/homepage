# 2.2.0 — 2026-10-19

## Changes
- Add nearby thumbnail selection for group membership editing, keeping existing manual edges.
- Fit Sequences to the viewport; merge nearly aligned vertical stems and overlapping crossbars without moving stored artwork positions.
- Add new sequence groups to the right of existing groups; freeze legacy fallback positions before edits.
- Apply the selected Noto Sans KR site typography and separate Nanum Myeongjo Korean TEXTS from Noto Sans KR English TEXTS. Existing text-block formatting is preserved.
- Add an independent, authenticated typography settings editor at the end of the admin menu. Draft/save/apply/restore never publishes archive classifications.
- Bundle four additional licensed webfonts: Pretendard, Noto Serif KR, Inter and Source Serif 4. Load chosen families on demand.
- Remove homepage dots, enlarge images with margins on every side, retain original aspect ratios and slideshow controls.
- Default first visits to English, remember deliberate language choices, and label the switch 한글 / EN.

## Data and release boundaries
Production portfolio, archive draft/published classifications, texts, files, password and other CMS documents remain unchanged. Appearance is a separate document with a revision guard. Prior preview edits are not copied into production. The release uses the current production data.

The user explicitly requested this official deployment after reviewing the 2.2 preview and approving the subsequent changes. Future updates still follow preview → user review → production.

## Deferred
36. Work-family subdivision and substantial smartphone/iPad spatial navigation redesign.
Additional languages: replace the two visible options with a globe menu when languages are actually added.
