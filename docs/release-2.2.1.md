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

## 공개 자료 조회 절감 — 2026-10-22 검토본

공개 자료만 Next.js 15 지속 캐시에 보관하고, 공개할 내용이 바뀐 저장이 성공했을 때 해당 자료를 갱신한다. 저장소·환경·검토 브랜치별로 키와 태그를 분리했다. 관리자 원본 읽기와 revision/ETag 충돌 검사는 그대로 유지한다.

공통 변경 확인을 30초에서 5분으로 조정했다. 숨긴 화면과 오프라인에서 중단하고, 실패하면 재시도 간격을 늘린다. 같은 페이지의 중복 구독과 브라우저 탭 사이의 가까운 확인을 줄인다. 관람 중인 화면은 알림을 눌러야 새로 반영한다.

캐시에는 비공개 분류·좌표, 초안 캡션, 비공개 언어 본문, 원본 ETag, 관리자 설정을 넣지 않는다. 대표 이미지만 공개해도 임시저장한 흐름은 공개하지 않는다. 공개 취소 후 상세와 PDF 권한 판단도 새 공개 자료를 사용한다.

로컬 모의 시험: 변경 확인 100번과 공개 작품 조회 100번에서 이전 구조의 800회 대비 6회 읽기(99.25% 절감). 배포용 빌드를 실행한 HTTP 시험에서도 공개 문서 6개를 한 번씩 읽은 뒤 200회 요청을 처리했다. 실제 월간 무료 한도를 보장하지 않는다.

원본 오류 시 30초간 잦은 재시도를 억제한다. 로그인 화면은 공개 글꼴 조회에 실패해도 기본 글꼴로 열린다. 읽기 오류에는 안내와 다시 불러오기 버튼을 제공한다. 원본 저장 뒤 공개 캐시 갱신에 실패하면 저장 완료와 갱신 실패를 구분해 안내한다.

최신 원본 10개, 로컬 편집 자료, 공개 자료만 골라 만든 사본을 Git과 배포 묶음에서 제외한 폴더에 백업했다. 빈 캐시와 저장소 정지가 겹칠 때 모든 화면을 복구한다고 보장하지 않는다. 공개 취소한 자료를 되살리지 않도록 과거 사본을 자동으로 제공하지 않는다. 필요한 경우 공개 상태를 대조한 읽기 전용 복구본을 별도로 검토한다.
