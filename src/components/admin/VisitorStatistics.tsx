"use client";
import { useEffect, useState } from "react";
import {
  browserAnalyticsExcluded,
  setBrowserAnalyticsExcluded,
} from "@/lib/analytics-browser";
import { percentageChange } from "@/lib/analytics-report";
import type {
  StatisticsMetric,
  StatisticsPeriod,
  StatisticsReport,
} from "@/lib/analytics-report";
import { ANALYTICS_EXCLUSION_EVENT } from "@/lib/analytics-policy";

type Response =
  | StatisticsReport
  | { status: "unconfigured" | "unavailable" | "timezone-mismatch" };
const metrics: Record<StatisticsMetric, string> = {
  visitors: "방문자",
  sessions: "방문 횟수",
  pageviews: "페이지 조회",
};
export default function VisitorStatistics() {
  const [period, setPeriod] = useState<StatisticsPeriod>("day"),
    [metric, setMetric] = useState<StatisticsMetric>("visitors");
  const [data, setData] = useState<Response | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0),
    [excluded, setExcluded] = useState(true);
  useEffect(() => {
    const sync = () => setExcluded(browserAnalyticsExcluded());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(ANALYTICS_EXCLUSION_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(ANALYTICS_EXCLUSION_EVENT, sync);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/statistics?period=${period}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok)
          throw new Error(
            res.status === 401
              ? "다시 로그인해 주세요."
              : "통계를 불러오지 못했습니다.",
          );
        return res.json();
      })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [period, refresh]);
  const report =
    data?.status === "ready" && data.period === period ? data : null;
  const points = report?.current.points || [],
    previous = report?.previous.points || [];
  const max = Math.max(
    1,
    ...points.map((p) => p[metric]),
    ...previous.map((p) => p[metric]),
  );
  const length = Math.max(points.length, previous.length, 2);
  const x = (i: number) => 35 + (i / (length - 1)) * 820,
    y = (n: number) => 235 - (n / max) * 200;
  const path = (items: typeof points) =>
    items.map((p, i) => `${i ? "L" : "M"}${x(i)} ${y(p[metric])}`).join(" ");
  return (
    <section className="visitor-statistics" aria-busy={loading}>
      <div className="statistics-heading">
        <div>
          <h1>방문 통계</h1>
          <p>한국 시간 · 관리와 검수 접속을 제외한 공개 화면</p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setError("");
            setRefresh((n) => n + 1);
          }}
        >
          다시 확인
        </button>
      </div>
      <div className="statistics-exclusion">
        <label>
          <input
            type="checkbox"
            checked={excluded}
            onChange={(e) => {
              setBrowserAnalyticsExcluded(e.target.checked);
              setExcluded(e.target.checked);
            }}
          />{" "}
          이 브라우저 집계 제외
        </label>
        <p>
          {excluded
            ? "이 브라우저의 방문은 통계로 보내지 않습니다. 로그아웃 후에도 유지합니다."
            : "로그아웃하고 새로고침한 뒤 공개 화면부터 집계할 수 있습니다. 관리자 화면과 검토용 주소는 항상 제외합니다."}
        </p>
        <p>
          다른 기기·브라우저에서는 따로 설정합니다. 이미 보낸 기록을 소급
          삭제하지는 않습니다.
        </p>
      </div>
      <div className="statistics-period" role="group" aria-label="통계 기간">
        {(["day", "month", "year"] as const).map((p, i) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => {
              if (p !== period) {
                setLoading(true);
                setError("");
                setPeriod(p);
              }
            }}
          >
            {["일별 · 이번 달", "월별 · 올해", "연별 · 최근 5년"][i]}
          </button>
        ))}
      </div>
      {loading && <p role="status">통계를 불러오는 중입니다.</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && data?.status === "unconfigured" && (
        <div className="statistics-empty">
          <h2>통계 연결 전</h2>
          <p>
            Google Analytics를 연결하면 실제 방문 기록과 그래프가 여기에
            나타납니다. 아직 0명으로 집계한 상태는 아닙니다.
          </p>
          <p>연결 이전의 방문 기록은 복원할 수 없습니다.</p>
          <details>
            <summary>연결에 필요한 설정</summary>
            <ol>
              <li>
                정환님 Google 계정으로 홈페이지용 GA4 속성과 웹 스트림을
                만듭니다. 보고 시간대는 대한민국으로 지정합니다.
              </li>
              <li>
                사이트 수집에는 측정 ID, 보고서 읽기에는 속성 ID와 읽기 전용
                서비스 계정 권한이 필요합니다.
              </li>
              <li>
                비밀키는 서버의 비공개 설정에만 저장합니다. 채팅이나 작품
                입력창에 넣지 않습니다.
              </li>
              <li>
                자동 페이지 변경·폼 추적은 끄고, 제외 브라우저와 일반 브라우저를
                나눠 확인한 뒤 수집을 시작합니다.
              </li>
            </ol>
          </details>
        </div>
      )}
      {!loading && !error && data?.status === "unavailable" && (
        <p role="alert">
          통계 연결을 확인하지 못했습니다. 작품과 관리자 저장 기능은 계속 사용할
          수 있습니다. 잠시 뒤 다시 확인해 주세요.
        </p>
      )}
      {!loading && !error && data?.status === "timezone-mismatch" && (
        <p role="alert">
          Google Analytics 속성의 보고 시간대를 Asia/Seoul로 맞춰 주세요. 날짜가
          다른 통계는 표시하지 않았습니다.
        </p>
      )}
      {!loading && !error && report && (
        <>
          <p className="statistics-date">
            {report.current.start} — {report.current.end}
            <br />
            비교: {report.previous.start} — {report.previous.end}
          </p>
          <div className="statistics-cards">
            {(Object.keys(metrics) as StatisticsMetric[]).map((m) => {
              const diff = percentageChange(
                report.current.totals[m],
                report.previous.totals[m],
              );
              return (
                <button
                  type="button"
                  key={m}
                  aria-pressed={metric === m}
                  onClick={() => setMetric(m)}
                >
                  <span>{metrics[m]}</span>
                  <strong>
                    {report.current.totals[m].toLocaleString("ko-KR")}
                  </strong>
                  <small>
                    {diff === null
                      ? "비교 기준 없음"
                      : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`}
                  </small>
                </button>
              );
            })}
          </div>
          <figure>
            <figcaption>
              {metrics[metric]} 추이{" "}
              <span>실선: 선택 기간 · 점선: 이전 같은 기간</span>
            </figcaption>
            <svg
              viewBox="0 0 900 280"
              role="img"
              aria-label={`${metrics[metric]} 변화 그래프. 정확한 수치는 아래 표에 있습니다.`}
            >
              {[0, 0.5, 1].map((v) => (
                <g key={v}>
                  <line
                    x1="35"
                    x2="855"
                    y1={y(max * v)}
                    y2={y(max * v)}
                    stroke="var(--border)"
                  />
                  <text
                    x="4"
                    y={y(max * v) - 4}
                    fontSize="11"
                    fill="var(--text-secondary)"
                  >
                    {Math.round(max * v)}
                  </text>
                </g>
              ))}
              <path
                d={path(previous)}
                stroke="#aaa"
                strokeWidth="1.5"
                strokeDasharray="5 5"
                fill="none"
              />
              <path
                d={path(points)}
                stroke="var(--foreground)"
                strokeWidth="2"
                fill="none"
              />
              {points.map((p, i) => (
                <g key={p.key}>
                  <circle
                    cx={x(i)}
                    cy={y(p[metric])}
                    r="3"
                    fill="var(--foreground)"
                  >
                    <title>
                      {p.label}: {p[metric]}
                    </title>
                  </circle>
                  {(i === 0 ||
                    i === points.length - 1 ||
                    i % Math.max(1, Math.ceil(points.length / 8)) === 0) && (
                    <text
                      x={x(i)}
                      y="265"
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--text-secondary)"
                    >
                      {p.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </figure>
          {report.current.totals.pageviews === 0 && (
            <p>
              선택 기간에 처리된 페이지 조회 기록이 없습니다. 연결 직후에는 통계
              처리 시간이 필요합니다.
            </p>
          )}
          <details>
            <summary>날짜별 수치 보기</summary>
            <table>
              <thead>
                <tr>
                  <th>기간</th>
                  <th>방문자</th>
                  <th>방문 횟수</th>
                  <th>페이지 조회</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.key}>
                    <th>{p.label}</th>
                    <td>{p.visitors}</td>
                    <td>{p.sessions}</td>
                    <td>{p.pageviews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <p>
            마지막 갱신:{" "}
            {new Date(report.refreshedAt).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}
            . 보고서는 약 1시간 간격으로 갱신합니다.
          </p>
          {report.thresholded && (
            <p>Google에서 일부 수치를 제한하거나 묶어 제공했습니다.</p>
          )}
        </>
      )}
      <p className="statistics-footnote">
        최근 기록은 처리 과정에서 24~48시간 동안 달라질 수 있습니다. 방문자는
        기간 전체의 고유 이용자 추정치이며 날짜별 방문자를 더한 값과 다릅니다.
        광고 차단·여러 기기 사용에 따라 실제 사람 수와 차이가 납니다.
      </p>
      <p className="statistics-footnote">
        이 제외 설정은 방문 통계에만 적용합니다. 실제 사이트와 이미지 저장소
        사용량은 별도로 발생합니다.
      </p>
    </section>
  );
}
