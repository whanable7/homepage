export type StatisticsPeriod = "day" | "month" | "year";
export type StatisticsMetric = "visitors" | "sessions" | "pageviews";
export interface StatisticsTotals {
  visitors: number;
  sessions: number;
  pageviews: number;
}
export interface StatisticsPoint extends StatisticsTotals {
  key: string;
  label: string;
}
export interface StatisticsReport {
  status: "ready";
  period: StatisticsPeriod;
  current: {
    start: string;
    end: string;
    totals: StatisticsTotals;
    points: StatisticsPoint[];
  };
  previous: {
    start: string;
    end: string;
    totals: StatisticsTotals;
    points: StatisticsPoint[];
  };
  refreshedAt: string;
  timeZone: "Asia/Seoul";
  thresholded: boolean;
}
export function koreanDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
const date = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
function clampedDate(year: number, month: number, day: number) {
  return date(
    year,
    month,
    Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate()),
  );
}
export function reportRanges(period: StatisticsPeriod, today: string) {
  const [y, m, d] = today.split("-").map(Number);
  if (period === "day") {
    const pm = m === 1 ? 12 : m - 1,
      py = m === 1 ? y - 1 : y;
    return {
      current: { start: date(y, m, 1), end: today },
      previous: { start: date(py, pm, 1), end: clampedDate(py, pm, d) },
    };
  }
  const years = period === "month" ? 1 : 5;
  return {
    current: { start: date(y - years + 1, 1, 1), end: today },
    previous: {
      start: date(y - years * 2 + 1, 1, 1),
      end: clampedDate(y - years, m, d),
    },
  };
}
export function reportBuckets(
  period: StatisticsPeriod,
  start: string,
  end: string,
) {
  const result: { key: string; label: string }[] = [];
  const cur = new Date(`${start}T00:00:00Z`),
    limit = new Date(`${end}T00:00:00Z`);
  while (cur <= limit) {
    const iso = cur.toISOString().slice(0, 10);
    result.push({
      key: iso
        .replaceAll("-", "")
        .slice(0, period === "day" ? 8 : period === "month" ? 6 : 4),
      label:
        period === "day"
          ? `${cur.getUTCMonth() + 1}/${cur.getUTCDate()}`
          : period === "month"
            ? `${cur.getUTCMonth() + 1}월`
            : `${cur.getUTCFullYear()}`,
    });
    if (period === "day") cur.setUTCDate(cur.getUTCDate() + 1);
    else if (period === "month") cur.setUTCMonth(cur.getUTCMonth() + 1);
    else cur.setUTCFullYear(cur.getUTCFullYear() + 1);
  }
  return result;
}
export function percentageChange(current: number, previous: number) {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}
