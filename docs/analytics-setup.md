# 방문 통계 후속 연결

현재 수집 및 외부 계정 연결은 보류다. 환경 설정이 없으면 실제 0명 대신 ‘통계 연결 전’을 표시한다.

1. 정환님 계정에 GA4 속성 jungwhanpark.com을 만든다. 시간대 Asia/Seoul. 광고 연결·Google 신호·추가 데이터 공유는 사용하지 않는다. 약관 동의는 사용자가 직접 한다.
2. 웹 스트림의 향상된 측정을 끈다. 자동 방문 변경 감지와 수동 page_view의 중복, 폼 입력 추적을 막는다. 수집 목적과 브라우저 식별 한계 및 방문자 안내를 확인한다.
3. Google Analytics Data API를 활성화한 정환님 Google Cloud 프로젝트에 보고서 전용 서비스 계정을 준비한다. GA 속성에 Viewer만 부여하고 Cloud 프로젝트 관리자 권한은 부여하지 않는다. 새 접근 권한 부여와 키 생성은 사용자 확인 후 진행한다.
4. 비공개 서버 설정에 GA_MEASUREMENT_ID, GA_PROPERTY_ID, GA_CLIENT_EMAIL, GA_PRIVATE_KEY를 등록한다. 비밀키는 저장소·채팅·클라이언트 코드에 넣지 않는다. 키를 바꾸면 기존 키를 정리한다. 결제 계정이나 유료 통계 상품을 추가하지 않는다.
5. 수집기는 VERCEL_ENV=production이며 브라우저 호스트가 jungwhanpark.com인 공개 화면에서만 시작한다. localhost·검토 주소·/admin은 항상 차단한다. 쿠키와 로컬 표시, 유효한 관리자 세션을 최초 전송 전에 확인한다.
6. Google 태그는 page_view를 자동 전송하지 않도록 설정하며 수동 이벤트는 경로만 보낸다. 쿼리·폼 내용·이메일·작품 비공개 정보는 보내지 않는다. Works 보기 전환은 같은 페이지로 취급한다.
7. 실제 배포 전 연결 검증: 속성 시간대와 읽기 권한, 제외 브라우저의 이벤트 0건, 일반 별도 테스트 환경의 경로 이벤트 3건과 중복 없음. 로그아웃·탭 이동·저장정보 초기화 및 차단 환경도 확인한다. 이 시험을 실제 관람객 수치에 섞지 않는다.
8. 통계 수집과 무료 제공 범위·기기 식별·동의 설정이 맞는지 사용자와 확인하고 공식 배포 승인을 받는다. 관리자 집계를 제외해도 실제 인프라 사용량은 발생한다.

서버 보고서: `/api/admin/statistics?period=day|month|year`. 인증 필수, 응답 private/no-store, GA 응답은 서버에서 한 시간 재사용한다. 기간 합계는 날짜별 고유 방문자의 합이 아니라 GA의 기간 전체 totalUsers를 사용한다. 오늘은 한국 날짜로 계산하며 속성 시간대가 다르면 보고서를 차단한다.

참고: Google Data API batchRunReports, API dimensions and metrics, Google tag send_page_view, Google Auth Library의 서비스 계정 인증.
