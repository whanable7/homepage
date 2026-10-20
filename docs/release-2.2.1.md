# 2.2.1 — Sequence layout fix (preview, 2026-10-20)

## Problem and change
The public archive has one stage containing 125 works without saved positions. The old fallback increased both x and y as it visited the works in year order, creating a long diagonal. Fit-all then reduced the view to about 4–6% on typical desktop screens.

Unpositioned works now follow the stored stage and membership order, use shared vertical columns around the horizontal axis, and leave a clear gap between images. Each column holds at most four works above and four below; later columns grow to the right. Batch additions use the same arrangement. Existing manually saved positions remain exact and take precedence over generated positions. Rendering does not write generated positions back into storage.

## Publication boundary
The production snapshot read on 2026-10-20 contains the public 125-work sequence and a separate private draft with 47 memberships, 11 stages and 47 saved coordinates. This update does not publish the draft, replace either layout, or change works, groups, edges, captions, texts, files, typography, credentials or other settings.

A private copy lives in the review Blob store under the branch namespace `codex/sequence-layout-fix`. The preview's `/works?view=sequences` renders the copied public layout; `/admin/preview?view=sequences` renders the copied private draft after normal admin login. They intentionally show different sequences. Official deployment requires the user's review and explicit approval.

## Validation
- 28 tests pass, including the 125-work regression, no overlap, preservation of manual positions, independence from years and compact batch additions.
- TypeScript and changed-file lint pass.
- Verify the deployed preview and the 47-work draft in the browser before release.

## Deferred
36. Work-family subdivision and substantial smartphone/iPad spatial navigation redesign.
