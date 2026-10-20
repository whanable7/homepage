# 2.2.1 — Sequence review and featured images (preview, 2026-10-20)

## Problem and change
The public archive has one stage containing 125 works without saved positions. The old fallback increased both x and y as it visited the works in year order, creating a long diagonal. Fit-all then reduced the view to about 4–6% on typical desktop screens.

Unpositioned works now follow the stored stage and membership order, use shared vertical columns around the horizontal axis, and leave a clear gap between images. Each column holds at most four works above and four below; later columns grow to the right. Batch additions use the same arrangement. Existing manually saved positions remain exact and take precedence over generated positions. Rendering does not write generated positions back into storage.

## Publication boundary
The production snapshot read on 2026-10-20 contains the public 125-work sequence and a separate private draft with 47 memberships, 11 stages and 47 saved coordinates. This update does not publish the draft, replace either layout, or change works, groups, edges, captions, texts, files, typography, credentials or other settings.

A private copy lives in the review Blob store under the branch namespace `codex/sequence-layout-fix`. The preview's `/works?view=sequences` renders the copied public layout; `/admin/preview?view=sequences` renders the copied private draft after normal admin login. They intentionally show different sequences. Official deployment requires the user's review and explicit approval.

The user-facing review link must point to `/admin/preview?view=sequences`, not to the public 125-work layout. The page labels the saved draft and its placement count. Authentication preserves a validated admin-only return destination so login leads directly to the requested preview. Password and session configuration are unchanged.

## Featured image repair
Reordering previously changed server timestamps without returning them to the editor. A following unfeature request used an obsolete timestamp and failed with a conflict. The reorder endpoint now returns committed records and the editor retains their timestamps. Repeated mutations are gated while pending; genuine stale edits remain protected.

The home tab offers a separate draft slideshow preview and a `대표 이미지만 공개` action. That action changes only the published works' featured flags and order, advances the public revision, and preserves archive draft, published classifications, placements, backups and unpublished caption edits. It refuses to expose a work not already in the public snapshot. It never publishes private sequences. The regular full-publication action remains available in classification tabs.

## Validation
- 30 tests pass, including the 125-work regression, no overlap, preservation of manual positions, independence from years, compact batch additions, reorder-then-unfeature, independent featured publication and safe login return destinations.
- TypeScript and changed-file lint pass.
- Verify the deployed preview and the 47-work draft in the browser before release.

## Deferred
36. Work-family subdivision and substantial smartphone/iPad spatial navigation redesign.
